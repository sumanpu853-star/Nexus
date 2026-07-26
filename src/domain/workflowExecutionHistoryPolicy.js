import {
  WORKFLOW_NODE_RUN_STATUSES
} from "./workflowExecutionPolicy.js";

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 100;

export function createWorkflowExecutionHistory({
  executions = [],
  status = null,
  trigger_source = null,
  started_by = null,
  limit = DEFAULT_HISTORY_LIMIT,
  cursor = null
} = {}) {
  const executionSummaries = normalizeExecutionList(executions)
    .map((execution) => createWorkflowExecutionSummary(execution))
    .filter((summary) =>
      matchesNullableFilter(summary.status, status, "Execution history status") &&
      matchesNullableFilter(
        summary.trigger_source,
        trigger_source,
        "Execution history trigger_source"
      ) &&
      matchesNullableFilter(summary.started_by, started_by, "Execution history started_by")
    )
    .sort(compareHistorySummaries);
  const pageLimit = normalizeLimit(limit);
  const cursorId = normalizeNullableString(cursor, "Execution history cursor");
  const startIndex = cursorId
    ? Math.max(
      0,
      executionSummaries.findIndex((summary) => summary.id === cursorId) + 1
    )
    : 0;
  const items = executionSummaries.slice(startIndex, startIndex + pageLimit);
  const nextCursor =
    startIndex + pageLimit < executionSummaries.length
      ? items.at(-1)?.id ?? null
      : null;

  return deepFreeze({
    items,
    page_info: {
      limit: pageLimit,
      next_cursor: nextCursor,
      total: executionSummaries.length
    }
  });
}

export function createWorkflowExecutionSummary(execution = {}) {
  const nodeRuns = normalizeNodeRuns(execution.node_runs);
  const nodeStatusCounts = countNodeRunStatuses(nodeRuns);
  const logCount = nodeRuns.reduce(
    (total, nodeRun) => total + normalizeNodeLogs(nodeRun.logs).length,
    0
  );

  return deepFreeze({
    id: normalizeRequiredString(execution.id, "Execution id"),
    workflow_id: normalizeRequiredString(execution.workflow_id, "Execution workflow_id"),
    workflow_version: normalizePositiveInteger(
      execution.workflow_version,
      "Execution workflow_version"
    ),
    project_id: normalizeRequiredString(execution.project_id, "Execution project_id"),
    status: normalizeRequiredString(execution.status, "Execution status"),
    trigger_source: normalizeRequiredString(
      execution.trigger_source,
      "Execution trigger_source"
    ),
    mode: normalizeRequiredString(execution.mode, "Execution mode"),
    started_by: normalizeRequiredString(execution.started_by, "Execution started_by"),
    partial_of_execution_id: normalizeNullableString(
      execution.partial_of_execution_id,
      "Execution partial_of_execution_id"
    ),
    rerun_from_node_id: normalizeNullableString(
      execution.rerun_from_node_id,
      "Execution rerun_from_node_id"
    ),
    failed_node_id: normalizeNullableString(
      execution.failed_node_id,
      "Execution failed_node_id"
    ),
    started_at: normalizeTimestamp(execution.started_at, "Execution started_at"),
    finished_at: normalizeNullableTimestamp(
      execution.finished_at,
      "Execution finished_at"
    ),
    duration_ms: normalizeNullableNonNegativeInteger(
      execution.duration_ms,
      "Execution duration_ms"
    ),
    updated_at: normalizeTimestamp(execution.updated_at, "Execution updated_at"),
    node_count: nodeRuns.length,
    node_status_counts: nodeStatusCounts,
    log_count: logCount,
    retry_count: countRetries(nodeRuns),
    has_error_branch: normalizeErrorBranches(execution.plan?.error_branches).length > 0
  });
}

export function createWorkflowExecutionTimeline({
  execution
} = {}) {
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) {
    throw new TypeError("Workflow execution timeline requires an execution object.");
  }

  const events = [
    createTimelineEvent({
      type: "execution_queued",
      timestamp: normalizeTimestamp(execution.created_at, "Execution created_at"),
      execution_id: normalizeRequiredString(execution.id, "Execution id"),
      status: execution.status
    })
  ];

  for (const nodeRun of normalizeNodeRuns(execution.node_runs)) {
    if (nodeRun.started_at) {
      events.push(
        createTimelineEvent({
          type: "node_started",
          timestamp: nodeRun.started_at,
          execution_id: execution.id,
          node_id: nodeRun.node_id,
          attempt: nodeRun.attempt,
          status: nodeRun.status
        })
      );
    }

    for (const log of normalizeNodeLogs(nodeRun.logs)) {
      events.push(
        createTimelineEvent({
          type: "node_log",
          timestamp: log.timestamp,
          execution_id: execution.id,
          node_id: nodeRun.node_id,
          attempt: nodeRun.attempt,
          level: log.level,
          message: log.message,
          metadata: log.metadata
        })
      );
    }

    if (nodeRun.finished_at) {
      events.push(
        createTimelineEvent({
          type: "node_finished",
          timestamp: nodeRun.finished_at,
          execution_id: execution.id,
          node_id: nodeRun.node_id,
          attempt: nodeRun.attempt,
          status: nodeRun.status,
          duration_ms: nodeRun.duration_ms,
          error: nodeRun.error
        })
      );
    }
  }

  if (execution.finished_at) {
    events.push(
      createTimelineEvent({
        type: "execution_finished",
        timestamp: execution.finished_at,
        execution_id: execution.id,
        status: execution.status,
        duration_ms: execution.duration_ms,
        failed_node_id: execution.failed_node_id,
        error: execution.error
      })
    );
  }

  return deepFreeze({
    execution_id: normalizeRequiredString(execution.id, "Execution id"),
    events: events.sort(compareTimelineEvents)
  });
}

function createTimelineEvent(event) {
  return deepFreeze(
    Object.fromEntries(
      Object.entries(event).filter(([, value]) => value !== undefined)
    )
  );
}

function countNodeRunStatuses(nodeRuns) {
  const counts = {};

  for (const status of Object.values(WORKFLOW_NODE_RUN_STATUSES)) {
    counts[status] = 0;
  }

  for (const nodeRun of nodeRuns) {
    counts[nodeRun.status] = (counts[nodeRun.status] ?? 0) + 1;
  }

  return deepFreeze(counts);
}

function countRetries(nodeRuns) {
  return nodeRuns.filter((nodeRun) => nodeRun.attempt > 1).length;
}

function compareHistorySummaries(left, right) {
  const startedDiff = Date.parse(right.started_at) - Date.parse(left.started_at);

  if (startedDiff !== 0) {
    return startedDiff;
  }

  return right.id.localeCompare(left.id);
}

function compareTimelineEvents(left, right) {
  const timestampDiff = Date.parse(left.timestamp) - Date.parse(right.timestamp);

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return timelineEventRank(left.type) - timelineEventRank(right.type);
}

function timelineEventRank(type) {
  return {
    execution_queued: 0,
    node_started: 1,
    node_log: 2,
    node_finished: 3,
    execution_finished: 4
  }[type] ?? 99;
}

function matchesNullableFilter(actual, expected, field) {
  const normalizedExpected = normalizeNullableString(expected, field);

  return normalizedExpected === null || actual === normalizedExpected;
}

function normalizeExecutionList(executions) {
  if (!Array.isArray(executions)) {
    throw new TypeError("Execution history requires executions to be an array.");
  }

  return executions;
}

function normalizeNodeRuns(nodeRuns) {
  if (!Array.isArray(nodeRuns)) {
    throw new TypeError("Execution node_runs must be an array.");
  }

  return nodeRuns.map((nodeRun) => ({
    ...nodeRun,
    node_id: normalizeRequiredString(nodeRun?.node_id, "Node run node_id"),
    status: normalizeRequiredString(nodeRun?.status, "Node run status"),
    attempt: normalizePositiveInteger(nodeRun?.attempt, "Node run attempt"),
    logs: normalizeNodeLogs(nodeRun?.logs ?? [])
  }));
}

function normalizeNodeLogs(logs) {
  if (!Array.isArray(logs)) {
    throw new TypeError("Node run logs must be an array.");
  }

  return logs;
}

function normalizeErrorBranches(errorBranches) {
  if (errorBranches === undefined || errorBranches === null) {
    return [];
  }

  if (!Array.isArray(errorBranches)) {
    throw new TypeError("Execution plan error_branches must be an array.");
  }

  return errorBranches;
}

function normalizeLimit(value) {
  const numberValue = typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : value;

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new TypeError("Execution history limit must be a positive integer.");
  }

  return Math.min(numberValue, MAX_HISTORY_LIMIT);
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeNullableNonNegativeInteger(value, field) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
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
