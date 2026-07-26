import { redactSecrets } from "../domain/secretRedaction.js";
import {
  PROJECT_PERMISSIONS,
  assertProjectPermission,
  assertWorkflowBelongsToProject
} from "../domain/securityPolicy.js";
import { createWorkflowExecutionPlan } from "../domain/workflowExecutionPlan.js";
import {
  WORKFLOW_EXECUTION_MODES,
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRACE_SPAN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES,
  WorkflowExecutionValidationError,
  assertExecutionBelongsToProjectWorkflow,
  createWorkflowExecutionRecord,
  createWorkflowNodeLogRecord,
  createWorkflowNodeRunRecord,
  createWorkflowTraceSpanRecord,
  isTerminalExecutionStatus,
  isTerminalNodeRunStatus,
  normalizeExecutionError,
  sumWorkflowCostRecords,
  sumWorkflowTokenUsageRecords
} from "../domain/workflowExecutionPolicy.js";
import {
  createWorkflowExecutionHistory,
  createWorkflowExecutionTimeline
} from "../domain/workflowExecutionHistoryPolicy.js";
import {
  createWorkflowExecutionDashboard,
  createWorkflowExecutionObservabilityReport
} from "../domain/workflowExecutionObservabilityPolicy.js";

export function createWorkflowExecutionService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  executionRepository,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById"]);
  assertRepository(executionRepository, "executionRepository", [
    "findById",
    "findByWorkflowId",
    "save"
  ]);

  return Object.freeze({
    async queueWorkflowExecution({
      actor,
      project_id,
      workflow_id,
      trigger_source = WORKFLOW_TRIGGER_SOURCES.MANUAL,
      mode,
      input = {},
      secretValues = [],
      metadata = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const plan = createWorkflowExecutionPlan({ workflow });
      const timestamp = nowIso(clock);
      const execution = createQueuedExecution({
        idGenerator,
        workflow,
        plan,
        actorId,
        trigger_source,
        mode: mode ?? resolveDefaultMode(trigger_source),
        input,
        secretValues,
        metadata,
        timestamp
      });

      return executionRepository.save(execution);
    },

    async queuePartialWorkflowExecution({
      actor,
      project_id,
      workflow_id,
      source_execution_id,
      from_node_id = null,
      input = {},
      secretValues = [],
      metadata = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const sourceExecution = assertExecutionBelongsToProjectWorkflow({
        execution: await requireExecution(executionRepository, source_execution_id),
        project_id: project.id,
        workflow_id: workflow.id
      });

      if (sourceExecution.status !== WORKFLOW_EXECUTION_STATUSES.FAILED) {
        throw new WorkflowExecutionValidationError(
          "Partial workflow execution requires a failed source execution.",
          {
            code: "workflow_partial_execution_source_not_failed",
            details: { source_execution_id: sourceExecution.id }
          }
        );
      }

      const rerunFromNodeId = from_node_id ?? sourceExecution.failed_node_id;

      if (!rerunFromNodeId) {
        throw new WorkflowExecutionValidationError(
          "Partial workflow execution requires a failed node id.",
          {
            code: "workflow_partial_execution_missing_failed_node",
            details: { source_execution_id: sourceExecution.id }
          }
        );
      }

      const plan = createWorkflowExecutionPlan({
        workflow,
        start_node_id: rerunFromNodeId
      });
      const timestamp = nowIso(clock);
      const execution = createQueuedExecution({
        idGenerator,
        workflow,
        plan,
        actorId,
        trigger_source: WORKFLOW_TRIGGER_SOURCES.MANUAL,
        mode: WORKFLOW_EXECUTION_MODES.MANUAL,
        input,
        secretValues,
        metadata,
        timestamp,
        partial_of_execution_id: sourceExecution.id,
        rerun_from_node_id: rerunFromNodeId
      });

      return executionRepository.save(execution);
    },

    async recordNodeRunResult({
      actor,
      project_id,
      execution_id,
      node_id,
      status,
      attempt = 1,
      input = null,
      output = null,
      error = null,
      usage = null,
      cost = null,
      trace = null,
      secretValues = []
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_WORKFLOW
      });
      const execution = await requireExecution(executionRepository, execution_id);

      if (execution.project_id !== project.id) {
        throw new WorkflowExecutionValidationError("Execution is not available in this project.", {
          code: "workflow_execution_not_in_project",
          details: { project_id: project.id, execution_id: execution.id }
        });
      }

      if (isTerminalExecutionStatus(execution.status)) {
        throw new WorkflowExecutionValidationError("Execution has already reached a terminal state.", {
          code: "workflow_execution_already_terminal",
          details: { execution_id: execution.id, status: execution.status }
        });
      }

      assertNodeBelongsToExecutionPlan({ execution, node_id });

      const timestamp = nowIso(clock);
      const existingNodeRun = execution.node_runs.find(
        (nodeRun) => nodeRun.node_id === node_id && nodeRun.attempt === attempt
      );
      const traceSpan = trace === null
        ? null
        : createNodeTraceSpan({
          idGenerator,
          execution,
          existingNodeRun,
          node_id,
          status,
          trace,
          timestamp,
          secretValues
        });
      const nodeRun = createWorkflowNodeRunRecord({
        id: existingNodeRun?.id ?? nextId(idGenerator, "node_run"),
        execution_id: execution.id,
        node_id,
        status,
        attempt,
        input: input === null ? existingNodeRun?.input ?? null : redactSnapshot(input, secretValues),
        output: output === null ? null : redactSnapshot(output, secretValues),
        error: error === null ? null : redactSnapshot(normalizeExecutionError(error), secretValues),
        logs: existingNodeRun?.logs ?? [],
        usage: usage === null ? existingNodeRun?.usage ?? {} : usage,
        cost: cost === null ? existingNodeRun?.cost ?? {} : cost,
        trace_span_id: traceSpan?.id ?? existingNodeRun?.trace_span_id ?? null,
        started_at: existingNodeRun?.started_at ?? timestamp,
        finished_at: isTerminalNodeRunStatus(status) ? timestamp : null,
        duration_ms: isTerminalNodeRunStatus(status)
          ? calculateDurationMs(existingNodeRun?.started_at ?? timestamp, timestamp)
          : null
      });
      const nodeRuns = replaceNodeRun({
        node_runs: execution.node_runs,
        nodeRun
      });
      const nextExecution = createWorkflowExecutionRecord({
        ...execution,
        ...deriveExecutionState({
          execution,
          nodeRuns,
          nodeRun,
          timestamp
        }),
        node_runs: nodeRuns,
        usage: aggregateNodeRunUsage(nodeRuns),
        cost: aggregateNodeRunCost(nodeRuns),
        trace_spans: traceSpan
          ? replaceTraceSpan({
            trace_spans: execution.trace_spans ?? [],
            traceSpan
          })
          : execution.trace_spans ?? [],
        updated_at: timestamp
      });

      return executionRepository.save(nextExecution);
    },

    async recordNodeRunLog({
      actor,
      project_id,
      execution_id,
      node_id,
      attempt = 1,
      level,
      message,
      metadata = {},
      secretValues = []
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_WORKFLOW
      });
      const execution = await requireExecution(executionRepository, execution_id);

      if (execution.project_id !== project.id) {
        throw new WorkflowExecutionValidationError("Execution is not available in this project.", {
          code: "workflow_execution_not_in_project",
          details: { project_id: project.id, execution_id: execution.id }
        });
      }

      if (isTerminalExecutionStatus(execution.status)) {
        throw new WorkflowExecutionValidationError("Execution has already reached a terminal state.", {
          code: "workflow_execution_already_terminal",
          details: { execution_id: execution.id, status: execution.status }
        });
      }

      assertNodeBelongsToExecutionPlan({ execution, node_id });

      const timestamp = nowIso(clock);
      const existingNodeRun = requireNodeRun({
        execution,
        node_id,
        attempt
      });
      const logEvent = createWorkflowNodeLogRecord({
        id: nextId(idGenerator, "node_log"),
        execution_id: execution.id,
        node_id: existingNodeRun.node_id,
        level,
        message: redactSnapshot(message, secretValues),
        timestamp,
        metadata: redactSnapshot(metadata, secretValues)
      });
      const nodeRun = createWorkflowNodeRunRecord({
        ...existingNodeRun,
        status:
          existingNodeRun.status === WORKFLOW_NODE_RUN_STATUSES.QUEUED
            ? WORKFLOW_NODE_RUN_STATUSES.RUNNING
            : existingNodeRun.status,
        logs: [...(existingNodeRun.logs ?? []), logEvent],
        started_at: existingNodeRun.started_at ?? timestamp
      });
      const nodeRuns = replaceNodeRun({
        node_runs: execution.node_runs,
        nodeRun
      });

      return executionRepository.save(
        createWorkflowExecutionRecord({
          ...execution,
          status:
            execution.status === WORKFLOW_EXECUTION_STATUSES.QUEUED
              ? WORKFLOW_EXECUTION_STATUSES.RUNNING
              : execution.status,
          node_runs: nodeRuns,
          updated_at: timestamp
        })
      );
    },

    async getWorkflowExecution({
      actor,
      project_id,
      execution_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const execution = await requireExecution(executionRepository, execution_id);

      if (execution.project_id !== project.id) {
        throw new WorkflowExecutionValidationError("Execution is not available in this project.", {
          code: "workflow_execution_not_in_project",
          details: { project_id: project.id, execution_id: execution.id }
        });
      }

      return execution;
    },

    async getWorkflowExecutionTimeline({
      actor,
      project_id,
      execution_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const execution = await requireExecution(executionRepository, execution_id);

      if (execution.project_id !== project.id) {
        throw new WorkflowExecutionValidationError("Execution is not available in this project.", {
          code: "workflow_execution_not_in_project",
          details: { project_id: project.id, execution_id: execution.id }
        });
      }

      return createWorkflowExecutionTimeline({ execution });
    },

    async getWorkflowExecutionObservability({
      actor,
      project_id,
      workflow_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return createWorkflowExecutionObservabilityReport({
        executions: await executionRepository.findByWorkflowId(workflow.id)
      });
    },

    async getWorkflowExecutionDashboard({
      actor,
      project_id,
      workflow_id,
      filters = {}
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return createWorkflowExecutionDashboard({
        executions: await executionRepository.findByWorkflowId(workflow.id),
        filters
      });
    },

    async listWorkflowExecutions({
      actor,
      project_id,
      workflow_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return executionRepository.findByWorkflowId(workflow.id);
    },

    async listWorkflowExecutionHistory({
      actor,
      project_id,
      workflow_id,
      status = null,
      trigger_source = null,
      started_by = null,
      limit = 50,
      cursor = null
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return createWorkflowExecutionHistory({
        executions: await executionRepository.findByWorkflowId(workflow.id),
        status,
        trigger_source,
        started_by,
        limit,
        cursor
      });
    }
  });
}

function createQueuedExecution({
  idGenerator,
  workflow,
  plan,
  actorId,
  trigger_source,
  mode,
  input,
  secretValues,
  metadata,
  timestamp,
  partial_of_execution_id = null,
  rerun_from_node_id = null
}) {
  const executionId = nextId(idGenerator, "execution");
  const nodeRuns = plan.node_ids.map((nodeId) =>
    createWorkflowNodeRunRecord({
      id: nextId(idGenerator, "node_run"),
      execution_id: executionId,
      node_id: nodeId
    })
  );

  return createWorkflowExecutionRecord({
    id: executionId,
    workflow_id: workflow.id,
    workflow_version: workflow.published_version ?? workflow.draft_version,
    project_id: workflow.project_id,
    status: WORKFLOW_EXECUTION_STATUSES.QUEUED,
    trigger_source,
    mode,
    started_by: actorId,
    partial_of_execution_id,
    rerun_from_node_id,
    input: redactSnapshot(input, secretValues),
    node_runs: nodeRuns,
    plan,
    metadata,
    started_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp
  });
}

async function authorizeProjectAction({
  actor,
  projectRepository,
  membershipRepository,
  project_id,
  permission
}) {
  const actorId = resolveActorId(actor);
  const project = await requireProject(projectRepository, project_id);
  const memberships = await membershipRepository.findByProjectId(project.id);

  assertProjectPermission({
    actor_id: actorId,
    project_id: project.id,
    memberships,
    permission
  });

  return { actorId, project };
}

async function requireProject(projectRepository, projectId) {
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new TypeError("Project id must be a non-empty string.");
  }

  const project = await projectRepository.findById(projectId.trim());

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

async function requireWorkflow({
  workflowRepository,
  workflow_id,
  project_id
}) {
  if (typeof workflow_id !== "string" || workflow_id.trim() === "") {
    throw new TypeError("Workflow id must be a non-empty string.");
  }

  const workflow = await workflowRepository.findById(workflow_id.trim());

  return assertWorkflowBelongsToProject({ workflow, project_id });
}

async function requireExecution(executionRepository, executionId) {
  if (typeof executionId !== "string" || executionId.trim() === "") {
    throw new TypeError("Execution id must be a non-empty string.");
  }

  const execution = await executionRepository.findById(executionId.trim());

  if (!execution) {
    throw new TypeError("Execution was not found.");
  }

  return execution;
}

function assertNodeBelongsToExecutionPlan({
  execution,
  node_id
}) {
  const nodeId = typeof node_id === "string" ? node_id.trim() : "";
  const plannedNodeIds = new Set(execution.plan.node_ids ?? []);
  const errorBranchNodeIds = new Set(
    (execution.plan.error_branches ?? []).map((branch) => branch.target_node_id)
  );

  if (!plannedNodeIds.has(nodeId) && !errorBranchNodeIds.has(nodeId)) {
    throw new WorkflowExecutionValidationError(
      `Execution plan does not include node "${nodeId}".`,
      {
        code: "workflow_execution_node_not_planned",
        details: { execution_id: execution.id, node_id: nodeId }
      }
    );
  }
}

function requireNodeRun({
  execution,
  node_id,
  attempt
}) {
  const nodeId = typeof node_id === "string" ? node_id.trim() : "";
  const nodeRun = execution.node_runs.find(
    (entry) => entry.node_id === nodeId && entry.attempt === attempt
  );

  if (!nodeRun) {
    throw new WorkflowExecutionValidationError(
      `Execution does not contain node run "${nodeId}" attempt ${attempt}.`,
      {
        code: "workflow_execution_node_run_not_found",
        details: { execution_id: execution.id, node_id: nodeId, attempt }
      }
    );
  }

  return nodeRun;
}

function createNodeTraceSpan({
  idGenerator,
  execution,
  existingNodeRun,
  node_id,
  status,
  trace,
  timestamp,
  secretValues
}) {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    throw new TypeError("Node run trace must be an object.");
  }

  const nodeId = typeof node_id === "string" ? node_id.trim() : "";
  const startedAt = trace.started_at ?? existingNodeRun?.started_at ?? timestamp;
  const finishedAt = trace.finished_at ?? (
    isTerminalNodeRunStatus(status) ? timestamp : null
  );

  return createWorkflowTraceSpanRecord({
    id: trace.id ?? existingNodeRun?.trace_span_id ?? nextId(idGenerator, "trace_span"),
    execution_id: execution.id,
    node_id: nodeId,
    parent_span_id: trace.parent_span_id ?? null,
    name: trace.name ?? nodeId,
    kind: trace.kind ?? WORKFLOW_TRACE_SPAN_KINDS.NODE,
    status: trace.status ?? resolveTraceStatus(status),
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: trace.duration_ms ?? (
      finishedAt ? calculateDurationMs(startedAt, finishedAt) : null
    ),
    attributes: redactSnapshot(trace.attributes ?? {}, secretValues)
  });
}

function resolveTraceStatus(nodeRunStatus) {
  return [WORKFLOW_NODE_RUN_STATUSES.FAILED, WORKFLOW_NODE_RUN_STATUSES.CANCELLED]
    .includes(nodeRunStatus)
    ? WORKFLOW_TRACE_SPAN_STATUSES.ERROR
    : WORKFLOW_TRACE_SPAN_STATUSES.OK;
}

function deriveExecutionState({
  execution,
  nodeRuns,
  nodeRun,
  timestamp
}) {
  if (nodeRun.status === WORKFLOW_NODE_RUN_STATUSES.FAILED) {
    return {
      status: WORKFLOW_EXECUTION_STATUSES.FAILED,
      error: nodeRun.error,
      failed_node_id: nodeRun.node_id,
      finished_at: timestamp,
      duration_ms: calculateDurationMs(execution.started_at, timestamp)
    };
  }

  if (nodeRun.status === WORKFLOW_NODE_RUN_STATUSES.CANCELLED) {
    return {
      status: WORKFLOW_EXECUTION_STATUSES.CANCELLED,
      failed_node_id: nodeRun.node_id,
      finished_at: timestamp,
      duration_ms: calculateDurationMs(execution.started_at, timestamp)
    };
  }

  if (allPlannedNodesSucceeded({ execution, nodeRuns })) {
    return {
      status: WORKFLOW_EXECUTION_STATUSES.SUCCESS,
      output: nodeRun.output,
      failed_node_id: null,
      error: null,
      finished_at: timestamp,
      duration_ms: calculateDurationMs(execution.started_at, timestamp)
    };
  }

  return {
    status: WORKFLOW_EXECUTION_STATUSES.RUNNING,
    failed_node_id: null,
    error: null,
    finished_at: null,
    duration_ms: null
  };
}

function allPlannedNodesSucceeded({
  execution,
  nodeRuns
}) {
  const plannedNodeIds = execution.plan.node_ids ?? [];

  if (plannedNodeIds.length === 0) {
    return false;
  }

  return plannedNodeIds.every((nodeId) =>
    nodeRuns.some(
      (nodeRun) =>
        nodeRun.node_id === nodeId &&
        nodeRun.status === WORKFLOW_NODE_RUN_STATUSES.SUCCESS
    )
  );
}

function replaceNodeRun({
  node_runs,
  nodeRun
}) {
  const existingIndex = node_runs.findIndex(
    (entry) => entry.node_id === nodeRun.node_id && entry.attempt === nodeRun.attempt
  );

  if (existingIndex === -1) {
    return [...node_runs, nodeRun];
  }

  return node_runs.map((entry, index) =>
    index === existingIndex ? nodeRun : entry
  );
}

function replaceTraceSpan({
  trace_spans,
  traceSpan
}) {
  const existingIndex = trace_spans.findIndex((entry) => entry.id === traceSpan.id);

  if (existingIndex === -1) {
    return [...trace_spans, traceSpan];
  }

  return trace_spans.map((entry, index) =>
    index === existingIndex ? traceSpan : entry
  );
}

function aggregateNodeRunUsage(nodeRuns) {
  return sumWorkflowTokenUsageRecords(nodeRuns.map((nodeRun) => nodeRun.usage ?? {}));
}

function aggregateNodeRunCost(nodeRuns) {
  return sumWorkflowCostRecords(nodeRuns.map((nodeRun) => nodeRun.cost ?? {}));
}

function redactSnapshot(snapshot, secretValues) {
  return redactSecrets(snapshot, { secretValues });
}

function resolveDefaultMode(triggerSource) {
  return triggerSource === WORKFLOW_TRIGGER_SOURCES.WEBHOOK
    ? WORKFLOW_EXECUTION_MODES.WEBHOOK
    : WORKFLOW_EXECUTION_MODES.MANUAL;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Workflow execution operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createWorkflowExecutionService requires ${name}.${method}().`);
    }
  }
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createWorkflowExecutionService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}

function calculateDurationMs(startedAt, finishedAt) {
  return Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
}
