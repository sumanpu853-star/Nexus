import assert from "node:assert/strict";
import test from "node:test";
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

test("in-memory workflow queue repository saves and clones jobs", async () => {
  const repository = createInMemoryWorkflowQueueRepository();
  const job = createQueueJob({
    id: "queue_job_1",
    execution_id: "execution_1"
  });

  await repository.save(job);

  const found = await repository.findById("queue_job_1");
  const duplicate = await repository.findByIdempotencyKey(
    "workflow_execution:execution_1"
  );

  found.payload.execution_id = "mutated";

  assert.equal(duplicate.id, "queue_job_1");
  assert.equal((await repository.findById("queue_job_1")).payload.execution_id, "execution_1");
  await assert.rejects(
    () =>
      repository.save(
        createQueueJob({
          id: "queue_job_2",
          execution_id: "execution_1"
        })
      ),
    /idempotency_key/
  );
});

test("in-memory workflow queue repository claims runnable jobs by priority", async () => {
  const repository = createInMemoryWorkflowQueueRepository({
    jobs: [
      createQueueJob({
        id: "queue_job_later",
        execution_id: "execution_later",
        priority: 1,
        available_at: "2026-07-26T00:10:00.000Z"
      }),
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

  const runnable = await repository.findRunnable({ at: timestamp });
  const claimed = await repository.claimNext({
    worker_id: "worker_1",
    lease_duration_ms: 60000,
    at: timestamp
  });

  assert.deepEqual(
    runnable.map((job) => job.id),
    ["queue_job_high", "queue_job_low"]
  );
  assert.equal(claimed.id, "queue_job_high");
  assert.equal(claimed.status, WORKFLOW_QUEUE_JOB_STATUSES.LEASED);
  assert.equal((await repository.findRunnable({ at: timestamp })).length, 1);
});

function createQueueJob({
  id,
  execution_id,
  priority = 100,
  available_at = timestamp
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
    available_at,
    created_at: timestamp
  });
}
