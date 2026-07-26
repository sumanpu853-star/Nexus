import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkflowNodesSafe,
  findUnsafeWorkflowNodeViolations,
  getDisabledUnsandboxedNodeTypes,
  isNodeTypeDisabledWithoutSandbox
} from "../../src/domain/executionSafetyPolicy.js";

test("execution safety policy allows ordinary workflow nodes", () => {
  assert.deepEqual(
    findUnsafeWorkflowNodeViolations({
      nodes: [
        { id: "manual", type: "manual" },
        { id: "http", type: "http_request" }
      ]
    }),
    []
  );
  assert.doesNotThrow(() =>
    assertWorkflowNodesSafe({
      nodes: [{ id: "manual", type: "manual" }]
    })
  );
});

test("execution safety policy disables python_script without a sandboxed runner", () => {
  const violations = findUnsafeWorkflowNodeViolations({
    nodes: [{ id: "script_1", type: "python_script" }]
  });

  assert.deepEqual(violations, [
    {
      node_id: "script_1",
      node_type: "python_script",
      reason: "python_script is disabled until a sandboxed runner is available."
    }
  ]);
  assert.throws(
    () =>
      assertWorkflowNodesSafe({
        nodes: [{ id: "script_1", type: "python_script" }]
      }),
    (error) => {
      assert.equal(error.name, "UnsafeExecutionError");
      assert.equal(error.code, "unsafe_execution_disabled");
      assert.equal(error.violations[0].node_id, "script_1");
      return true;
    }
  );
});

test("execution safety policy allows python_script only with an explicit sandbox", () => {
  const runnerCapabilities = {
    python_script: {
      sandboxed: true
    }
  };

  assert.equal(
    isNodeTypeDisabledWithoutSandbox("python_script", runnerCapabilities),
    false
  );
  assert.doesNotThrow(() =>
    assertWorkflowNodesSafe({
      nodes: [{ id: "script_1", type: "python_script" }],
      runnerCapabilities
    })
  );
});

test("execution safety policy exposes disabled unsandboxed node types", () => {
  assert.deepEqual(getDisabledUnsandboxedNodeTypes(), ["python_script"]);
});
