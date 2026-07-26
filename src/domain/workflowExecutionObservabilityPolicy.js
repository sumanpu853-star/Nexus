import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES,
  WORKFLOW_EXECUTION_MODES,
  createWorkflowCostRecord,
  createWorkflowTokenUsageRecord,
  sumWorkflowCostRecords,
  sumWorkflowTokenUsageRecords
} from "./workflowExecutionPolicy.js";

const LATENCY_BUCKETS = deepFreeze([
  { label: "0-1s", min_ms: 0, max_ms: 999 },
  { label: "1-5s", min_ms: 1000, max_ms: 4999 },
  { label: "5-30s", min_ms: 5000, max_ms: 29999 },
  { label: "30s+", min_ms: 30000, max_ms: null }
]);

export function createWorkflowExecutionObservabilityReport({
  executions = []
} = {}) {
  const executionList = normalizeExecutions(executions);
  const statusCounts = countStatuses(
    executionList.map((execution) => execution.status),
    WORKFLOW_EXECUTION_STATUSES
  );
  const durations = executionList
    .map((execution) => execution.duration_ms)
    .filter((duration) => Number.isInteger(duration) && duration >= 0);
  const nodeRuns = executionList.flatMap((execution) => normalizeNodeRuns(execution.node_runs));
  const traceSpans = executionList.flatMap((execution) => normalizeTraceSpans(execution.trace_spans));

  return deepFreeze({
    execution_count: executionList.length,
    status_counts: statusCounts,
    failure_rate: calculateRate(statusCounts.failed, executionList.length),
    success_rate: calculateRate(statusCounts.success, executionList.length),
    latency_ms: summarizeDurations(durations),
    token_usage: sumWorkflowTokenUsageRecords(
      executionList.map((execution) => execution.usage ?? {})
    ),
    cost: sumWorkflowCostRecords(executionList.map((execution) => execution.cost ?? {})),
    trace_summary: summarizeTraceSpans(traceSpans),
    node_metrics: summarizeNodeRuns(nodeRuns)
  });
}

export function createWorkflowExecutionDashboard({
  executions = [],
  filters = {}
} = {}) {
  const executionList = normalizeExecutions(executions);
  const normalizedFilters = normalizeDashboardFilters(filters);
  const filteredExecutions = executionList.filter((execution) =>
    matchesDashboardFilters(execution, normalizedFilters)
  );
  const nodeRuns = filteredExecutions.flatMap((execution) =>
    normalizeNodeRuns(execution.node_runs)
  );
  const report = createWorkflowExecutionObservabilityReport({
    executions: filteredExecutions
  });

  return deepFreeze({
    filters: normalizedFilters,
    execution_count: filteredExecutions.length,
    summary: report,
    status_breakdown: toBreakdown(report.status_counts, filteredExecutions.length),
    trigger_source_counts: countStatuses(
      filteredExecutions.map((execution) => execution.trigger_source),
      WORKFLOW_TRIGGER_SOURCES
    ),
    mode_counts: countStatuses(
      filteredExecutions.map((execution) => execution.mode),
      WORKFLOW_EXECUTION_MODES
    ),
    latency_buckets: createLatencyBuckets(
      filteredExecutions
        .map((execution) => execution.duration_ms)
        .filter((duration) => Number.isInteger(duration) && duration >= 0)
    ),
    top_failing_nodes: summarizeTopFailingNodes(nodeRuns),
    slowest_nodes: summarizeSlowestNodes(nodeRuns),
    recent_failures: summarizeRecentFailures(filteredExecutions),
    cost_by_status: summarizeCostByStatus(filteredExecutions),
    token_usage_by_status: summarizeTokenUsageByStatus(filteredExecutions)
  });
}

function summarizeNodeRuns(nodeRuns) {
  const nodeIds = [...new Set(nodeRuns.map((nodeRun) => nodeRun.node_id))].sort();

  return nodeIds.map((nodeId) => {
    const runs = nodeRuns.filter((nodeRun) => nodeRun.node_id === nodeId);
    const statusCounts = countStatuses(
      runs.map((nodeRun) => nodeRun.status),
      WORKFLOW_NODE_RUN_STATUSES
    );
    const durations = runs
      .map((nodeRun) => nodeRun.duration_ms)
      .filter((duration) => Number.isInteger(duration) && duration >= 0);

    return deepFreeze({
      node_id: nodeId,
      run_count: runs.length,
      status_counts: statusCounts,
      failure_rate: calculateRate(statusCounts.failed, runs.length),
      latency_ms: summarizeDurations(durations),
      token_usage: sumWorkflowTokenUsageRecords(runs.map((nodeRun) => nodeRun.usage ?? {})),
      cost: sumWorkflowCostRecords(runs.map((nodeRun) => nodeRun.cost ?? {}))
    });
  });
}

function summarizeTopFailingNodes(nodeRuns) {
  return summarizeNodeRuns(nodeRuns)
    .map((nodeMetric) => ({
      node_id: nodeMetric.node_id,
      failures: nodeMetric.status_counts.failed,
      run_count: nodeMetric.run_count,
      failure_rate: nodeMetric.failure_rate
    }))
    .filter((nodeMetric) => nodeMetric.failures > 0)
    .sort((left, right) =>
      right.failures - left.failures ||
      right.failure_rate - left.failure_rate ||
      left.node_id.localeCompare(right.node_id)
    )
    .slice(0, 5)
    .map((nodeMetric) => deepFreeze(nodeMetric));
}

function summarizeSlowestNodes(nodeRuns) {
  return summarizeNodeRuns(nodeRuns)
    .filter((nodeMetric) => nodeMetric.latency_ms.count > 0)
    .map((nodeMetric) => ({
      node_id: nodeMetric.node_id,
      run_count: nodeMetric.run_count,
      average_latency_ms: nodeMetric.latency_ms.average,
      p95_latency_ms: nodeMetric.latency_ms.p95,
      max_latency_ms: nodeMetric.latency_ms.max
    }))
    .sort((left, right) =>
      right.average_latency_ms - left.average_latency_ms ||
      right.p95_latency_ms - left.p95_latency_ms ||
      left.node_id.localeCompare(right.node_id)
    )
    .slice(0, 5)
    .map((nodeMetric) => deepFreeze(nodeMetric));
}

function summarizeRecentFailures(executions) {
  return executions
    .filter((execution) => execution.status === WORKFLOW_EXECUTION_STATUSES.FAILED)
    .sort((left, right) =>
      Date.parse(right.started_at) - Date.parse(left.started_at) ||
      right.id.localeCompare(left.id)
    )
    .slice(0, 5)
    .map((execution) =>
      deepFreeze({
        execution_id: execution.id,
        failed_node_id: execution.failed_node_id,
        started_at: execution.started_at,
        finished_at: execution.finished_at,
        duration_ms: execution.duration_ms,
        error: execution.error
      })
    );
}

function summarizeTraceSpans(traceSpans) {
  const statusCounts = countStatuses(
    traceSpans.map((span) => span.status),
    WORKFLOW_TRACE_SPAN_STATUSES
  );
  const durations = traceSpans
    .map((span) => span.duration_ms)
    .filter((duration) => Number.isInteger(duration) && duration >= 0);

  return deepFreeze({
    span_count: traceSpans.length,
    status_counts: statusCounts,
    error_rate: calculateRate(statusCounts.error, traceSpans.length),
    latency_ms: summarizeDurations(durations)
  });
}

function summarizeCostByStatus(executions) {
  const summary = {};

  for (const status of Object.values(WORKFLOW_EXECUTION_STATUSES)) {
    summary[status] = sumWorkflowCostRecords(
      executions
        .filter((execution) => execution.status === status)
        .map((execution) => execution.cost ?? {})
    );
  }

  return deepFreeze(summary);
}

function summarizeTokenUsageByStatus(executions) {
  const summary = {};

  for (const status of Object.values(WORKFLOW_EXECUTION_STATUSES)) {
    summary[status] = sumWorkflowTokenUsageRecords(
      executions
        .filter((execution) => execution.status === status)
        .map((execution) => execution.usage ?? {})
    );
  }

  return deepFreeze(summary);
}

function createLatencyBuckets(durations) {
  return LATENCY_BUCKETS.map((bucket) => {
    const count = durations.filter((duration) =>
      duration >= bucket.min_ms &&
      (bucket.max_ms === null || duration <= bucket.max_ms)
    ).length;

    return deepFreeze({
      ...bucket,
      count
    });
  });
}

function summarizeDurations(durations) {
  const sortedDurations = [...durations].sort((left, right) => left - right);
  const count = sortedDurations.length;

  if (count === 0) {
    return deepFreeze({
      count: 0,
      min: null,
      max: null,
      average: null,
      p95: null
    });
  }

  return deepFreeze({
    count,
    min: sortedDurations[0],
    max: sortedDurations.at(-1),
    average: Math.round(
      sortedDurations.reduce((total, duration) => total + duration, 0) / count
    ),
    p95: sortedDurations[Math.ceil(count * 0.95) - 1]
  });
}

function toBreakdown(counts, total) {
  return deepFreeze(
    Object.fromEntries(
      Object.entries(counts).map(([status, count]) => [
        status,
        deepFreeze({
          count,
          rate: calculateRate(count, total)
        })
      ])
    )
  );
}

function countStatuses(statuses, supportedStatuses) {
  const counts = {};

  for (const status of Object.values(supportedStatuses)) {
    counts[status] = 0;
  }

  for (const status of statuses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return deepFreeze(counts);
}

function calculateRate(count, total) {
  if (total === 0) {
    return 0;
  }

  return Number((count / total).toFixed(4));
}

function normalizeExecutions(executions) {
  if (!Array.isArray(executions)) {
    throw new TypeError("Execution observability requires executions to be an array.");
  }

  return executions.map((execution) => {
    if (!execution || typeof execution !== "object" || Array.isArray(execution)) {
      throw new TypeError("Execution observability entries must be objects.");
    }

    return {
      ...execution,
      usage: createWorkflowTokenUsageRecord(execution.usage ?? {}),
      cost: createWorkflowCostRecord(execution.cost ?? {}),
      node_runs: normalizeNodeRuns(execution.node_runs),
      trace_spans: normalizeTraceSpans(execution.trace_spans)
    };
  });
}

function normalizeDashboardFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("Execution dashboard filters must be an object.");
  }

  return deepFreeze({
    status: normalizeNullableEnum(
      filters.status,
      WORKFLOW_EXECUTION_STATUSES,
      "Execution dashboard status"
    ),
    trigger_source: normalizeNullableEnum(
      filters.trigger_source,
      WORKFLOW_TRIGGER_SOURCES,
      "Execution dashboard trigger_source"
    ),
    mode: normalizeNullableEnum(
      filters.mode,
      WORKFLOW_EXECUTION_MODES,
      "Execution dashboard mode"
    ),
    started_by: normalizeNullableString(
      filters.started_by,
      "Execution dashboard started_by"
    ),
    node_id: normalizeNullableString(filters.node_id, "Execution dashboard node_id"),
    since: normalizeNullableTimestamp(filters.since, "Execution dashboard since"),
    until: normalizeNullableTimestamp(filters.until, "Execution dashboard until")
  });
}

function matchesDashboardFilters(execution, filters) {
  return (
    matchesNullableValue(execution.status, filters.status) &&
    matchesNullableValue(execution.trigger_source, filters.trigger_source) &&
    matchesNullableValue(execution.mode, filters.mode) &&
    matchesNullableValue(execution.started_by, filters.started_by) &&
    matchesNodeFilter(execution, filters.node_id) &&
    matchesTimestampWindow(execution.started_at, filters.since, filters.until)
  );
}

function matchesNullableValue(actual, expected) {
  return expected === null || actual === expected;
}

function matchesNodeFilter(execution, nodeId) {
  if (nodeId === null) {
    return true;
  }

  return normalizeNodeRuns(execution.node_runs).some((nodeRun) => nodeRun.node_id === nodeId);
}

function matchesTimestampWindow(timestamp, since, until) {
  const value = Date.parse(timestamp);

  return (
    (since === null || value >= Date.parse(since)) &&
    (until === null || value <= Date.parse(until))
  );
}

function normalizeNodeRuns(nodeRuns) {
  if (!Array.isArray(nodeRuns)) {
    throw new TypeError("Execution node_runs must be an array.");
  }

  return nodeRuns.map((nodeRun) => ({
    ...nodeRun,
    node_id: normalizeRequiredString(nodeRun?.node_id, "Node run node_id"),
    status: normalizeRequiredString(nodeRun?.status, "Node run status"),
    usage: createWorkflowTokenUsageRecord(nodeRun?.usage ?? {}),
    cost: createWorkflowCostRecord(nodeRun?.cost ?? {})
  }));
}

function normalizeNullableEnum(value, supported, field) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeRequiredString(value, field);

  if (!Object.values(supported).includes(normalized)) {
    throw new TypeError(`${field} is not supported.`);
  }

  return normalized;
}

function normalizeNullableString(value, field) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizeNullableTimestamp(value, field) {
  const normalized = normalizeNullableString(value, field);

  if (normalized === null) {
    return null;
  }

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizeTraceSpans(traceSpans = []) {
  if (!Array.isArray(traceSpans)) {
    throw new TypeError("Execution trace_spans must be an array.");
  }

  return traceSpans.map((span) => ({
    ...span,
    status: normalizeRequiredString(span?.status, "Trace span status")
  }));
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
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
