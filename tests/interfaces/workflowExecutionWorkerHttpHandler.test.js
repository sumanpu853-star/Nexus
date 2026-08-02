import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import {
  WORKFLOW_EXECUTION_WORKER_RUN_STATUSES,
  createWorkflowExecutionWorkerService
} from "../../src/application/workflowExecutionWorkerService.js";
import { createWorkflowQueueService } from "../../src/application/workflowQueueService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkflowQueueRepository
} from "../../src/infrastructure/inMemoryWorkflowQueueRepository.js";
import {
  createDeterministicWorkflowNodeRunner
} from "../../src/infrastructure/deterministicWorkflowNodeRunner.js";
import {
  createWorkflowExecutionWorkerHttpHandler
} from "../../src/interfaces/workflowExecutionWorkerHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow execution worker http handler runs workflow jobs", async () => {
  const { workflow, executionService, handler } =
    await createWorkflowExecutionWorkerHandlerFixture();

  await executionService.queueWorkflowExecution({
    actor: { id: "owner_1" },
    project_id: workflow.project_id,
    workflow_id: workflow.id
  });

  const run = await handler.handle({
    actor: { id: "worker_1" },
    method: "POST",
    path: "/workflow-workers/run-next",
    body: { worker_id: "worker_runtime_1" }
  });
  const untilIdle = await handler.handle({
    actor: { id: "worker_1" },
    method: "POST",
    path: "/workflow-workers/run-until-idle",
    body: { limit: 3 }
  });

  assert.equal(run.status, 200);
  assert.equal(run.body.run.status, WORKFLOW_EXECUTION_WORKER_RUN_STATUSES.COMPLETED);
  assert.deepEqual(run.body.run.processed_node_ids, ["manual", "http"]);
  assert.equal(untilIdle.status, 200);
  assert.equal(untilIdle.body.result.idle, true);
});

test("workflow execution worker http handler maps auth failures", async () => {
  const { handler } = await createWorkflowExecutionWorkerHandlerFixture();
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "POST",
    path: "/workflow-workers/run-next"
  });

  assert.equal(forbidden.status, 403);
});

async function createWorkflowExecutionWorkerHandlerFixture() {
  const repositories = createInMemorySecurityRepositories();
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
    name: "Worker HTTP Workflow",
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "http",
        type: "http_request",
        parameters: { url: "https://example.com/api" }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http" }
    ]
  });
  const workerService = createWorkflowExecutionWorkerService({
    workflowQueueService: queueService,
    workflowRepository: repositories.workflows,
    executionRepository: repositories.executions,
    workflowExecutionService: executionService,
    nodeRunner: createDeterministicWorkflowNodeRunner(),
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });

  return {
    workflow,
    executionService,
    handler: createWorkflowExecutionWorkerHttpHandler({
      workflowExecutionWorkerService: workerService
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
