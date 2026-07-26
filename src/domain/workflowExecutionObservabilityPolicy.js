import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_STATUSES,
  createWorkflowCostRecord,
  createWorkflowTokenUsageRecord,
  sumWorkflowCostRecords,
  sumWorkflowTokenUsageRecords
} from "./workflowExecutionPolicy.js";

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
