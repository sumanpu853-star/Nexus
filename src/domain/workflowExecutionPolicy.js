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

export const WORKFLOW_NODE_LOG_LEVELS = Object.freeze({
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
});

export const WORKFLOW_TRACE_SPAN_KINDS = Object.freeze({
  WORKFLOW: "workflow",
  NODE: "node",
  TOOL: "tool",
  MODEL: "model",
  INTEGRATION: "integration"
});

export const WORKFLOW_TRACE_SPAN_STATUSES = Object.freeze({
  OK: "ok",
  ERROR: "error"
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
  usage = {},
  cost = {},
  trace_spans = [],
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
    node_runs: normalizeNodeRunArray(node_runs, "Execution node_runs"),
    plan: normalizePlainObject(plan, "Execution plan"),
    metadata: normalizePlainObject(metadata, "Execution metadata"),
    usage: createWorkflowTokenUsageRecord(usage),
    cost: createWorkflowCostRecord(cost),
    trace_spans: normalizeTraceSpanArray(trace_spans, "Execution trace_spans"),
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
  logs = [],
  usage = {},
  cost = {},
  trace_span_id = null,
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
    logs: normalizeNodeRunLogs(logs, "Node run logs"),
    usage: createWorkflowTokenUsageRecord(usage),
    cost: createWorkflowCostRecord(cost),
    trace_span_id: normalizeNullableString(trace_span_id, "Node run trace_span_id"),
    started_at: normalizeNullableTimestamp(started_at, "Node run started_at"),
    finished_at: normalizeNullableTimestamp(finished_at, "Node run finished_at"),
    duration_ms: normalizeNullableNonNegativeInteger(duration_ms, "Node run duration_ms")
  });
}

export function createWorkflowTokenUsageRecord({
  input_tokens = 0,
  output_tokens = 0,
  total_tokens
} = {}) {
  const normalizedInputTokens = normalizeNonNegativeInteger(input_tokens, "Token usage input_tokens");
  const normalizedOutputTokens = normalizeNonNegativeInteger(output_tokens, "Token usage output_tokens");
  const inferredTotalTokens = normalizedInputTokens + normalizedOutputTokens;
  const normalizedTotalTokens =
    total_tokens === undefined
      ? inferredTotalTokens
      : normalizeNonNegativeInteger(total_tokens, "Token usage total_tokens");

  if (normalizedTotalTokens !== inferredTotalTokens) {
    throw new WorkflowExecutionValidationError(
      "Token usage total_tokens must equal input_tokens plus output_tokens.",
      {
        code: "workflow_execution_token_usage_invalid",
        details: {
          input_tokens: normalizedInputTokens,
          output_tokens: normalizedOutputTokens,
          total_tokens: normalizedTotalTokens
        }
      }
    );
  }

  return deepFreeze({
    input_tokens: normalizedInputTokens,
    output_tokens: normalizedOutputTokens,
    total_tokens: normalizedTotalTokens
  });
}

export function createWorkflowCostRecord({
  amount = 0,
  currency = "USD"
} = {}) {
  return deepFreeze({
    amount: normalizeNonNegativeNumber(amount, "Workflow cost amount"),
    currency: normalizeCurrency(currency)
  });
}

export function createWorkflowTraceSpanRecord({
  id,
  execution_id,
  node_id = null,
  parent_span_id = null,
  name,
  kind = WORKFLOW_TRACE_SPAN_KINDS.NODE,
  status = WORKFLOW_TRACE_SPAN_STATUSES.OK,
  started_at,
  finished_at = null,
  duration_ms = null,
  attributes = {}
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Trace span id"),
    execution_id: normalizeRequiredString(execution_id, "Trace span execution_id"),
    node_id: normalizeNullableString(node_id, "Trace span node_id"),
    parent_span_id: normalizeNullableString(parent_span_id, "Trace span parent_span_id"),
    name: normalizeRequiredString(name, "Trace span name"),
    kind: normalizeEnum(kind, WORKFLOW_TRACE_SPAN_KINDS, "Trace span kind"),
    status: normalizeEnum(status, WORKFLOW_TRACE_SPAN_STATUSES, "Trace span status"),
    started_at: normalizeTimestamp(started_at, "Trace span started_at"),
    finished_at: normalizeNullableTimestamp(finished_at, "Trace span finished_at"),
    duration_ms: normalizeNullableNonNegativeInteger(duration_ms, "Trace span duration_ms"),
    attributes: normalizePlainObject(attributes, "Trace span attributes")
  });
}

export function sumWorkflowTokenUsageRecords(records = []) {
  const totals = normalizeArray(records, "Token usage records")
    .map((record) => createWorkflowTokenUsageRecord(record))
    .reduce(
      (accumulator, record) => ({
        input_tokens: accumulator.input_tokens + record.input_tokens,
        output_tokens: accumulator.output_tokens + record.output_tokens
      }),
      { input_tokens: 0, output_tokens: 0 }
    );

  return createWorkflowTokenUsageRecord(totals);
}

export function sumWorkflowCostRecords(records = []) {
  const normalizedRecords = normalizeArray(records, "Workflow cost records")
    .map((record) => createWorkflowCostRecord(record));
  const currency = normalizedRecords[0]?.currency ?? "USD";

  for (const record of normalizedRecords) {
    if (record.currency !== currency) {
      throw new WorkflowExecutionValidationError(
        "Workflow cost records must use one currency.",
        {
          code: "workflow_execution_cost_currency_mismatch",
          details: { expected: currency, actual: record.currency }
        }
      );
    }
  }

  return createWorkflowCostRecord({
    amount: roundNumber(
      normalizedRecords.reduce((total, record) => total + record.amount, 0)
    ),
    currency
  });
}

export function createWorkflowNodeLogRecord({
  id,
  execution_id,
  node_id,
  level = WORKFLOW_NODE_LOG_LEVELS.INFO,
  message,
  timestamp,
  metadata = {}
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Node log id"),
    execution_id: normalizeRequiredString(execution_id, "Node log execution_id"),
    node_id: normalizeRequiredString(node_id, "Node log node_id"),
    level: normalizeEnum(level, WORKFLOW_NODE_LOG_LEVELS, "Node log level"),
    message: normalizeRequiredString(message, "Node log message"),
    timestamp: normalizeTimestamp(timestamp, "Node log timestamp"),
    metadata: normalizePlainObject(metadata, "Node log metadata")
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

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new WorkflowExecutionValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeNonNegativeNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WorkflowExecutionValidationError(`${field} must be a non-negative number.`);
  }

  return roundNumber(value);
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

function normalizeNodeRunArray(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowExecutionValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => createWorkflowNodeRunRecord(entry));
}

function normalizeNodeRunLogs(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowExecutionValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => createWorkflowNodeLogRecord(entry));
}

function normalizeTraceSpanArray(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowExecutionValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => createWorkflowTraceSpanRecord(entry));
}

function normalizeCurrency(value) {
  const normalized = normalizeRequiredString(value, "Workflow cost currency").toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new WorkflowExecutionValidationError("Workflow cost currency must be a 3-letter ISO code.");
  }

  return normalized;
}

function roundNumber(value) {
  return Number(value.toFixed(6));
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
