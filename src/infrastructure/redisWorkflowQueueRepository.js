import {
  createWorkflowQueueJobRecord,
  isWorkflowQueueJobRunnable,
  leaseWorkflowQueueJob
} from "../domain/workflowQueuePolicy.js";

const DEFAULT_KEY_PREFIX = "nexus:workflow-queue";

export function createRedisWorkflowQueueRepository({
  redisClient,
  keyPrefix = DEFAULT_KEY_PREFIX
} = {}) {
  assertRedisClient(redisClient);
  const prefix = normalizeRequiredString(keyPrefix, "Redis queue keyPrefix");

  return Object.freeze({
    async findById(id) {
      return readJob({
        redisClient,
        prefix,
        id
      });
    },

    async findByIdempotencyKey(idempotencyKey) {
      const normalizedKey = normalizeRequiredString(
        idempotencyKey,
        "Queue job idempotency_key"
      );
      const id = await redisClient.get(idempotencyRedisKey(prefix, normalizedKey));

      return id ? readJob({ redisClient, prefix, id }) : null;
    },

    async findAll({
      status = null,
      type = null
    } = {}) {
      const jobs = await readAllJobs({ redisClient, prefix });

      return cloneArray(filterJobs(jobs, { status, type }));
    },

    async findRunnable({
      type = null,
      at
    } = {}) {
      const jobs = await readAllJobs({ redisClient, prefix });

      return cloneArray(
        sortRunnableJobs(
          filterJobs(jobs, { status: null, type }).filter((job) =>
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
      return withRedisLock(redisClient, `${prefix}:claim-lock`, async () => {
        const runnable = sortRunnableJobs(
          filterJobs(await readAllJobs({ redisClient, prefix }), {
            status: null,
            type
          }).filter((job) => isWorkflowQueueJobRunnable({ job, at }))
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

        await saveJob({
          redisClient,
          prefix,
          job: leased
        });

        return clone(leased);
      });
    },

    async save(job) {
      const normalized = await saveJob({
        redisClient,
        prefix,
        job
      });

      return clone(normalized);
    }
  });
}

async function saveJob({
  redisClient,
  prefix,
  job
}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const existingJob = await readJob({
    redisClient,
    prefix,
    id: normalizedJob.id
  });
  const existingIdForKey = await redisClient.get(
    idempotencyRedisKey(prefix, normalizedJob.idempotency_key)
  );

  if (existingIdForKey && existingIdForKey !== normalizedJob.id) {
    throw new TypeError("Queue job idempotency_key already exists.");
  }

  if (existingJob && existingJob.idempotency_key !== normalizedJob.idempotency_key) {
    await redisClient.del(idempotencyRedisKey(prefix, existingJob.idempotency_key));
  }

  await redisClient.set(jobRedisKey(prefix, normalizedJob.id), JSON.stringify(normalizedJob));
  await redisClient.set(
    idempotencyRedisKey(prefix, normalizedJob.idempotency_key),
    normalizedJob.id
  );
  await redisClient.sAdd(indexRedisKey(prefix), normalizedJob.id);

  return normalizedJob;
}

async function readJob({
  redisClient,
  prefix,
  id
}) {
  const normalizedId = normalizeRequiredString(id, "Queue job id");
  const serialized = await redisClient.get(jobRedisKey(prefix, normalizedId));

  return serialized ? createWorkflowQueueJobRecord(JSON.parse(serialized)) : null;
}

async function readAllJobs({
  redisClient,
  prefix
}) {
  const ids = await redisClient.sMembers(indexRedisKey(prefix));
  const jobs = [];

  for (const id of ids) {
    const job = await readJob({
      redisClient,
      prefix,
      id
    });

    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

async function withRedisLock(redisClient, lockKey, callback) {
  if (typeof redisClient.withLock === "function") {
    return redisClient.withLock(lockKey, callback);
  }

  return callback();
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

function jobRedisKey(prefix, id) {
  return `${prefix}:jobs:${id}`;
}

function idempotencyRedisKey(prefix, idempotencyKey) {
  return `${prefix}:idempotency:${idempotencyKey}`;
}

function indexRedisKey(prefix) {
  return `${prefix}:index`;
}

function assertRedisClient(redisClient) {
  const methods = ["get", "set", "del", "sAdd", "sMembers"];

  for (const method of methods) {
    if (!redisClient || typeof redisClient[method] !== "function") {
      throw new TypeError(
        `createRedisWorkflowQueueRepository requires redisClient.${method}().`
      );
    }
  }
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
