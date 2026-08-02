export const WORKFLOW_QUEUE_JOB_TYPES = Object.freeze({
  WORKFLOW_EXECUTION: "workflow_execution",
  WEBHOOK_DELIVERY: "webhook_delivery",
  SCHEDULE_TRIGGER: "schedule_trigger",
  INTEGRATION_INVOCATION: "integration_invocation",
  AGENT_RUN: "agent_run"
});

export const WORKFLOW_QUEUE_JOB_STATUSES = Object.freeze({
  QUEUED: "queued",
  LEASED: "leased",
  COMPLETED: "completed",
  DEAD_LETTERED: "dead_lettered",
  CANCELLED: "cancelled"
});

const RAW_SECRET_PAYLOAD_KEYS = new Set([
  "api_key",
  "access_token",
  "refresh_token",
  "token",
  "password",
  "secret",
  "client_secret",
  "private_key",
  "connection_string"
]);

export class WorkflowQueuePolicyValidationError extends Error {
  constructor(message, {
    code = "workflow_queue_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "WorkflowQueuePolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createWorkflowQueueJobRecord({
  id,
  type,
  status = WORKFLOW_QUEUE_JOB_STATUSES.QUEUED,
  priority = 100,
  idempotency_key,
  payload = {},
  attempts = 0,
  max_attempts = 3,
  available_at,
  leased_by = null,
  leased_at = null,
  lease_expires_at = null,
  completed_at = null,
  failed_at = null,
  last_error = null,
  created_at,
  updated_at = created_at
} = {}) {
  const normalizedPayload = normalizePlainObject(payload, "Queue job payload");

  assertNoRawSecretPayload(normalizedPayload);

  const normalizedStatus = normalizeEnum(
    status,
    WORKFLOW_QUEUE_JOB_STATUSES,
    "Queue job status"
  );
  const normalizedAttempts = normalizeNonNegativeInteger(
    attempts,
    "Queue job attempts"
  );
  const normalizedMaxAttempts = normalizePositiveInteger(
    max_attempts,
    "Queue job max_attempts"
  );
  const job = {
    id: normalizeRequiredString(id, "Queue job id"),
    type: normalizeEnum(type, WORKFLOW_QUEUE_JOB_TYPES, "Queue job type"),
    status: normalizedStatus,
    priority: normalizeNonNegativeInteger(priority, "Queue job priority"),
    idempotency_key: normalizeRequiredString(
      idempotency_key,
      "Queue job idempotency_key"
    ),
    payload: normalizedPayload,
    attempts: normalizedAttempts,
    max_attempts: normalizedMaxAttempts,
    available_at: normalizeTimestamp(available_at, "Queue job available_at"),
    leased_by: normalizeNullableRequiredString(leased_by, "Queue job leased_by"),
    leased_at: normalizeNullableTimestamp(leased_at, "Queue job leased_at"),
    lease_expires_at: normalizeNullableTimestamp(
      lease_expires_at,
      "Queue job lease_expires_at"
    ),
    completed_at: normalizeNullableTimestamp(
      completed_at,
      "Queue job completed_at"
    ),
    failed_at: normalizeNullableTimestamp(failed_at, "Queue job failed_at"),
    last_error: normalizeNullableError(last_error, "Queue job last_error"),
    created_at: normalizeTimestamp(created_at, "Queue job created_at"),
    updated_at: normalizeTimestamp(updated_at, "Queue job updated_at")
  };

  validateQueueJobState(job);

  return deepFreeze(job);
}

export function createWorkflowExecutionJobPayload({
  project_id,
  workflow_id,
  execution_id,
  trigger_source,
  mode,
  partial_of_execution_id = null,
  rerun_from_node_id = null
} = {}) {
  return deepFreeze({
    project_id: normalizeRequiredString(
      project_id,
      "Workflow execution queue payload project_id"
    ),
    workflow_id: normalizeRequiredString(
      workflow_id,
      "Workflow execution queue payload workflow_id"
    ),
    execution_id: normalizeRequiredString(
      execution_id,
      "Workflow execution queue payload execution_id"
    ),
    trigger_source: normalizeRequiredString(
      trigger_source,
      "Workflow execution queue payload trigger_source"
    ),
    mode: normalizeRequiredString(mode, "Workflow execution queue payload mode"),
    partial_of_execution_id: normalizeNullableRequiredString(
      partial_of_execution_id,
      "Workflow execution queue payload partial_of_execution_id"
    ),
    rerun_from_node_id: normalizeNullableRequiredString(
      rerun_from_node_id,
      "Workflow execution queue payload rerun_from_node_id"
    )
  });
}

export function leaseWorkflowQueueJob({
  job,
  worker_id,
  leased_at,
  lease_duration_ms = 60000
} = {}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const timestamp = normalizeTimestamp(leased_at, "Queue job leased_at");
  const duration = normalizePositiveInteger(
    lease_duration_ms,
    "Queue job lease_duration_ms"
  );

  if (!isWorkflowQueueJobRunnable({ job: normalizedJob, at: timestamp })) {
    throw new WorkflowQueuePolicyValidationError(
      "Queue job is not runnable.",
      {
        code: "workflow_queue_job_not_runnable",
        details: { job_id: normalizedJob.id, status: normalizedJob.status }
      }
    );
  }

  return createWorkflowQueueJobRecord({
    ...normalizedJob,
    status: WORKFLOW_QUEUE_JOB_STATUSES.LEASED,
    attempts: normalizedJob.attempts + 1,
    leased_by: worker_id,
    leased_at: timestamp,
    lease_expires_at: addMilliseconds(timestamp, duration),
    updated_at: timestamp
  });
}

export function completeWorkflowQueueJob({
  job,
  completed_at
} = {}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const timestamp = normalizeTimestamp(completed_at, "Queue job completed_at");

  if (normalizedJob.status !== WORKFLOW_QUEUE_JOB_STATUSES.LEASED) {
    throw new WorkflowQueuePolicyValidationError(
      "Only leased queue jobs can be completed.",
      {
        code: "workflow_queue_job_not_leased",
        details: { job_id: normalizedJob.id, status: normalizedJob.status }
      }
    );
  }

  return createWorkflowQueueJobRecord({
    ...normalizedJob,
    status: WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED,
    completed_at: timestamp,
    leased_by: null,
    leased_at: null,
    lease_expires_at: null,
    updated_at: timestamp
  });
}

export function failWorkflowQueueJob({
  job,
  error,
  failed_at,
  retry_delay_ms = 0
} = {}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const timestamp = normalizeTimestamp(failed_at, "Queue job failed_at");
  const retryDelay = normalizeNonNegativeInteger(
    retry_delay_ms,
    "Queue job retry_delay_ms"
  );

  if (normalizedJob.status !== WORKFLOW_QUEUE_JOB_STATUSES.LEASED) {
    throw new WorkflowQueuePolicyValidationError(
      "Only leased queue jobs can be failed.",
      {
        code: "workflow_queue_job_not_leased",
        details: { job_id: normalizedJob.id, status: normalizedJob.status }
      }
    );
  }

  const exhausted = normalizedJob.attempts >= normalizedJob.max_attempts;

  return createWorkflowQueueJobRecord({
    ...normalizedJob,
    status: exhausted
      ? WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED
      : WORKFLOW_QUEUE_JOB_STATUSES.QUEUED,
    available_at: exhausted
      ? normalizedJob.available_at
      : addMilliseconds(timestamp, retryDelay),
    leased_by: null,
    leased_at: null,
    lease_expires_at: null,
    failed_at: timestamp,
    last_error: normalizeNullableError(error, "Queue job last_error"),
    updated_at: timestamp
  });
}

export function cancelWorkflowQueueJob({
  job,
  cancelled_at
} = {}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const timestamp = normalizeTimestamp(cancelled_at, "Queue job cancelled_at");

  if (
    [
      WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED,
      WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED
    ].includes(normalizedJob.status)
  ) {
    throw new WorkflowQueuePolicyValidationError(
      "Terminal queue jobs cannot be cancelled.",
      {
        code: "workflow_queue_job_terminal",
        details: { job_id: normalizedJob.id, status: normalizedJob.status }
      }
    );
  }

  return createWorkflowQueueJobRecord({
    ...normalizedJob,
    status: WORKFLOW_QUEUE_JOB_STATUSES.CANCELLED,
    leased_by: null,
    leased_at: null,
    lease_expires_at: null,
    updated_at: timestamp
  });
}

export function isWorkflowQueueJobRunnable({
  job,
  at
} = {}) {
  const normalizedJob = createWorkflowQueueJobRecord(job);
  const timestamp = normalizeTimestamp(at, "Queue job runnable timestamp");

  return (
    normalizedJob.status === WORKFLOW_QUEUE_JOB_STATUSES.QUEUED &&
    Date.parse(normalizedJob.available_at) <= Date.parse(timestamp) &&
    normalizedJob.attempts < normalizedJob.max_attempts
  );
}

export function createWorkflowQueueSummary({
  jobs = [],
  at
} = {}) {
  const timestamp = normalizeTimestamp(at, "Queue summary timestamp");
  const normalizedJobs = normalizeArray(jobs, "Queue jobs").map((job) =>
    createWorkflowQueueJobRecord(job)
  );
  const status_counts = {};
  const type_counts = {};

  for (const status of Object.values(WORKFLOW_QUEUE_JOB_STATUSES)) {
    status_counts[status] = 0;
  }

  for (const type of Object.values(WORKFLOW_QUEUE_JOB_TYPES)) {
    type_counts[type] = 0;
  }

  for (const job of normalizedJobs) {
    status_counts[job.status] += 1;
    type_counts[job.type] += 1;
  }

  return deepFreeze({
    total_jobs: normalizedJobs.length,
    runnable_jobs: normalizedJobs.filter((job) =>
      isWorkflowQueueJobRunnable({ job, at: timestamp })
    ).length,
    leased_jobs: status_counts[WORKFLOW_QUEUE_JOB_STATUSES.LEASED],
    dead_lettered_jobs: status_counts[WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED],
    status_counts,
    type_counts
  });
}

function validateQueueJobState(job) {
  if (job.attempts > job.max_attempts) {
    throw new WorkflowQueuePolicyValidationError(
      "Queue job attempts cannot exceed max_attempts.",
      {
        code: "workflow_queue_attempts_exceeded",
        details: { attempts: job.attempts, max_attempts: job.max_attempts }
      }
    );
  }

  if (job.status === WORKFLOW_QUEUE_JOB_STATUSES.LEASED) {
    if (!job.leased_by || !job.leased_at || !job.lease_expires_at) {
      throw new WorkflowQueuePolicyValidationError(
        "Leased queue jobs must include lease metadata.",
        {
          code: "workflow_queue_lease_metadata_required",
          details: { job_id: job.id }
        }
      );
    }

    return;
  }

  if (job.status === WORKFLOW_QUEUE_JOB_STATUSES.COMPLETED && !job.completed_at) {
    throw new WorkflowQueuePolicyValidationError(
      "Completed queue jobs must include completed_at.",
      {
        code: "workflow_queue_completed_at_required",
        details: { job_id: job.id }
      }
    );
  }

  if (job.status === WORKFLOW_QUEUE_JOB_STATUSES.DEAD_LETTERED && !job.failed_at) {
    throw new WorkflowQueuePolicyValidationError(
      "Dead-lettered queue jobs must include failed_at.",
      {
        code: "workflow_queue_failed_at_required",
        details: { job_id: job.id }
      }
    );
  }

  if (job.leased_by || job.leased_at || job.lease_expires_at) {
    throw new WorkflowQueuePolicyValidationError(
      "Only leased queue jobs can include lease metadata.",
      {
        code: "workflow_queue_lease_metadata_forbidden",
        details: { job_id: job.id, status: job.status }
      }
    );
  }
}

function assertNoRawSecretPayload(payload, path = "payload") {
  if (payload === null || payload === undefined) {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((entry, index) =>
      assertNoRawSecretPayload(entry, `${path}[${index}]`)
    );
    return;
  }

  if (typeof payload !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (
      RAW_SECRET_PAYLOAD_KEYS.has(key.toLowerCase()) &&
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      throw new WorkflowQueuePolicyValidationError(
        "Queue job payloads must not store raw secret values.",
        {
          code: "workflow_queue_raw_secret_forbidden",
          details: { field: `${path}.${key}` }
        }
      );
    }

    assertNoRawSecretPayload(value, `${path}.${key}`);
  }
}

function addMilliseconds(timestamp, milliseconds) {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new WorkflowQueuePolicyValidationError(`${field} is not supported.`, {
      code: "workflow_queue_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WorkflowQueuePolicyValidationError(
      `${field} must be a non-empty string.`
    );
  }

  return value.trim();
}

function normalizeNullableRequiredString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new WorkflowQueuePolicyValidationError(
      `${field} must be a non-negative integer.`
    );
  }

  return value;
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new WorkflowQueuePolicyValidationError(
      `${field} must be a positive integer.`
    );
  }

  return value;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowQueuePolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeNullableError(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return { message: value };
  }

  return normalizePlainObject(value, field);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowQueuePolicyValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new WorkflowQueuePolicyValidationError(
      `${field} must be an ISO timestamp.`
    );
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
