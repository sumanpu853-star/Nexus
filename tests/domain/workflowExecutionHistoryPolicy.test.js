import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_LOG_LEVELS,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRACE_SPAN_STATUSES,
  createWorkflowExecutionRecord,
  createWorkflowNodeLogRecord,
  createWorkflowNodeRunRecord,
  createWorkflowTraceSpanRecord
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  createWorkflowExecutionHistory,
  createWorkflowExecutionTimeline
} from "../../src/domain/workflowExecutionHistoryPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow execution history filters, sorts, and summarizes executions", () => {
  const older = createExecution({
    id: "execution_1",
    status: WORKFLOW_EXECUTION_STATUSES.SUCCESS,
    started_at: "2026-07-26T00:00:00.000Z",
    finished_at: "2026-07-26T00:00:02.000Z",
    duration_ms: 2000,
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_1",
        execution_id: "execution_1",
        node_id: "manual",
        status: WORKFLOW_NODE_RUN_STATUSES.SUCCESS,
        attempt: 1,
        started_at: timestamp,
        finished_at: timestamp,
        duration_ms: 0
      })
    ]
  });
  const newerFailed = createExecution({
    id: "execution_2",
    status: WORKFLOW_EXECUTION_STATUSES.FAILED,
    started_at: "2026-07-26T00:01:00.000Z",
    finished_at: "2026-07-26T00:01:03.000Z",
    duration_ms: 3000,
    failed_node_id: "http",
    usage: { input_tokens: 10, output_tokens: 4 },
    cost: { amount: 0.002 },
    trace_spans: [
      createWorkflowTraceSpanRecord({
        id: "trace_span_1",
        execution_id: "execution_2",
        node_id: "http",
        name: "HTTP request",
        kind: WORKFLOW_TRACE_SPAN_KINDS.INTEGRATION,
        status: WORKFLOW_TRACE_SPAN_STATUSES.ERROR,
        started_at: "2026-07-26T00:01:00.000Z",
        finished_at: "2026-07-26T00:01:03.000Z",
        duration_ms: 3000
      })
    ],
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_2",
        execution_id: "execution_2",
        node_id: "http",
        status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
        attempt: 2,
        error: "HTTP 500",
        logs: [
          createWorkflowNodeLogRecord({
            id: "node_log_1",
            execution_id: "execution_2",
            node_id: "http",
            level: WORKFLOW_NODE_LOG_LEVELS.ERROR,
            message: "HTTP request failed",
            timestamp: "2026-07-26T00:01:02.000Z"
          })
        ],
        started_at: "2026-07-26T00:01:00.000Z",
        finished_at: "2026-07-26T00:01:03.000Z",
        duration_ms: 3000
      })
    ]
  });

  const history = createWorkflowExecutionHistory({
    executions: [older, newerFailed],
    status: WORKFLOW_EXECUTION_STATUSES.FAILED,
    limit: 10
  });

  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].id, "execution_2");
  assert.equal(history.items[0].node_status_counts.failed, 1);
  assert.equal(history.items[0].log_count, 1);
  assert.equal(history.items[0].retry_count, 1);
  assert.deepEqual(history.items[0].token_usage, {
    input_tokens: 10,
    output_tokens: 4,
    total_tokens: 14
  });
  assert.deepEqual(history.items[0].cost, {
    amount: 0.002,
    currency: "USD"
  });
  assert.equal(history.items[0].trace_span_count, 1);
  assert.equal(history.page_info.total, 1);
});

test("workflow execution timeline combines execution, node, and log events", () => {
  const execution = createExecution({
    id: "execution_1",
    status: WORKFLOW_EXECUTION_STATUSES.FAILED,
    failed_node_id: "http",
    finished_at: "2026-07-26T00:00:05.000Z",
    duration_ms: 5000,
    trace_spans: [
      createWorkflowTraceSpanRecord({
        id: "trace_span_1",
        execution_id: "execution_1",
        node_id: "http",
        name: "HTTP request",
        kind: WORKFLOW_TRACE_SPAN_KINDS.INTEGRATION,
        status: WORKFLOW_TRACE_SPAN_STATUSES.ERROR,
        started_at: "2026-07-26T00:00:02.500Z",
        finished_at: "2026-07-26T00:00:05.000Z",
        duration_ms: 2500
      })
    ],
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_1",
        execution_id: "execution_1",
        node_id: "http",
        status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
        error: "HTTP 500",
        logs: [
          createWorkflowNodeLogRecord({
            id: "node_log_1",
            execution_id: "execution_1",
            node_id: "http",
            level: WORKFLOW_NODE_LOG_LEVELS.INFO,
            message: "Calling upstream API",
            timestamp: "2026-07-26T00:00:03.000Z",
            metadata: { url: "https://example.com/api" }
          })
        ],
        started_at: "2026-07-26T00:00:02.000Z",
        finished_at: "2026-07-26T00:00:05.000Z",
        duration_ms: 3000
      })
    ]
  });

  const timeline = createWorkflowExecutionTimeline({ execution });

  assert.deepEqual(
    timeline.events.map((event) => event.type),
    [
      "execution_queued",
      "node_started",
      "trace_span",
      "node_log",
      "node_finished",
      "execution_finished"
    ]
  );
  assert.equal(timeline.events[2].name, "HTTP request");
  assert.equal(timeline.events[3].message, "Calling upstream API");
  assert.equal(timeline.events[5].failed_node_id, "http");
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
