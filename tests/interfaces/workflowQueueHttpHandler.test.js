import assert from "node:assert/strict";
import test from "node:test";
import { createWorkflowQueueService } from "../../src/application/workflowQueueService.js";
import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  WORKFLOW_QUEUE_JOB_TYPES,
  createWorkflowExecutionJobPayload,
  createWorkflowQueueJobRecord
} from "../../src/domain/workflowQueuePolicy.js";
import {
  createInMemoryWorkflowQueueRepository
} from "../../src/infrastructure/inMemoryWorkflowQueueRepository.js";
import {
  createWorkflowQueueHttpHandler
} from "../../src/interfaces/workflowQueueHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow queue http handler lists, leases, completes, and summarizes jobs", async () => {
  const handler = createWorkflowQueueHandlerFixture();
  const jobs = await handler.handle({
    actor: { id: "worker_1" },
    method: "GET",
    path: "/workflow-queue/jobs"
  });
  const leased = await handler.handle({
    actor: { id: "worker_1" },
    method: "POST",
    path: "/workflow-queue/jobs/lease",
    body: {
      worker_id: "worker_runtime_1"
    }
  });
  const completed = await handler.handle({
    actor: { id: "worker_1" },
    method: "POST",
    path: `/workflow-queue/jobs/${leased.body.job.id}/complete`
  });
  const summary = await handler.handle({
    actor: { id: "worker_1" },
    method: "GET",
    path: "/workflow-queue/summary"
  });

  assert.equal(jobs.status, 200);
  assert.equal(jobs.body.jobs.length, 1);
  assert.equal(leased.status, 200);
  assert.equal(leased.body.job.status, WORKFLOW_QUEUE_JOB_STATUSES.LEASED);
  assert.equal(completed.body.job.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
  assert.equal(summary.body.summary.status_counts.completed, 1);
});

test("workflow queue http handler maps validation and auth failures", async () => {
  const handler = createWorkflowQueueHandlerFixture();
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/workflow-queue/jobs"
  });
  const missing = await handler.handle({
    actor: { id: "worker_1" },
    method: "POST",
    path: "/workflow-queue/jobs/missing/complete"
  });

  assert.equal(forbidden.status, 403);
  assert.equal(missing.status, 400);
});

function createWorkflowQueueHandlerFixture() {
  const repository = createInMemoryWorkflowQueueRepository({
    jobs: [
      createWorkflowQueueJobRecord({
        id: "queue_job_1",
        type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
        idempotency_key: "workflow_execution:execution_1",
        payload: createWorkflowExecutionJobPayload({
          project_id: "project_1",
          workflow_id: "workflow_1",
          execution_id: "execution_1",
          trigger_source: "manual",
          mode: "manual"
        }),
        available_at: timestamp,
        created_at: timestamp
      })
    ]
  });
  const service = createWorkflowQueueService({
    queueRepository: repository,
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });

  return createWorkflowQueueHttpHandler({
    workflowQueueService: service
  });
}
