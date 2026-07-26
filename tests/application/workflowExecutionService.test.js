import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES
} from "../../src/domain/workflowExecutionPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

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

async function createWorkflowFixture() {
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
      { id: "http", type: "http_request" },
      { id: "notify", type: "slack" },
      { id: "error_notify", type: "slack" }
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
