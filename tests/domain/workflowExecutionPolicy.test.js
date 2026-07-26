import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_EXECUTION_MODES,
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_LOG_LEVELS,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRACE_SPAN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES,
  createWorkflowCostRecord,
  createWorkflowExecutionRecord,
  createWorkflowNodeLogRecord,
  createWorkflowNodeRunRecord,
  createWorkflowTokenUsageRecord,
  createWorkflowTraceSpanRecord,
  isTerminalExecutionStatus,
  isTerminalNodeRunStatus,
  normalizeExecutionError,
  sumWorkflowCostRecords,
  sumWorkflowTokenUsageRecords
} from "../../src/domain/workflowExecutionPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow execution policy creates frozen execution records", () => {
  const execution = createWorkflowExecutionRecord({
    id: "execution_1",
    workflow_id: "workflow_1",
    workflow_version: 1,
    project_id: "project_1",
    started_by: "owner_1",
    input: { prompt: "hello" },
    node_runs: [
      createWorkflowNodeRunRecord({
        id: "node_run_1",
        execution_id: "execution_1",
        node_id: "manual"
      })
    ],
    plan: { node_ids: ["manual"], error_branches: [] },
    started_at: timestamp
  });

  assert.equal(execution.status, WORKFLOW_EXECUTION_STATUSES.QUEUED);
  assert.equal(execution.trigger_source, WORKFLOW_TRIGGER_SOURCES.MANUAL);
  assert.equal(execution.mode, WORKFLOW_EXECUTION_MODES.MANUAL);
  assert.deepEqual(execution.usage, {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  });
  assert.deepEqual(execution.cost, {
    amount: 0,
    currency: "USD"
  });
  assert.deepEqual(execution.trace_spans, []);
  assert.equal(execution.node_runs[0].status, WORKFLOW_NODE_RUN_STATUSES.QUEUED);
  assert.deepEqual(execution.node_runs[0].logs, []);
  assert.equal(Object.isFrozen(execution.node_runs[0]), true);
});

test("workflow execution policy validates usage, cost, and trace spans", () => {
  const usage = createWorkflowTokenUsageRecord({
    input_tokens: 40,
    output_tokens: 10
  });
  const cost = createWorkflowCostRecord({
    amount: 0.0123456,
    currency: "usd"
  });
  const span = createWorkflowTraceSpanRecord({
    id: "trace_span_1",
    execution_id: "execution_1",
    node_id: "agent",
    name: "Agent model call",
    kind: WORKFLOW_TRACE_SPAN_KINDS.MODEL,
    status: WORKFLOW_TRACE_SPAN_STATUSES.OK,
    started_at: timestamp,
    finished_at: timestamp,
    duration_ms: 0,
    attributes: { model: "gpt-4.1-mini" }
  });
  const nodeRun = createWorkflowNodeRunRecord({
    id: "node_run_1",
    execution_id: "execution_1",
    node_id: "agent",
    usage,
    cost,
    trace_span_id: span.id
  });

  assert.deepEqual(usage, {
    input_tokens: 40,
    output_tokens: 10,
    total_tokens: 50
  });
  assert.deepEqual(cost, {
    amount: 0.012346,
    currency: "USD"
  });
  assert.equal(span.kind, WORKFLOW_TRACE_SPAN_KINDS.MODEL);
  assert.equal(nodeRun.trace_span_id, "trace_span_1");
  assert.deepEqual(
    sumWorkflowTokenUsageRecords([
      { input_tokens: 10, output_tokens: 2 },
      { input_tokens: 5, output_tokens: 3 }
    ]),
    { input_tokens: 15, output_tokens: 5, total_tokens: 20 }
  );
  assert.deepEqual(
    sumWorkflowCostRecords([
      { amount: 0.01 },
      { amount: 0.02 }
    ]),
    { amount: 0.03, currency: "USD" }
  );
  assert.throws(
    () => createWorkflowTokenUsageRecord({
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 3
    }),
    /total_tokens/
  );
});

test("workflow execution policy validates node log records", () => {
  const log = createWorkflowNodeLogRecord({
    id: "node_log_1",
    execution_id: "execution_1",
    node_id: "http",
    level: WORKFLOW_NODE_LOG_LEVELS.WARN,
    message: "HTTP request retried",
    timestamp,
    metadata: { attempt: 2 }
  });
  const nodeRun = createWorkflowNodeRunRecord({
    id: "node_run_1",
    execution_id: "execution_1",
    node_id: "http",
    logs: [log]
  });

  assert.equal(nodeRun.logs[0].level, WORKFLOW_NODE_LOG_LEVELS.WARN);
  assert.equal(Object.isFrozen(nodeRun.logs[0].metadata), true);
  assert.throws(
    () =>
      createWorkflowNodeLogRecord({
        id: "node_log_1",
        execution_id: "execution_1",
        node_id: "http",
        level: "trace",
        message: "unsupported",
        timestamp
      }),
    (error) => {
      assert.equal(error.name, "WorkflowExecutionValidationError");
      assert.equal(error.code, "workflow_execution_unsupported_value");
      return true;
    }
  );
});

test("workflow execution policy validates supported statuses and trigger sources", () => {
  assert.throws(
    () =>
      createWorkflowExecutionRecord({
        id: "execution_1",
        workflow_id: "workflow_1",
        workflow_version: 1,
        project_id: "project_1",
        started_by: "owner_1",
        status: "paused",
        started_at: timestamp
      }),
    (error) => {
      assert.equal(error.name, "WorkflowExecutionValidationError");
      assert.equal(error.code, "workflow_execution_unsupported_value");
      return true;
    }
  );
});

test("workflow execution policy normalizes node run errors", () => {
  const nodeRun = createWorkflowNodeRunRecord({
    id: "node_run_1",
    execution_id: "execution_1",
    node_id: "http",
    status: WORKFLOW_NODE_RUN_STATUSES.FAILED,
    error: "HTTP 500",
    started_at: timestamp,
    finished_at: timestamp,
    duration_ms: 0
  });

  assert.deepEqual(nodeRun.error, { message: "HTTP 500" });
  assert.deepEqual(normalizeExecutionError("No route"), { message: "No route" });
});

test("workflow execution policy identifies terminal states", () => {
  assert.equal(isTerminalExecutionStatus(WORKFLOW_EXECUTION_STATUSES.SUCCESS), true);
  assert.equal(isTerminalExecutionStatus(WORKFLOW_EXECUTION_STATUSES.RUNNING), false);
  assert.equal(isTerminalNodeRunStatus(WORKFLOW_NODE_RUN_STATUSES.SKIPPED), true);
  assert.equal(isTerminalNodeRunStatus(WORKFLOW_NODE_RUN_STATUSES.RUNNING), false);
});
