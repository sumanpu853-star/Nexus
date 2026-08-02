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

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow queue service leases highest priority runnable jobs", async () => {
  const repository = createInMemoryWorkflowQueueRepository({
    jobs: [
      createQueueJob({
        id: "queue_job_low",
        execution_id: "execution_low",
        priority: 100
      }),
      createQueueJob({
        id: "queue_job_high",
        execution_id: "execution_high",
        priority: 10
      })
    ]
  });
  const service = createWorkflowQueueService({
    queueRepository: repository,
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });

  const leased = await service.leaseNextJob({
    actor: { id: "worker_1" },
    worker_id: "worker_runtime_1"
  });
  const summary = await service.getQueueSummary({
    actor: { id: "worker_1" }
  });

  assert.equal(leased.id, "queue_job_high");
  assert.equal(leased.status, WORKFLOW_QUEUE_JOB_STATUSES.LEASED);
  assert.equal(leased.leased_by, "worker_runtime_1");
  assert.equal(summary.runnable_jobs, 1);
  assert.equal(summary.leased_jobs, 1);
});

test("workflow queue service completes and retries leased jobs", async () => {
  const repository = createInMemoryWorkflowQueueRepository({
    jobs: [
      createQueueJob({
        id: "queue_job_1",
        execution_id: "execution_1",
        max_attempts: 2
      })
    ]
  });
  const service = createWorkflowQueueService({
    queueRepository: repository,
    workerActorIds: ["worker_1"],
    clock: sequenceClock([
      timestamp,
      "2026-07-26T00:00:05.000Z",
      "2026-07-26T00:00:10.000Z",
      "2026-07-26T00:00:15.000Z"
    ])
  });

  const firstLease = await service.leaseNextJob({
    actor: { id: "worker_1" }
  });
  const retry = await service.failJob({
    actor: { id: "worker_1" },
    job_id: firstLease.id,
    error: "HTTP 503",
    retry_delay_ms: 5000
  });
  const secondLease = await service.leaseNextJob({
    actor: { id: "worker_1" }
  });
  const completed = await service.completeJob({
    actor: { id: "worker_1" },
    job_id: secondLease.id
  });

  assert.equal(retry.status, WORKFLOW_QUEUE_JOB_STATUSES.QUEUED);
  assert.equal(retry.available_at, "2026-07-26T00:00:10.000Z");
  assert.equal(secondLease.attempts, 2);
  assert.equal(completed.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
});

test("workflow queue service gates worker operations", async () => {
  const service = createWorkflowQueueService({
    queueRepository: createInMemoryWorkflowQueueRepository(),
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });

  await assert.rejects(
    () =>
      service.listJobs({
        actor: { id: "viewer_1" }
      }),
    /workflow queue worker permission/
  );
});

function createQueueJob({
  id,
  execution_id,
  priority = 100,
  max_attempts = 3
}) {
  return createWorkflowQueueJobRecord({
    id,
    type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
    priority,
    idempotency_key: `workflow_execution:${execution_id}`,
    payload: createWorkflowExecutionJobPayload({
      project_id: "project_1",
      workflow_id: "workflow_1",
      execution_id,
      trigger_source: "manual",
      mode: "manual"
    }),
    max_attempts,
    available_at: timestamp,
    created_at: timestamp
  });
}

function sequenceClock(values) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;

    return new Date(value);
  };
}
