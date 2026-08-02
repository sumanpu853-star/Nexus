import assert from "node:assert/strict";
import test from "node:test";
import { createAgentService } from "../../src/application/agentService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import {
  WORKFLOW_EXECUTION_WORKER_RUN_STATUSES,
  createWorkflowExecutionWorkerService
} from "../../src/application/workflowExecutionWorkerService.js";
import { createWorkflowQueueService } from "../../src/application/workflowQueueService.js";
import {
  AGENT_TOOL_TYPES
} from "../../src/domain/agentPolicy.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_NODE_RUN_STATUSES
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  createWorkflowQueueJobRecord
} from "../../src/domain/workflowQueuePolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createAgentWorkflowNodeRunner
} from "../../src/infrastructure/agentWorkflowNodeRunner.js";
import {
  createWorkflowRunAgentTool
} from "../../src/infrastructure/agentWorkflowTools.js";
import {
  createDeterministicAgentModelProvider
} from "../../src/infrastructure/deterministicAgentModelProvider.js";
import {
  createInMemoryWorkflowQueueRepository
} from "../../src/infrastructure/inMemoryWorkflowQueueRepository.js";
import {
  createDeterministicWorkflowNodeRunner
} from "../../src/infrastructure/deterministicWorkflowNodeRunner.js";
import {
  createInMemoryAgentRepositories
} from "../../src/infrastructure/inMemoryAgentRepositories.js";
import {
  createInMemoryAgentToolRegistry
} from "../../src/infrastructure/inMemoryAgentToolRegistry.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow execution worker runs queued workflow execution jobs to success", async () => {
  const { repositories, workflow, executionService, workerService } =
    await createWorkerFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const run = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const updatedExecution = await repositories.executions.findById(execution.id);

  assert.equal(run.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED);
  assert.deepEqual(run.processed_node_ids, ["manual", "http", "notify"]);
  assert.equal(run.job.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
  assert.equal(updatedExecution.status, WORKFLOW_EXECUTION_STATUSES.SUCCESS);
  assert.deepEqual(
    updatedExecution.node_runs.map((nodeRun) => [nodeRun.node_id, nodeRun.status]),
    [
      ["manual", WORKFLOW_NODE_RUN_STATUSES.SUCCESS],
      ["http", WORKFLOW_NODE_RUN_STATUSES.SUCCESS],
      ["notify", WORKFLOW_NODE_RUN_STATUSES.SUCCESS]
    ]
  );
});

test("workflow execution worker runs persisted agent nodes and workflow tools", async () => {
  const repositories = createInMemorySecurityRepositories();
  const agentRepositories = createInMemoryAgentRepositories();
  const queueRepository = createInMemoryWorkflowQueueRepository();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const executionService = createWorkflowExecutionService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    executionRepository: repositories.executions,
    workflowQueueRepository: queueRepository,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const queueService = createWorkflowQueueService({
    queueRepository,
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });
  const agentService = createAgentService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    agentRepository: agentRepositories.agents,
    promptVersionRepository: agentRepositories.promptVersions,
    agentRunRepository: agentRepositories.agentRuns,
    agentMemoryRepository: agentRepositories.agentMemories,
    modelProvider: createDeterministicAgentModelProvider(),
    toolRegistry: createInMemoryAgentToolRegistry([
      createWorkflowRunAgentTool({ workflowExecutionService: executionService })
    ]),
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const childWorkflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Child Agent Tool Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });
  const { agent } = await agentService.createAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Workflow Calling Agent",
    instructions: "Call approved workflow tools when requested.",
    model: {
      input_token_cost_per_1k: 5,
      output_token_cost_per_1k: 10
    },
    tools: [
      {
        name: "run_workflow",
        type: AGENT_TOOL_TYPES.WORKFLOW
      }
    ]
  });
  const parentWorkflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Parent Agent Workflow",
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "agent",
        type: "agent",
        parameters: {
          agent_id: agent.id,
          instructions: "Use the persisted agent configuration.",
          tool_call_visibility: true
        }
      }
    ],
    edges: [
      { id: "manual_to_agent", source: "manual", target: "agent" }
    ]
  });
  const workerService = createWorkflowExecutionWorkerService({
    workflowQueueService: queueService,
    workflowRepository: repositories.workflows,
    executionRepository: repositories.executions,
    workflowExecutionService: executionService,
    nodeRunner: createAgentWorkflowNodeRunner({ agentService }),
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: parentWorkflow.id,
    input: {
      prompt: "Queue the child workflow.",
      tool_requests: [
        {
          tool_name: "run_workflow",
          input: {
            workflow_id: childWorkflow.id,
            input: { prompt: "Child workflow input" }
          }
        }
      ]
    }
  });

  const run = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const updatedExecution = await repositories.executions.findById(execution.id);
  const childExecutions = await repositories.executions.findByWorkflowId(childWorkflow.id);
  const agentRuns = await agentRepositories.agentRuns.findByAgentId(agent.id);
  const agentNodeRun = updatedExecution.node_runs.find((nodeRun) =>
    nodeRun.node_id === "agent"
  );

  assert.equal(run.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED);
  assert.deepEqual(run.processed_node_ids, ["manual", "agent"]);
  assert.equal(updatedExecution.status, WORKFLOW_EXECUTION_STATUSES.SUCCESS);
  assert.equal(agentRuns.length, 1);
  assert.equal(agentRuns[0].tool_calls[0].tool_name, "run_workflow");
  assert.equal(childExecutions.length, 1);
  assert.equal(childExecutions[0].metadata.parent_agent_id, agent.id);
  assert.equal(agentNodeRun.output.tool_calls[0].status, "completed");
  assert.equal(agentNodeRun.output.tool_results[0].output.execution_id, childExecutions[0].id);
  assert.equal(updatedExecution.usage.total_tokens > 0, true);
  assert.equal(updatedExecution.cost.amount > 0, true);
  assert.equal(
    updatedExecution.trace_spans.some((span) => span.kind === WORKFLOW_TRACE_SPAN_KINDS.MODEL),
    true
  );
});

test("workflow execution worker records node failures and completes processed jobs", async () => {
  const { repositories, workflow, executionService, workerService } =
    await createWorkerFixture({
      nodeRunner: createDeterministicWorkflowNodeRunner({
        handlers: {
          http_request: () => {
            throw new Error("HTTP 500");
          }
        }
      })
    });
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const run = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const updatedExecution = await repositories.executions.findById(execution.id);

  assert.equal(run.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.EXECUTION_FAILED);
  assert.deepEqual(run.processed_node_ids, ["manual", "http"]);
  assert.equal(run.job.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
  assert.equal(updatedExecution.status, WORKFLOW_EXECUTION_STATUSES.FAILED);
  assert.equal(updatedExecution.failed_node_id, "http");
  assert.deepEqual(updatedExecution.error, { message: "HTTP 500" });
});

test("workflow execution worker honors failed node runner results", async () => {
  const { repositories, workflow, executionService, workerService } =
    await createWorkerFixture({
      nodeRunner: createDeterministicWorkflowNodeRunner({
        handlers: {
          http: () => ({
            status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
            output: { blocked: true },
            error: { message: "Policy blocked" }
          })
        }
      })
    });
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const run = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const updatedExecution = await repositories.executions.findById(execution.id);
  const httpRun = updatedExecution.node_runs.find((nodeRun) =>
    nodeRun.node_id === "http"
  );

  assert.equal(run.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.EXECUTION_FAILED);
  assert.deepEqual(run.processed_node_ids, ["manual", "http"]);
  assert.equal(updatedExecution.failed_node_id, "http");
  assert.deepEqual(updatedExecution.error, { message: "Policy blocked" });
  assert.deepEqual(httpRun.output, { blocked: true });
});

test("workflow execution worker retries and dead-letters infrastructure failures", async () => {
  const queueRepository = createInMemoryWorkflowQueueRepository();
  const { executionService, workflow, workerService } = await createWorkerFixture({
    queueRepository,
    queueClock: sequenceClock([
      timestamp,
      timestamp,
      "2026-07-26T00:00:30.000Z",
      "2026-07-26T00:00:30.000Z"
    ]),
    nodeRunner: createDeterministicWorkflowNodeRunner({
      handlers: {
        manual: () => {
          const error = new Error("Worker transport failed");
          error.queue_failure = true;
          throw error;
        }
      }
    }),
    retry_delay_ms: 30000
  });
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });
  const job = (await queueRepository.findAll())[0];

  await queueRepository.save(
    createWorkflowQueueJobRecord({
      ...job,
      max_attempts: 2
    })
  );

  const firstRun = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const secondRun = await workerService.runNextWorkflowExecution({
    actor: { id: "worker_1" }
  });
  const queuedExecution = await queueRepository.findById(job.id);

  assert.equal(firstRun.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.RETRY_SCHEDULED);
  assert.equal(firstRun.job.available_at, "2026-07-26T00:00:30.000Z");
  assert.equal(secondRun.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.DEAD_LETTERED);
  assert.equal(secondRun.job.status, WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED);
  assert.equal(queuedExecution.attempts, 2);
  assert.equal(firstRun.execution.id, execution.id);
});

test("workflow execution worker runs until idle and gates worker actors", async () => {
  const { workflow, executionService, workerService } = await createWorkerFixture();

  await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const result = await workerService.runWorkflowExecutionsUntilIdle({
    actor: { id: "worker_1" },
    limit: 5
  });

  assert.equal(result.processed_jobs, 1);
  assert.equal(result.idle, true);
  assert.deepEqual(
    result.runs.map((run) => run.status),
    [
      WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED,
      WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.IDLE
    ]
  );
  await assert.rejects(
    () =>
      workerService.runNextWorkflowExecution({
        actor: { id: "viewer_1" }
      }),
    /workflow execution worker permission/
  );
});

async function createWorkerFixture({
  queueRepository = createInMemoryWorkflowQueueRepository(),
  queueClock = () => new Date(timestamp),
  workerClock = () => new Date(timestamp),
  nodeRunner = createDeterministicWorkflowNodeRunner(),
  retry_delay_ms = 30000
} = {}) {
  const repositories = createInMemorySecurityRepositories();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const executionService = createWorkflowExecutionService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    executionRepository: repositories.executions,
    workflowQueueRepository: queueRepository,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const queueService = createWorkflowQueueService({
    queueRepository,
    workerActorIds: ["worker_1"],
    clock: queueClock
  });
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });

  await workflowService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  const workflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Worker Runtime Workflow",
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "http",
        type: "http_request",
        parameters: { url: "https://example.com/api" }
      },
      {
        id: "notify",
        type: "slack",
        parameters: { channel: "#ops", message: "Done" }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http" },
      { id: "http_to_notify", source: "http", target: "notify" }
    ]
  });

  return {
    repositories,
    workflow,
    executionService,
    queueRepository,
    workerService: createWorkflowExecutionWorkerService({
      workflowQueueService: queueService,
      workflowRepository: repositories.workflows,
      executionRepository: repositories.executions,
      workflowExecutionService: executionService,
      nodeRunner,
      workerActorIds: ["worker_1"],
      retry_delay_ms,
      clock: workerClock
    })
  };
}

function sequenceIds() {
  const counters = new Map();

  return {
    nextId(prefix) {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);

      return `${prefix}_${next}`;
    }
  };
}

function sequenceClock(values) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;

    return new Date(value);
  };
}
