import {
  WORKFLOW_QUEUE_JOB_STATUSES,
  WorkflowQueuePolicyValidationError,
  completeWorkflowQueueJob,
  createWorkflowQueueSummary,
  failWorkflowQueueJob
} from "../domain/workflowQueuePolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createWorkflowQueueService({
  queueRepository,
  workerActorIds = [],
  clock = () => new Date()
} = {}) {
  assertRepository(queueRepository, "queueRepository", [
    "findById",
    "findAll",
    "claimNext",
    "save"
  ]);

  const workers = new Set(normalizeStringArray(workerActorIds, "workerActorIds"));

  return Object.freeze({
    async listJobs({
      actor,
      status = null,
      type = null
    } = {}) {
      requireWorkerPermission({ actor, workers });

      return queueRepository.findAll({ status, type });
    },

    async getQueueSummary({
      actor
    } = {}) {
      requireWorkerPermission({ actor, workers });

      return createWorkflowQueueSummary({
        jobs: await queueRepository.findAll(),
        at: nowIso(clock)
      });
    },

    async leaseNextJob({
      actor,
      worker_id = null,
      type = null,
      lease_duration_ms = 60000
    } = {}) {
      const actorId = requireWorkerPermission({ actor, workers });
      const workerId = normalizeOptionalWorkerId(worker_id) ?? actorId;

      return queueRepository.claimNext({
        worker_id: workerId,
        lease_duration_ms,
        type,
        at: nowIso(clock)
      });
    },

    async completeJob({
      actor,
      job_id
    } = {}) {
      requireWorkerPermission({ actor, workers });

      const job = await requireJob(queueRepository, job_id);
      const completed = completeWorkflowQueueJob({
        job,
        completed_at: nowIso(clock)
      });

      return queueRepository.save(completed);
    },

    async failJob({
      actor,
      job_id,
      error,
      retry_delay_ms = 0
    } = {}) {
      requireWorkerPermission({ actor, workers });

      const job = await requireJob(queueRepository, job_id);
      const failed = failWorkflowQueueJob({
        job,
        error,
        failed_at: nowIso(clock),
        retry_delay_ms
      });

      return queueRepository.save(failed);
    }
  });
}

async function requireJob(queueRepository, jobId) {
  const normalizedJobId = normalizeRequiredString(jobId, "Queue job id");
  const job = await queueRepository.findById(normalizedJobId);

  if (!job) {
    throw new WorkflowQueuePolicyValidationError(
      "Queue job was not found.",
      {
        code: "workflow_queue_job_not_found",
        details: { job_id: normalizedJobId }
      }
    );
  }

  if (
    [
      WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED,
      WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED,
      WORKFLOW_QUEUE_JOB_STATUSES.CANCELLED
    ].includes(job.status)
  ) {
    throw new WorkflowQueuePolicyValidationError(
      "Queue job is already terminal.",
      {
        code: "workflow_queue_job_terminal",
        details: { job_id: normalizedJobId, status: job.status }
      }
    );
  }

  return job;
}

function requireWorkerPermission({
  actor,
  workers
}) {
  const actorId = resolveActorId(actor);

  if (workers.size === 0) {
    throw new AuthorizationError(
      "Workflow queue operations require configured worker actors.",
      "workflow_queue_worker_required"
    );
  }

  if (!workers.has(actorId)) {
    throw new AuthorizationError(
      "User does not have workflow queue worker permission.",
      "workflow_queue_worker_forbidden"
    );
  }

  return actorId;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Workflow queue operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function normalizeOptionalWorkerId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, "Queue worker_id");
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createWorkflowQueueService requires ${name}.${method}().`);
    }
  }
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
