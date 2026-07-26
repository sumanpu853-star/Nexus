import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_EXECUTION_MODES,
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_NODE_LOG_LEVELS,
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRIGGER_SOURCES,
  createWorkflowExecutionRecord,
  createWorkflowNodeLogRecord,
  createWorkflowNodeRunRecord,
  isTerminalExecutionStatus,
  isTerminalNodeRunStatus,
  normalizeExecutionError
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
  assert.equal(execution.node_runs[0].status, WORKFLOW_NODE_RUN_STATUSES.QUEUED);
  assert.deepEqual(execution.node_runs[0].logs, []);
  assert.equal(Object.isFrozen(execution.node_runs[0]), true);
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
