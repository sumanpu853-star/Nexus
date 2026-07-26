import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_EDGE_TYPES,
  applyWorkflowErrorBranchDefaults,
  assertWorkflowErrorBranchPolicyValid,
  findWorkflowErrorBranchPolicyViolations,
  isWorkflowErrorEdge,
  isWorkflowSuccessEdge
} from "../../src/domain/workflowErrorBranchPolicy.js";

test("workflow error branch policy defaults edges to success", () => {
  const edges = [{ id: "edge_1", source: "manual", target: "http" }];
  const normalized = applyWorkflowErrorBranchDefaults({ edges });

  assert.deepEqual(normalized, [
    {
      id: "edge_1",
      source: "manual",
      target: "http",
      type: WORKFLOW_EDGE_TYPES.SUCCESS
    }
  ]);
  assert.equal(edges[0].type, undefined);
  assert.equal(Object.isFrozen(normalized[0]), true);
  assert.equal(isWorkflowSuccessEdge(normalized[0]), true);
});

test("workflow error branch policy accepts one error branch per source", () => {
  const normalized = applyWorkflowErrorBranchDefaults({
    edges: [
      { id: "ok", source: "http", target: "notify" },
      { id: "error", source: "http", target: "alert", type: WORKFLOW_EDGE_TYPES.ERROR }
    ]
  });

  assert.equal(isWorkflowErrorEdge(normalized[1]), true);
  assert.doesNotThrow(() =>
    assertWorkflowErrorBranchPolicyValid({ edges: normalized })
  );
});

test("workflow error branch policy reports invalid edge types and duplicate error branches", () => {
  const violations = findWorkflowErrorBranchPolicyViolations({
    edges: [
      { id: "bad", source: "http", target: "notify", type: "fallback" },
      { id: "first_error", source: "http", target: "alert", type: "error" },
      { id: "second_error", source: "http", target: "ticket", type: "error" }
    ]
  });

  assert.deepEqual(
    violations.map((violation) => violation.type),
    ["unsupported_edge_type", "duplicate_error_branch"]
  );
});

test("workflow error branch policy throws structured errors", () => {
  assert.throws(
    () =>
      assertWorkflowErrorBranchPolicyValid({
        edges: [{ id: "bad", source: "http", target: "notify", type: "fallback" }]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowErrorBranchPolicyError");
      assert.equal(error.code, "workflow_error_branch_policy_invalid");
      assert.equal(error.violations[0].edge_id, "bad");
      return true;
    }
  );
});
