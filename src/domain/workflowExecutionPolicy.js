export const WORKFLOW_EXECUTION_STATUSES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled"
});

export const WORKFLOW_NODE_RUN_STATUSES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled"
});

export const WORKFLOW_TRIGGER_SOURCES = Object.freeze({
  MANUAL: "manual",
  WEBHOOK: "webhook",
  SCHEDULE: "schedule",
  SUB_WORKFLOW: "sub-workflow"
});

export const WORKFLOW_EXECUTION_MODES = Object.freeze({
  MANUAL: "manual",
  PRODUCTION: "production",
  WEBHOOK: "webhook"
});

const TERMINAL_EXECUTION_STATUSES = Object.freeze([
  WORKFLOW_EXECUTION_STATUSES.SUCCESS,
  WORKFLOW_EXECUTION_STATUSES.FAILED,
  WORKFLOW_EXECUTION_STATUSES.CANCELLED
]);
const TERMINAL_NODE_RUN_STATUSES = Object.freeze([
  WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
  WORKFLOW_NODE_RUN_STATUSES.FAILED,
  WORKFLOW_NODE_RUN_STATUSES.SKIPPED,
  WORKFLOW_NODE_RUN_STATUSES.CANCELLED
]);

export class WorkflowExecutionValidationError extends Error {
  constructor(message, {
    code = "workflow_execution_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "WorkflowExecutionValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createWorkflowExecutionRecord({
  id,
  workflow_id,
  workflow_version,
  project_id,
  status = WORKFLOW_EXECUTION_STATUSES.QUEUED,
  trigger_source = WORKFLOW_TRIGGER_SOURCES.MANUAL,
  mode = WORKFLOW_EXECUTION_MODES.MANUAL,
  started_by,
  partial_of_execution_id = null,
  rerun_from_node_id = null,
  input = {},
  output = null,
  error = null,
  failed_node_id = null,
  node_runs = [],
  plan = {},
  metadata = {},
  started_at,
  finished_at = null,
  duration_ms = null,
  created_at = started_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Execution id"),
    workflow_id: normalizeRequiredString(workflow_id, "Execution workflow_id"),
    workflow_version: normalizePositiveInteger(workflow_version, "Execution workflow_version"),
    project_id: normalizeRequiredString(project_id, "Execution project_id"),
    status: normalizeEnum(status, WORKFLOW_EXECUTION_STATUSES, "Execution status"),
    trigger_source: normalizeEnum(
      trigger_source,
      WORKFLOW_TRIGGER_SOURCES,
      "Execution trigger_source"
    ),
    mode: normalizeEnum(mode, WORKFLOW_EXECUTION_MODES, "Execution mode"),
    started_by: normalizeRequiredString(started_by, "Execution started_by"),
    partial_of_execution_id: normalizeNullableString(
      partial_of_execution_id,
      "Execution partial_of_execution_id"
    ),
    rerun_from_node_id: normalizeNullableString(
      rerun_from_node_id,
      "Execution rerun_from_node_id"
    ),
    input: normalizePlainObject(input, "Execution input"),
    output: normalizeNullablePlainObject(output, "Execution output"),
    error: normalizeNullableError(error, "Execution error"),
    failed_node_id: normalizeNullableString(failed_node_id, "Execution failed_node_id"),
    node_runs: normalizeArray(node_runs, "Execution node_runs"),
    plan: normalizePlainObject(plan, "Execution plan"),
    metadata: normalizePlainObject(metadata, "Execution metadata"),
    started_at: normalizeTimestamp(started_at, "Execution started_at"),
    finished_at: normalizeNullableTimestamp(finished_at, "Execution finished_at"),
    duration_ms: normalizeNullableNonNegativeInteger(duration_ms, "Execution duration_ms"),
    created_at: normalizeTimestamp(created_at, "Execution created_at"),
    updated_at: normalizeTimestamp(updated_at, "Execution updated_at")
  });
}

export function createWorkflowNodeRunRecord({
  id,
  execution_id,
  node_id,
  status = WORKFLOW_NODE_RUN_STATUSES.QUEUED,
  attempt = 1,
  input = null,
  output = null,
  error = null,
  started_at = null,
  finished_at = null,
  duration_ms = null
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Node run id"),
    execution_id: normalizeRequiredString(execution_id, "Node run execution_id"),
    node_id: normalizeRequiredString(node_id, "Node run node_id"),
    status: normalizeEnum(status, WORKFLOW_NODE_RUN_STATUSES, "Node run status"),
    attempt: normalizePositiveInteger(attempt, "Node run attempt"),
    input: normalizeNullablePlainObject(input, "Node run input"),
    output: normalizeNullablePlainObject(output, "Node run output"),
    error: normalizeNullableError(error, "Node run error"),
    started_at: normalizeNullableTimestamp(started_at, "Node run started_at"),
    finished_at: normalizeNullableTimestamp(finished_at, "Node run finished_at"),
    duration_ms: normalizeNullableNonNegativeInteger(duration_ms, "Node run duration_ms")
  });
}

export function assertExecutionBelongsToProjectWorkflow({
  execution,
  project_id,
  workflow_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");
  const workflowId = normalizeRequiredString(workflow_id, "Workflow id");

  if (!execution || execution.project_id !== projectId || execution.workflow_id !== workflowId) {
    throw new WorkflowExecutionValidationError(
      "Execution is not available for this project workflow.",
      {
        code: "workflow_execution_not_in_project_workflow",
        details: { project_id: projectId, workflow_id: workflowId }
      }
    );
  }

  return execution;
}

export function isTerminalExecutionStatus(status) {
  return TERMINAL_EXECUTION_STATUSES.includes(status);
}

export function isTerminalNodeRunStatus(status) {
  return TERMINAL_NODE_RUN_STATUSES.includes(status);
}

export function normalizeExecutionError(error) {
  return normalizeNullableError(error, "Execution error");
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new WorkflowExecutionValidationError(`${field} is not supported.`, {
      code: "workflow_execution_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WorkflowExecutionValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new WorkflowExecutionValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeNullableNonNegativeInteger(value, field) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new WorkflowExecutionValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new WorkflowExecutionValidationError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowExecutionValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeNullablePlainObject(value, field) {
  if (value === null) {
    return null;
  }

  return normalizePlainObject(value, field);
}

function normalizeNullableError(value, field) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return { message: value };
  }

  return normalizePlainObject(value, field);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowExecutionValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
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
