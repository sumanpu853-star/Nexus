import assert from "node:assert/strict";
import test from "node:test";
import { createWorkflowQueueService } from "../../src/application/workflowQueueService.js";
import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  WORKFLOW_QUEUE_JOB_TYPES,
  createWorkflowQueueJobRecord
} from "../../src/domain/workflowQueuePolicy.js";
import {
  createRedisWorkflowQueueRepository
} from "../../src/infrastructure/redisWorkflowQueueRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("redis workflow queue repository stores, filters, and claims jobs", async () => {
  const redisClient = createFakeRedisClient();
  const queueRepository = createRedisWorkflowQueueRepository({ redisClient });
  const lowPriority = createJob({
    id: "job_low",
    priority: 100,
    idempotency_key: "low"
  });
  const highPriority = createJob({
    id: "job_high",
    priority: 10,
    idempotency_key: "high"
  });

  await queueRepository.save(lowPriority);
  await queueRepository.save(highPriority);

  const queueService = createWorkflowQueueService({
    queueRepository,
    workerActorIds: ["worker_1"],
    clock: () => new Date(timestamp)
  });
  const leased = await queueService.leaseNextJob({
    actor: { id: "worker_1" },
    worker_id: "worker_1",
    lease_duration_ms: 60000
  });
  const completed = await queueService.completeJob({
    actor: { id: "worker_1" },
    job_id: leased.id
  });
  const summary = await queueService.getQueueSummary({
    actor: { id: "worker_1" }
  });

  assert.equal(leased.id, "job_high");
  assert.equal(leased.status, WORKFLOW_QUEUE_JOB_STATUSES.LEASED);
  assert.equal(completed.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
  assert.equal(summary.status_counts.completed, 1);
  assert.equal(summary.status_counts.queued, 1);
  assert.equal(redisClient.lockCount, 1);
});

test("redis workflow queue repository enforces idempotency keys", async () => {
  const queueRepository = createRedisWorkflowQueueRepository({
    redisClient: createFakeRedisClient()
  });

  await queueRepository.save(createJob({ id: "job_1", idempotency_key: "same" }));

  await assert.rejects(
    () => queueRepository.save(createJob({ id: "job_2", idempotency_key: "same" })),
    /idempotency_key/
  );
  assert.equal((await queueRepository.findByIdempotencyKey("same")).id, "job_1");
});

function createJob({
  id,
  priority = 100,
  idempotency_key
}) {
  return createWorkflowQueueJobRecord({
    id,
    type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
    priority,
    idempotency_key,
    payload: {
      project_id: "project_1",
      workflow_id: "workflow_1",
      execution_id: id.replace("job", "execution")
    },
    available_at: timestamp,
    created_at: timestamp
  });
}

function createFakeRedisClient() {
  const values = new Map();
  const sets = new Map();

  return {
    lockCount: 0,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async del(key) {
      values.delete(key);
    },
    async sAdd(key, value) {
      const set = sets.get(key) ?? new Set();
      set.add(value);
      sets.set(key, set);
    },
    async sMembers(key) {
      return [...(sets.get(key) ?? new Set())];
    },
    async withLock(_key, callback) {
      this.lockCount += 1;

      return callback();
    }
  };
}
