import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  WORKFLOW_QUEUE_JOB_TYPES,
  completeWorkflowQueueJob,
  createWorkflowExecutionJobPayload,
  createWorkflowQueueJobRecord,
  createWorkflowQueueSummary,
  failWorkflowQueueJob,
  isWorkflowQueueJobRunnable,
  leaseWorkflowQueueJob
} from "../../src/domain/workflowQueuePolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow queue policy creates safe workflow execution jobs", () => {
  const payload = createWorkflowExecutionJobPayload({
    project_id: "project_1",
    workflow_id: "workflow_1",
    execution_id: "execution_1",
    trigger_source: "manual",
    mode: "manual"
  });
  const job = createWorkflowQueueJobRecord({
    id: "queue_job_1",
    type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
    idempotency_key: "workflow_execution:execution_1",
    payload,
    available_at: timestamp,
    created_at: timestamp
  });

  assert.equal(job.status, WORKFLOW_QUEUE_JOB_STATUSES.QUEUED);
  assert.equal(job.attempts, 0);
  assert.equal(Object.isFrozen(job.payload), true);
  assert.throws(
    () =>
      createWorkflowQueueJobRecord({
        id: "queue_job_2",
        type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
        idempotency_key: "workflow_execution:execution_2",
        payload: {
          execution_id: "execution_2",
          token: "raw-secret"
        },
        available_at: timestamp,
        created_at: timestamp
      }),
    /raw secret/
  );
});

test("workflow queue policy leases and completes runnable jobs", () => {
  const job = createQueueJob({ id: "queue_job_1" });
  const leased = leaseWorkflowQueueJob({
    job,
    worker_id: "worker_1",
    leased_at: timestamp,
    lease_duration_ms: 60000
  });
  const completed = completeWorkflowQueueJob({
    job: leased,
    completed_at: "2026-07-26T00:00:30.000Z"
  });

  assert.equal(isWorkflowQueueJobRunnable({ job, at: timestamp }), true);
  assert.equal(leased.status, WORKFLOW_QUEUE_JOB_STATUSES.LEASED);
  assert.equal(leased.attempts, 1);
  assert.equal(leased.lease_expires_at, "2026-07-26T00:01:00.000Z");
  assert.equal(
    isWorkflowQueueJobRunnable({ job: leased, at: timestamp }),
    false
  );
  assert.equal(completed.status, WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED);
  assert.equal(completed.leased_by, null);
});

test("workflow queue policy retries failed jobs before dead lettering", () => {
  const firstLease = leaseWorkflowQueueJob({
    job: createQueueJob({
      id: "queue_job_1",
      max_attempts: 2
    }),
    worker_id: "worker_1",
    leased_at: timestamp
  });
  const retry = failWorkflowQueueJob({
    job: firstLease,
    error: "Temporary failure",
    failed_at: timestamp,
    retry_delay_ms: 5000
  });
  const secondLease = leaseWorkflowQueueJob({
    job: retry,
    worker_id: "worker_1",
    leased_at: "2026-07-26T00:00:05.000Z"
  });
  const deadLettered = failWorkflowQueueJob({
    job: secondLease,
    error: { message: "Permanent failure" },
    failed_at: "2026-07-26T00:00:10.000Z"
  });

  assert.equal(retry.status, WORKFLOW_QUEUE_JOB_STATUSES.QUEUED);
  assert.equal(retry.available_at, "2026-07-26T00:00:05.000Z");
  assert.deepEqual(retry.last_error, { message: "Temporary failure" });
  assert.equal(deadLettered.status, WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED);
  assert.deepEqual(deadLettered.last_error, { message: "Permanent failure" });
});

test("workflow queue summary counts statuses, types, and runnable jobs", () => {
  const queued = createQueueJob({ id: "queue_job_1" });
  const leased = leaseWorkflowQueueJob({
    job: createQueueJob({ id: "queue_job_2" }),
    worker_id: "worker_1",
    leased_at: timestamp
  });
  const summary = createWorkflowQueueSummary({
    jobs: [queued, leased],
    at: timestamp
  });

  assert.equal(summary.total_jobs, 2);
  assert.equal(summary.runnable_jobs, 1);
  assert.equal(summary.leased_jobs, 1);
  assert.equal(summary.status_counts.queued, 1);
  assert.equal(summary.type_counts.workflow_execution, 2);
});

function createQueueJob({
  id,
  max_attempts = 3
}) {
  return createWorkflowQueueJobRecord({
    id,
    type: WORKFLOW_QUEUE_JOB_TYPES.WORKFLOW_EXECUTION,
    idempotency_key: `workflow_execution:${id}`,
    payload: createWorkflowExecutionJobPayload({
      project_id: "project_1",
      workflow_id: "workflow_1",
      execution_id: id.replace("queue_job", "execution"),
      trigger_source: "manual",
      mode: "manual"
    }),
    max_attempts,
    available_at: timestamp,
    created_at: timestamp
  });
}
