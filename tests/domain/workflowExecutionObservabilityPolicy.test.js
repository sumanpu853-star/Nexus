import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_EXECUTION_MODES,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRACE_SPAN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES,
  createWorkflowExecutionRecord,
  createWorkflowNodeRunRecord,
  createWorkflowTraceSpanRecord
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  createWorkflowExecutionDashboard,
  createWorkflowExecutionObservabilityReport
} from "../../src/domain/workflowExecutionObservabilityPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow execution observability reports metrics, usage, cost, and traces", () => {
  const success = createExecution({
    id: "execution_1",
    status: WORKFLOW_EXECUTION_STATUSES.SUCCESS,
    duration_ms: 1000,
    finished_at: "2026-07-26T00:00:01.000Z",
    usage: { input_tokens: 100, output_tokens: 50 },
    cost: { amount: 0.03 },
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_1",
        execution_id: "execution_1",
        node_id: "agent",
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
        usage: { input_tokens: 100, output_tokens: 50 },
        cost: { amount: 0.03 },
        started_at: timestamp,
        finished_at: "2026-07-26T00:00:01.000Z",
        duration_ms: 1000
      })
    ],
    trace_spans: [
      createWorkflowTraceSpanRecord({
        id: "trace_span_1",
        execution_id: "execution_1",
        node_id: "agent",
        name: "Agent model call",
        kind: WORKFLOW_TRACE_SPAN_KINDS.MODEL,
        status: WORKFLOW_TRACE_SPAN_STATUSES.OK,
        started_at: timestamp,
        finished_at: "2026-07-26T00:00:01.000Z",
        duration_ms: 1000
      })
    ]
  });
  const failed = createExecution({
    id: "execution_2",
    status: WORKFLOW_EXECUTION_STATUSES.FAILED,
    duration_ms: 3000,
    finished_at: "2026-07-26T00:00:03.000Z",
    failed_node_id: "agent",
    usage: { input_tokens: 20, output_tokens: 10 },
    cost: { amount: 0.01 },
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_2",
        execution_id: "execution_2",
        node_id: "agent",
        status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
        usage: { input_tokens: 20, output_tokens: 10 },
        cost: { amount: 0.01 },
        started_at: timestamp,
        finished_at: "2026-07-26T00:00:03.000Z",
        duration_ms: 3000
      })
    ],
    trace_spans: [
      createWorkflowTraceSpanRecord({
        id: "trace_span_2",
        execution_id: "execution_2",
        node_id: "agent",
        name: "Agent model call",
        kind: WORKFLOW_TRACE_SPAN_KINDS.MODEL,
        status: WORKFLOW_TRACE_SPAN_STATUSES.ERROR,
        started_at: timestamp,
        finished_at: "2026-07-26T00:00:03.000Z",
        duration_ms: 3000
      })
    ]
  });

  const report = createWorkflowExecutionObservabilityReport({
    executions: [success, failed]
  });

  assert.equal(report.execution_count, 2);
  assert.equal(report.status_counts.success, 1);
  assert.equal(report.failure_rate, 0.5);
  assert.deepEqual(report.token_usage, {
    input_tokens: 120,
    output_tokens: 60,
    total_tokens: 180
  });
  assert.deepEqual(report.cost, {
    amount: 0.04,
    currency: "USD"
  });
  assert.equal(report.latency_ms.average, 2000);
  assert.equal(report.trace_summary.status_counts.error, 1);
  assert.equal(report.node_metrics[0].node_id, "agent");
  assert.equal(report.node_metrics[0].failure_rate, 0.5);
});

test("workflow execution dashboard filters and ranks failures and latency", () => {
  const success = createExecution({
    id: "execution_1",
    status: WORKFLOW_EXECUTION_STATUSES.SUCCESS,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.MANUAL,
    mode: WORKFLOW_EXECUTION_MODES.MANUAL,
    started_at: "2026-07-26T00:00:00.000Z",
    duration_ms: 500,
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_1",
        execution_id: "execution_1",
        node_id: "manual",
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
        started_at: "2026-07-26T00:00:00.000Z",
        finished_at: "2026-07-26T00:00:00.500Z",
        duration_ms: 500
      })
    ]
  });
  const failed = createExecution({
    id: "execution_2",
    status: WORKFLOW_EXECUTION_STATUSES.FAILED,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.WEBHOOK,
    mode: WORKFLOW_EXECUTION_MODES.PRODUCTION,
    started_at: "2026-07-26T00:05:00.000Z",
    finished_at: "2026-07-26T00:05:06.000Z",
    duration_ms: 6000,
    failed_node_id: "http",
    error: "HTTP 500",
    usage: { input_tokens: 15, output_tokens: 5 },
    cost: { amount: 0.004 },
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_2",
        execution_id: "execution_2",
        node_id: "http",
        status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
        usage: { input_tokens: 15, output_tokens: 5 },
        cost: { amount: 0.004 },
        started_at: "2026-07-26T00:05:00.000Z",
        finished_at: "2026-07-26T00:05:06.000Z",
        duration_ms: 6000
      })
    ]
  });
  const slow = createExecution({
    id: "execution_3",
    status: WORKFLOW_EXECUTION_STATUSES.SUCCESS,
    trigger_source: WORKFLOW_TRIGGER_SOURCES.SCHEDULE,
    mode: WORKFLOW_EXECUTION_MODES.PRODUCTION,
    started_at: "2026-07-26T00:10:00.000Z",
    finished_at: "2026-07-26T00:10:35.000Z",
    duration_ms: 35000,
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_3",
        execution_id: "execution_3",
        node_id: "agent",
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
        started_at: "2026-07-26T00:10:00.000Z",
        finished_at: "2026-07-26T00:10:35.000Z",
        duration_ms: 35000
      })
    ]
  });

  const dashboard = createWorkflowExecutionDashboard({
    executions: [success, failed, slow],
    filters: {
      trigger_source: WORKFLOW_TRIGGER_SOURCES.WEBHOOK,
      node_id: "http",
      since: "2026-07-26T00:04:00.000Z",
      until: "2026-07-26T00:06:00.000Z"
    }
  });

  assert.equal(dashboard.execution_count, 1);
  assert.equal(dashboard.status_breakdown.failed.count, 1);
  assert.equal(dashboard.latency_buckets.find((bucket) => bucket.label === "5-30s").count, 1);
  assert.deepEqual(dashboard.top_failing_nodes, [
    {
      node_id: "http",
      failures: 1,
      run_count: 1,
      failure_rate: 1
    }
  ]);
  assert.equal(dashboard.slowest_nodes[0].node_id, "http");
  assert.equal(dashboard.recent_failures[0].execution_id, "execution_2");
  assert.deepEqual(dashboard.cost_by_status.failed, {
    amount: 0.004,
    currency: "USD"
  });
  assert.deepEqual(dashboard.token_usage_by_status.failed, {
    input_tokens: 15,
    output_tokens: 5,
    total_tokens: 20
  });
});

test("workflow execution dashboard rejects unsupported filters", () => {
  assert.throws(
    () =>
      createWorkflowExecutionDashboard({
        executions: [],
        filters: { status: "done" }
      }),
    /not supported/
  );
});

function createExecution(overrides = {}) {
  return createWorkflowExecutionRecord({
    id: "execution_1",
    workflow_id: "workflow_1",
    workflow_version: 1,
    project_id: "project_1",
    status: WORKFLOW_EXECUTION_STATUSES.QUEUED,
    trigger_source: "manual",
    mode: "manual",
    started_by: "owner_1",
    partial_of_execution_id: null,
    rerun_from_node_id: null,
    input: {},
    output: null,
    error: null,
    failed_node_id: null,
    node_runs: [],
    plan: { node_ids: [], error_branches: [] },
    metadata: {},
    started_at: timestamp,
    finished_at: null,
    duration_ms: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  });
}
