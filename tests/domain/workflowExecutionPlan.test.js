import assert from "node:assert/strict";
import test from "node:test";
import { WORKFLOW_EDGE_TYPES } from "../../src/domain/workflowErrorBranchPolicy.js";
import {
  createWorkflowExecutionPlan,
  resolveWorkflowErrorBranch
} from "../../src/domain/workflowExecutionPlan.js";

const workflow = Object.freeze({
  id: "workflow_1",
  nodes: [
    { id: "manual", type: "manual" },
    { id: "http", type: "http_request" },
    { id: "notify", type: "slack" },
    { id: "error_notify", type: "slack" }
  ],
  edges: [
    { id: "manual_to_http", source: "manual", target: "http", type: "success" },
    { id: "http_to_notify", source: "http", target: "notify", type: "success" },
    {
      id: "http_to_error",
      source: "http",
      target: "error_notify",
      type: WORKFLOW_EDGE_TYPES.ERROR
    }
  ]
});

test("workflow execution plan excludes error-only branches from happy path", () => {
  const plan = createWorkflowExecutionPlan({ workflow });

  assert.deepEqual(plan.node_ids, ["manual", "http", "notify"]);
  assert.deepEqual(plan.error_branches, [
    {
      edge_id: "http_to_error",
      source_node_id: "http",
      target_node_id: "error_notify"
    }
  ]);
  assert.equal(Object.isFrozen(plan.error_branches[0]), true);
});

test("workflow execution plan starts partial runs from the failed node", () => {
  const plan = createWorkflowExecutionPlan({
    workflow,
    start_node_id: "http"
  });

  assert.deepEqual(plan.node_ids, ["http", "notify"]);
  assert.equal(plan.start_node_id, "http");
});

test("workflow execution plan resolves a failed node error branch", () => {
  assert.deepEqual(
    resolveWorkflowErrorBranch({
      workflow,
      failed_node_id: "http"
    }),
    {
      edge_id: "http_to_error",
      source_node_id: "http",
      target_node_id: "error_notify"
    }
  );
  assert.equal(
    resolveWorkflowErrorBranch({
      workflow,
      failed_node_id: "notify"
    }),
    null
  );
});

test("workflow execution plan rejects unknown partial start nodes", () => {
  assert.throws(
    () =>
      createWorkflowExecutionPlan({
        workflow,
        start_node_id: "missing"
      }),
    (error) => {
      assert.equal(error.name, "WorkflowExecutionPlanError");
      assert.equal(error.code, "workflow_execution_start_node_missing");
      return true;
    }
  );
});
