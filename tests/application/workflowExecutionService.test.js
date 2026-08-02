import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_LOG_LEVELS,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRIGGER_SOURCES
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  WORKFLOW_QUEUE_JOB_TYPES
} from "../../src/domain/workflowQueuePolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkflowQueueRepository
} from "../../src/infrastructure/inMemoryWorkflowQueueRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("queueWorkflowExecution stores a redacted execution plan for runnable workflow nodes", async () => {
  const { repositories, workflow, executionService } = await createWorkflowFixture();

  await executionService.queueWorkflowExecution({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  }).then(
    () => assert.fail("viewer should not be able to run workflows"),
    (error) => assert.match(error.message, /required project permission/)
  );

  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.WEBHOOK,
    input: {
      prompt: "summarize secret-token",
      token: "secret-token"
    },
    secretValues: ["secret-token"],
    metadata: { request_id: "req_1" }
  });

  assert.equal(execution.status, WORKFLOW_EXECUTION_STATUSES.QUEUED);
  assert.equal(execution.mode, "webhook");
  assert.deepEqual(execution.input, {
    prompt: "summarize [REDACTED]",
    token: "[REDACTED]"
  });
  assert.deepEqual(execution.plan.node_ids, ["manual", "http", "notify"]);
  assert.deepEqual(execution.plan.error_branches, [
    {
      edge_id: "http_to_error",
      source_node_id: "http",
      target_node_id: "error_notify"
    }
  ]);
  assert.deepEqual(
    execution.node_runs.map((nodeRun) => [nodeRun.node_id, nodeRun.status]),
    [
      ["manual", WORKFLOW_NODE_RUN_STATUSES.QUEUED],
      ["http", WORKFLOW_NODE_RUN_STATUSES.QUEUED],
      ["notify", WORKFLOW_NODE_RUN_STATUSES.QUEUED]
    ]
  );
  assert.equal((await repositories.executions.findByWorkflowId(workflow.id)).length, 1);
});

test("recordNodeRunResult updates execution status and redacts node snapshots", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const running = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "manual",
    status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
    output: { next: "http" }
  });

  assert.equal(running.status, WORKFLOW_EXECUTION_STATUSES.RUNNING);
  assert.equal(running.node_runs[0].status, WORKFLOW_NODE_RUN_STATUSES.SUCCESS);

  const failed = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    input: { authorization: "Bearer secret-token" },
    error: { message: "HTTP 500 for secret-token", token: "secret-token" },
    secretValues: ["secret-token"]
  });

  assert.equal(failed.status, WORKFLOW_EXECUTION_STATUSES.FAILED);
  assert.equal(failed.failed_node_id, "http");
  assert.deepEqual(failed.error, {
    message: "HTTP 500 for [REDACTED]",
    token: "[REDACTED]"
  });
  assert.deepEqual(failed.node_runs[1].input, {
    authorization: "[REDACTED]"
  });
  await assert.rejects(
    () =>
      executionService.recordNodeRunResult({
        actor: { id: "owner_1" },
        project_id: workflow.project_id,
        execution_id: failed.id,
        node_id: "notify",
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS
      }),
    (error) => {
      assert.equal(error.name, "WorkflowExecutionValidationError");
      assert.equal(error.code, "workflow_execution_already_terminal");
      return true;
    }
  );
});

test("queueWorkflowExecution enqueues workflow queue jobs when configured", async () => {
  const workflowQueueRepository = createInMemoryWorkflowQueueRepository();
  const { workflow, executionService } = await createWorkflowFixture({
    workflowQueueRepository
  });
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.SCHEDULE
  });
  const failed = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500"
  });
  const partial = await executionService.queuePartialWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    source_execution_id: failed.id
  });

  const jobs = await workflowQueueRepository.findAll();

  assert.deepEqual(
    jobs.map((job) => [job.type, job.payload.execution_id]),
    [
      [WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION, execution.id],
      [WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION, partial.id]
    ]
  );
  assert.equal(jobs[0].idempotency_key, `workflow_execution:${execution.id}`);
  assert.equal(jobs[0].payload.trigger_source, WORKFLOW_TRIGGER_SOURCES.SCHEDULE);
  assert.equal(jobs[1].payload.partial_of_execution_id, failed.id);
});

test("recordNodeRunResult rolls up token usage, cost, and trace spans", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const updated = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
    usage: {
      input_tokens: 30,
      output_tokens: 12
    },
    cost: {
      amount: 0.0042
    },
    trace: {
      name: "HTTP upstream call",
      kind: WORKFLOW_TRACE_SPAN_KINDS.INTEGRATION,
      attributes: {
        url: "https://example.com/api",
        authorization: "Bearer secret-token"
      }
    },
    secretValues: ["secret-token"]
  });
  const httpRun = updated.node_runs.find((nodeRun) => nodeRun.node_id === "http");

  assert.deepEqual(updated.usage, {
    input_tokens: 30,
    output_tokens: 12,
    total_tokens: 42
  });
  assert.deepEqual(updated.cost, {
    amount: 0.0042,
    currency: "USD"
  });
  assert.equal(updated.trace_spans.length, 1);
  assert.equal(updated.trace_spans[0].kind, WORKFLOW_TRACE_SPAN_KINDS.INTEGRATION);
  assert.deepEqual(updated.trace_spans[0].attributes, {
    url: "https://example.com/api",
    authorization: "[REDACTED]"
  });
  assert.equal(httpRun.trace_span_id, updated.trace_spans[0].id);
});

test("queuePartialWorkflowExecution queues only the failed node and downstream success path", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });
  const failed = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "Request timed out"
  });

  const partial = await executionService.queuePartialWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    source_execution_id: failed.id,
    input: { retry: true }
  });

  assert.equal(partial.partial_of_execution_id, failed.id);
  assert.equal(partial.rerun_from_node_id, "http");
  assert.deepEqual(partial.plan.node_ids, ["http", "notify"]);
  assert.deepEqual(
    partial.node_runs.map((nodeRun) => nodeRun.node_id),
    ["http", "notify"]
  );
});

test("recordNodeRunLog stores redacted node-level logs and starts queued runs", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const updated = await executionService.recordNodeRunLog({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    level: WORKFLOW_NODE_LOG_LEVELS.INFO,
    message: "Calling API with secret-token",
    metadata: {
      authorization: "Bearer secret-token",
      attempt: 1
    },
    secretValues: ["secret-token"]
  });
  const httpRun = updated.node_runs.find((nodeRun) => nodeRun.node_id === "http");

  assert.equal(updated.status, WORKFLOW_EXECUTION_STATUSES.RUNNING);
  assert.equal(httpRun.status, WORKFLOW_NODE_RUN_STATUSES.RUNNING);
  assert.equal(httpRun.logs[0].message, "Calling API with [REDACTED]");
  assert.deepEqual(httpRun.logs[0].metadata, {
    authorization: "[REDACTED]",
    attempt: 1
  });
});

test("listWorkflowExecutionHistory and getWorkflowExecutionTimeline expose execution diagnostics", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });
  const running = await executionService.recordNodeRunLog({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    message: "Calling API"
  });
  await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: running.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500"
  });

  const history = await executionService.listWorkflowExecutionHistory({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    status: WORKFLOW_EXECUTION_STATUSES.FAILED
  });
  const timeline = await executionService.getWorkflowExecutionTimeline({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    execution_id: execution.id
  });

  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].failed_node_id, "http");
  assert.equal(history.items[0].log_count, 1);
  assert.deepEqual(
    timeline.events.map((event) => event.type),
    ["execution_queued", "node_started", "node_log", "node_finished", "execution_finished"]
  );
});

test("getWorkflowExecutionObservability exposes aggregate metrics to project viewers", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });
  await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500",
    usage: {
      input_tokens: 20,
      output_tokens: 5
    },
    cost: {
      amount: 0.002
    },
    trace: {
      name: "HTTP upstream call",
      kind: WORKFLOW_TRACE_SPAN_KINDS.INTEGRATION
    }
  });

  const observability = await executionService.getWorkflowExecutionObservability({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  assert.equal(observability.execution_count, 1);
  assert.equal(observability.status_counts.failed, 1);
  assert.equal(observability.failure_rate, 1);
  assert.deepEqual(observability.token_usage, {
    input_tokens: 20,
    output_tokens: 5,
    total_tokens: 25
  });
  assert.deepEqual(observability.cost, {
    amount: 0.002,
    currency: "USD"
  });
  assert.equal(observability.trace_summary.status_counts.error, 1);
  assert.equal(observability.node_metrics[0].node_id, "http");
});

test("getWorkflowExecutionDashboard exposes filtered dashboard data to project viewers", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.WEBHOOK
  });
  await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500",
    usage: {
      input_tokens: 10,
      output_tokens: 2
    },
    cost: {
      amount: 0.001
    }
  });

  const dashboard = await executionService.getWorkflowExecutionDashboard({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    filters: {
      status: WORKFLOW_EXECUTION_STATUSES.FAILED,
      node_id: "http"
    }
  });

  assert.equal(dashboard.execution_count, 1);
  assert.equal(dashboard.summary.failure_rate, 1);
  assert.equal(dashboard.top_failing_nodes[0].node_id, "http");
  assert.deepEqual(dashboard.token_usage_by_status.failed, {
    input_tokens: 10,
    output_tokens: 2,
    total_tokens: 12
  });
  await assert.rejects(
    () =>
      executionService.getWorkflowExecutionDashboard({
        actor: { id: "viewer_1" },
        project_id: workflow.project_id,
        workflow_id: workflow.id,
        filters: { status: "done" }
      }),
    /not supported/
  );
});

test("listWorkflowExecutions allows project viewers to inspect execution history", async () => {
  const { workflow, executionService } = await createWorkflowFixture();
  await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const executions = await executionService.listWorkflowExecutions({
    actor: { id: "viewer_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  assert.equal(executions.length, 1);
  assert.equal(executions[0].workflow_id, workflow.id);
});

async function createWorkflowFixture({
  workflowQueueRepository = null
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
    workflowQueueRepository,
    idGenerator,
    clock: () => new Date(timestamp)
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
    name: "HTTP With Error Branch",
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
      },
      {
        id: "error_notify",
        type: "slack",
        parameters: { channel: "#ops", message: "Failed" }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http" },
      { id: "http_to_notify", source: "http", target: "notify" },
      { id: "http_to_error", source: "http", target: "error_notify", type: "error" }
    ]
  });

  return {
    repositories,
    workflow,
    executionService
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
