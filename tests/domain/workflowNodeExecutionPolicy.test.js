import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NODE_TIMEOUT_MS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  NODE_RETRY_BACKOFF,
  applyWorkflowNodeExecutionPolicyDefaults,
  assertWorkflowNodeExecutionPoliciesValid,
  findWorkflowNodeExecutionPolicyViolations,
  getDefaultNodeExecutionPolicy
} from "../../src/domain/workflowNodeExecutionPolicy.js";

test("workflow node execution policy applies safe defaults", () => {
  const nodes = [{ id: "http", type: "http_request", parameters: { url: "https://example.com" } }];
  const normalized = applyWorkflowNodeExecutionPolicyDefaults({ nodes });

  assert.deepEqual(normalized, [
    {
      id: "http",
      type: "http_request",
      parameters: { url: "https://example.com" },
      timeout_ms: DEFAULT_NODE_TIMEOUT_MS,
      retry_policy: {
        max_attempts: 1,
        backoff: NODE_RETRY_BACKOFF.FIXED,
        initial_delay_ms: 0,
        max_delay_ms: 0
      }
    }
  ]);
  assert.equal(nodes[0].timeout_ms, undefined);
  assert.equal(Object.isFrozen(normalized[0].retry_policy), true);
});

test("workflow node execution policy preserves explicit retry and timeout settings", () => {
  const normalized = applyWorkflowNodeExecutionPolicyDefaults({
    nodes: [
      {
        id: "http",
        type: "http_request",
        timeout_ms: 15_000,
        retry_policy: {
          max_attempts: 3,
          backoff: NODE_RETRY_BACKOFF.EXPONENTIAL
        }
      }
    ]
  });

  assert.deepEqual(normalized[0].retry_policy, {
    max_attempts: 3,
    backoff: NODE_RETRY_BACKOFF.EXPONENTIAL,
    initial_delay_ms: DEFAULT_RETRY_INITIAL_DELAY_MS,
    max_delay_ms: DEFAULT_RETRY_MAX_DELAY_MS
  });
  assert.equal(normalized[0].timeout_ms, 15_000);
});

test("workflow node execution policy reports invalid retry and timeout settings", () => {
  const violations = findWorkflowNodeExecutionPolicyViolations({
    nodes: [
      { id: "too_fast", type: "http_request", timeout_ms: 99 },
      {
        id: "bad_retry",
        type: "http_request",
        retry_policy: {
          max_attempts: 6,
          backoff: "linear",
          initial_delay_ms: -1,
          max_delay_ms: 600_000,
          jitter_ms: 1_000
        }
      },
      {
        id: "retry_storm",
        type: "http_request",
        retry_policy: {
          max_attempts: 2,
          initial_delay_ms: 0,
          max_delay_ms: 0
        }
      },
      {
        id: "backward_delay",
        type: "http_request",
        retry_policy: {
          max_attempts: 3,
          initial_delay_ms: 5_000,
          max_delay_ms: 1_000
        }
      }
    ]
  });

  assert.deepEqual(
    violations.map((violation) => violation.type),
    [
      "timeout_out_of_range",
      "unsupported_retry_policy_field",
      "retry_attempts_out_of_range",
      "invalid_retry_backoff",
      "invalid_retry_initial_delay",
      "invalid_retry_max_delay",
      "retry_initial_delay_too_low",
      "retry_max_delay_too_low"
    ]
  );
});

test("workflow node execution policy throws structured errors", () => {
  assert.throws(
    () =>
      assertWorkflowNodeExecutionPoliciesValid({
        nodes: [{ id: "http", type: "http_request", timeout_ms: 0 }]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowNodeExecutionPolicyError");
      assert.equal(error.code, "workflow_node_execution_policy_invalid");
      assert.equal(error.violations[0].node_id, "http");
      return true;
    }
  );
});

test("workflow node execution policy exposes default policy values", () => {
  assert.deepEqual(getDefaultNodeExecutionPolicy(), {
    timeout_ms: DEFAULT_NODE_TIMEOUT_MS,
    retry_policy: {
      max_attempts: 1,
      backoff: NODE_RETRY_BACKOFF.FIXED,
      initial_delay_ms: 0,
      max_delay_ms: 0
    }
  });
});
