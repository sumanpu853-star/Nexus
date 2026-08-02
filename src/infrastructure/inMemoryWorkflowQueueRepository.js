import {
  createWorkflowQueueJobRecord,
  isWorkflowQueueJobRunnable,
  leaseWorkflowQueueJob
} from "../domain/workflowQueuePolicy.js";

export function createInMemoryWorkflowQueueRepository(initialState = {}) {
  const jobsById = new Map();
  const jobIdByIdempotencyKey = new Map();

  for (const job of initialState.jobs ?? []) {
    saveJob(job);
  }

  return Object.freeze({
    async findById(id) {
      return cloneOrNull(jobsById.get(id));
    },

    async findByIdempotencyKey(idempotencyKey) {
      const id = jobIdByIdempotencyKey.get(idempotencyKey);

      return id ? cloneOrNull(jobsById.get(id)) : null;
    },

    async findAll({
      status = null,
      type = null
    } = {}) {
      return cloneArray(filterJobs([...jobsById.values()], { status, type }));
    },

    async findRunnable({
      type = null,
      at
    } = {}) {
      return cloneArray(
        sortRunnableJobs(
          filterJobs([...jobsById.values()], { status: null, type }).filter((job) =>
            isWorkflowQueueJobRunnable({ job, at })
          )
        )
      );
    },

    async claimNext({
      worker_id,
      lease_duration_ms,
      type = null,
      at
    } = {}) {
      const runnable = sortRunnableJobs(
        filterJobs([...jobsById.values()], { status: null, type }).filter((job) =>
          isWorkflowQueueJobRunnable({ job, at })
        )
      )[0];

      if (!runnable) {
        return null;
      }

      const leased = leaseWorkflowQueueJob({
        job: runnable,
        worker_id,
        leased_at: at,
        lease_duration_ms
      });

      saveJob(leased);

      return cloneOrNull(leased);
    },

    async save(job) {
      saveJob(job);

      return cloneOrNull(job);
    }
  });

  function saveJob(job) {
    const normalizedJob = createWorkflowQueueJobRecord(job);
    const existing = jobsById.get(normalizedJob.id);
    const existingForIdempotencyKey = jobIdByIdempotencyKey.get(
      normalizedJob.idempotency_key
    );

    if (existingForIdempotencyKey && existingForIdempotencyKey !== normalizedJob.id) {
      throw new TypeError("Queue job idempotency_key already exists.");
    }

    if (existing) {
      jobIdByIdempotencyKey.delete(existing.idempotency_key);
    }

    jobsById.set(normalizedJob.id, clone(normalizedJob));
    jobIdByIdempotencyKey.set(normalizedJob.idempotency_key, normalizedJob.id);
  }
}

function filterJobs(jobs, {
  status,
  type
}) {
  return jobs.filter(
    (job) =>
      (status === null || job.status === status) &&
      (type === null || job.type === type)
  );
}

function sortRunnableJobs(jobs) {
  return [...jobs].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const availableComparison =
      Date.parse(left.available_at) - Date.parse(right.available_at);

    if (availableComparison !== 0) {
      return availableComparison;
    }

    return Date.parse(left.created_at) - Date.parse(right.created_at);
  });
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
