import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES
} from "../../src/domain/workflowExecutionPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import { createExecutionHttpHandler } from "../../src/interfaces/executionHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("execution http handler exposes history, detail, and timeline routes", async () => {
  const { workflow, executionService, handler } = await createExecutionHandlerFixture();
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

  const history = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: `/workflows/${workflow.id}/executions`,
    query: {
      project_id: workflow.project_id,
      status: WORKFLOW_EXECUTION_STATUSES.FAILED
    }
  });
  const detail = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: `/executions/${execution.id}`,
    query: { project_id: workflow.project_id }
  });
  const timeline = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: `/executions/${execution.id}/timeline`,
    query: { project_id: workflow.project_id }
  });

  assert.equal(history.status, 200);
  assert.equal(history.body.history.items[0].id, execution.id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.execution.node_runs[1].logs[0].message, "Calling API");
  assert.equal(timeline.status, 200);
  assert.equal(
    timeline.body.timeline.events.some((event) => event.type === "node_log"),
    true
  );
});

test("execution http handler records node logs and queues failed-node reruns", async () => {
  const { workflow, executionService, handler } = await createExecutionHandlerFixture();
  const execution = await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const logged = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/executions/${execution.id}/node-runs/http/logs`,
    body: {
      project_id: workflow.project_id,
      message: "Calling API with secret-token",
      metadata: {
        authorization: "Bearer secret-token"
      },
      secretValues: ["secret-token"]
    }
  });
  const failed = await executionService.recordNodeRunResult({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    execution_id: execution.id,
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500"
  });
  const rerun = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/executions/${failed.id}/rerun`,
    body: {
      project_id: workflow.project_id,
      workflow_id: workflow.id,
      input: { retry: true }
    }
  });

  assert.equal(logged.status, 201);
  assert.equal(
    logged.body.execution.node_runs[1].logs[0].message,
    "Calling API with [REDACTED]"
  );
  assert.equal(rerun.status, 201);
  assert.deepEqual(rerun.body.execution.plan.node_ids, ["http", "notify"]);
});

async function createExecutionHandlerFixture() {
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
    workflow,
    executionService,
    handler: createExecutionHttpHandler({ workflowExecutionService: executionService })
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
