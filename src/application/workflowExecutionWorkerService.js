import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES,
  isTerminalExecutionStatus,
  isTerminalNodeRunStatus
} from "../domain/workflowExecutionPolicy.js";
import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  WORKFLOW_QUEUE_JOB_TYPES,
  WorkflowQueuePolicyValidationError
} from "../domain/workflowQueuePolicy.js";

export const WORKFLOW_EXECUTION_WORKER_RUN_STATUSES = Object.freeze({
  IDLE: "idle",
  COMPLETED: "completed",
  EXECUTION_FAILED: "execution_failed",
  RETRY_SCHEDULED: "retry_scheduled",
  DEAD_LETTERED: "dead_lettered"
});

export function createWorkflowExecutionWorkerService({
  workflowQueueService,
  workflowRepository,
  executionRepository,
  workflowExecutionService,
  nodeRunner,
  workerActorIds = [],
  worker_id = "workflow_worker",
  lease_duration_ms = 60000,
  retry_delay_ms = 30000,
  clock = () => new Date()
} = {}) {
  assertService(workflowQueueService, "workflowQueueService", [
    "leaseNextJob",
    "completeJob",
    "failJob"
  ]);
  assertRepository(workflowRepository, "workflowRepository", ["findById"]);
  assertRepository(executionRepository, "executionRepository", ["findById"]);
  assertService(workflowExecutionService, "workflowExecutionService", [
    "recordNodeRunLog",
    "recordNodeRunResult"
  ]);

  if (!nodeRunner || typeof nodeRunner.runNode !== "function") {
    throw new TypeError(
      "createWorkflowExecutionWorkerService requires nodeRunner.runNode()."
    );
  }

  const workers = new Set(normalizeStringArray(workerActorIds, "workerActorIds"));
  const defaultWorkerId = normalizeRequiredString(
    worker_id,
    "Workflow worker worker_id"
  );

  return Object.freeze({
    async runNextWorkflowExecution({
      actor,
      worker_id = defaultWorkerId
    } = {}) {
      requireWorkerPermission({ actor, workers });

      const leasedJob = await workflowQueueService.leaseNextJob({
        actor,
        worker_id,
        type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
        lease_duration_ms
      });

      if (!leasedJob) {
        return freezeRunResult({
          status: WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.IDLE,
          job: null,
          execution: null,
          processed_node_ids: []
        });
      }

      return runLeasedWorkflowExecutionJob({
        actor,
        job: leasedJob,
        workflowQueueService,
        workflowRepository,
        executionRepository,
        workflowExecutionService,
        nodeRunner,
        retry_delay_ms
      });
    },

    async runWorkflowExecutionsUntilIdle({
      actor,
      limit = 10,
      worker_id = defaultWorkerId
    } = {}) {
      requireWorkerPermission({ actor, workers });
      const normalizedLimit = normalizePositiveInteger(
        limit,
        "Workflow worker run limit"
      );
      const runs = [];

      for (let index = 0; index < normalizedLimit; index += 1) {
        const run = await this.runNextWorkflowExecution({
          actor,
          worker_id
        });

        runs.push(run);

        if (run.status === WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.IDLE) {
          break;
        }
      }

      return Object.freeze({
        runs,
        processed_jobs: runs.filter((run) => run.job).length,
        idle: runs.at(-1)?.status === WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.IDLE,
        created_at: nowIso(clock)
      });
    }
  });
}

async function runLeasedWorkflowExecutionJob({
  actor,
  job,
  workflowQueueService,
  workflowRepository,
  executionRepository,
  workflowExecutionService,
  nodeRunner,
  retry_delay_ms
}) {
  try {
    assertWorkflowExecutionJob(job);

    let execution = await requireExecution(
      executionRepository,
      job.payload.execution_id
    );

    if (isTerminalExecutionStatus(execution.status)) {
      const completedJob = await workflowQueueService.completeJob({
        actor,
        job_id: job.id
      });

      return freezeRunResult({
        status: WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED,
        job: completedJob,
        execution,
        processed_node_ids: []
      });
    }

    const workflow = await requireWorkflow({
      workflowRepository,
      workflow_id: execution.workflow_id,
      project_id: execution.project_id
    });
    const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const processedNodeIds = [];

    for (const nodeId of execution.plan.node_ids ?? []) {
      execution = await requireExecution(executionRepository, execution.id);

      if (isTerminalExecutionStatus(execution.status)) {
        break;
      }

      const nodeRun = findRunnableNodeRun({ execution, node_id: nodeId });

      if (!nodeRun) {
        continue;
      }

      const node = nodesById.get(nodeRun.node_id);

      if (!node) {
        execution = await failExecutionNode({
          actor,
          workflowExecutionService,
          execution,
          nodeRun,
          error: `Workflow node "${nodeRun.node_id}" was not found.`
        });
        processedNodeIds.push(nodeRun.node_id);
        break;
      }

      execution = await workflowExecutionService.recordNodeRunLog({
        actor: { id: execution.started_by },
        project_id: execution.project_id,
        execution_id: execution.id,
        node_id: nodeRun.node_id,
        attempt: nodeRun.attempt,
        level: "info",
        message: `Worker started node ${nodeRun.node_id}`,
        metadata: {
          worker_job_id: job.id,
          node_type: node.type
        }
      });

      let result;

      try {
        result = await nodeRunner.runNode({
          workflow,
          execution,
          node,
          nodeRun,
          input: execution.input,
          context: {
            queue_job_id: job.id,
            attempt: nodeRun.attempt
          }
        });
      } catch (error) {
        if (isQueueRetryError(error)) {
          const failedJob = await workflowQueueService.failJob({
            actor,
            job_id: job.id,
            error: normalizeError(error),
            retry_delay_ms
          });

          return freezeRunResult({
            status: resolveFailedJobRunStatus(failedJob),
            job: failedJob,
            execution,
            processed_node_ids: processedNodeIds
          });
        }

        execution = await failExecutionNode({
          actor,
          workflowExecutionService,
          execution,
          nodeRun,
          error
        });
        processedNodeIds.push(nodeRun.node_id);
        break;
      }

      for (const log of result.logs ?? []) {
        execution = await workflowExecutionService.recordNodeRunLog({
          actor: { id: execution.started_by },
          project_id: execution.project_id,
          execution_id: execution.id,
          node_id: nodeRun.node_id,
          attempt: nodeRun.attempt,
          level: log.level,
          message: log.message,
          metadata: log.metadata,
          secretValues: result.secretValues
        });
      }

      execution = await workflowExecutionService.recordNodeRunResult({
        actor: { id: execution.started_by },
        project_id: execution.project_id,
        execution_id: execution.id,
        node_id: nodeRun.node_id,
        attempt: nodeRun.attempt,
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
        output: result.output,
        usage: result.usage,
        cost: result.cost,
        trace: result.trace,
        secretValues: result.secretValues
      });
      processedNodeIds.push(nodeRun.node_id);
    }

    const completedJob = await workflowQueueService.completeJob({
      actor,
      job_id: job.id
    });
    const completedStatus =
      execution.status === WORKFLOW_EXECUTION_STATUSES.FAILED
        ? WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.EXECUTION_FAILED
        : WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED;

    return freezeRunResult({
      status: completedStatus,
      job: completedJob,
      execution,
      processed_node_ids: processedNodeIds
    });
  } catch (error) {
    const failedJob = await workflowQueueService.failJob({
      actor,
      job_id: job.id,
      error: normalizeError(error),
      retry_delay_ms
    });

    return freezeRunResult({
      status: resolveFailedJobRunStatus(failedJob),
      job: failedJob,
      execution: null,
      processed_node_ids: []
    });
  }
}

function findRunnableNodeRun({
  execution,
  node_id
}) {
  const nodeRuns = execution.node_runs.filter(
    (nodeRun) => nodeRun.node_id === node_id
  );
  const activeNodeRun = nodeRuns.find(
    (nodeRun) =>
      !isTerminalNodeRunStatus(nodeRun.status) ||
      nodeRun.status === WORKFLOW_NODE_RUN_STATUSES.QUEUED
  );

  if (activeNodeRun) {
    return activeNodeRun;
  }

  return null;
}

async function failExecutionNode({
  workflowExecutionService,
  execution,
  nodeRun,
  error
}) {
  return workflowExecutionService.recordNodeRunResult({
    actor: { id: execution.started_by },
    project_id: execution.project_id,
    execution_id: execution.id,
    node_id: nodeRun.node_id,
    attempt: nodeRun.attempt,
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: normalizeError(error)
  });
}

function assertWorkflowExecutionJob(job) {
  if (job.type !== WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION) {
    throw new WorkflowQueuePolicyValidationError(
      "Workflow worker can only process workflow execution jobs.",
      {
        code: "workflow_worker_job_type_unsupported",
        details: { job_id: job.id, type: job.type }
      }
    );
  }
}

async function requireExecution(executionRepository, executionId) {
  const execution = await executionRepository.findById(
    normalizeRequiredString(executionId, "Workflow worker execution_id")
  );

  if (!execution) {
    throw new TypeError("Workflow worker execution was not found.");
  }

  return execution;
}

async function requireWorkflow({
  workflowRepository,
  workflow_id,
  project_id
}) {
  const workflow = await workflowRepository.findById(
    normalizeRequiredString(workflow_id, "Workflow worker workflow_id")
  );

  if (!workflow || workflow.project_id !== project_id) {
    throw new TypeError("Workflow worker workflow was not found.");
  }

  return workflow;
}

function resolveFailedJobRunStatus(job) {
  return job.status === WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED
    ? WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.DEAD_LETTERED
    : WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.RETRY_SCHEDULED;
}

function isQueueRetryError(error) {
  return Boolean(error?.queue_failure || error?.retry_job);
}

function normalizeError(error) {
  if (!error) {
    return { message: "Unknown workflow worker error" };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return {
    message: typeof error.message === "string" && error.message.trim() !== ""
      ? error.message
      : "Workflow worker error",
    code: typeof error.code === "string" && error.code.trim() !== ""
      ? error.code
      : undefined
  };
}

function requireWorkerPermission({
  actor,
  workers
}) {
  const actorId = resolveActorId(actor);

  if (workers.size === 0) {
    throw new AuthorizationError(
      "Workflow execution worker operations require configured worker actors.",
      "workflow_execution_worker_required"
    );
  }

  if (!workers.has(actorId)) {
    throw new AuthorizationError(
      "User does not have workflow execution worker permission.",
      "workflow_execution_worker_forbidden"
    );
  }

  return actorId;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError(
      "Workflow execution worker operations require an authenticated actor."
    );
  }

  return actor.id.trim();
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function assertRepository(repository, name, methods) {
  assertService(repository, name, methods);
}

function assertService(service, name, methods) {
  for (const method of methods) {
    if (!service || typeof service[method] !== "function") {
      throw new TypeError(
        `createWorkflowExecutionWorkerService requires ${name}.${method}().`
      );
    }
  }
}

function freezeRunResult(result) {
  return deepFreeze({
    status: result.status,
    job: result.job ?? null,
    execution: result.execution ?? null,
    processed_node_ids: result.processed_node_ids ?? []
  });
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
