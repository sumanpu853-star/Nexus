export const NODE_RETRY_BACKOFF = Object.freeze({
  FIXED: "fixed",
  EXPONENTIAL: "exponential"
});

export const DEFAULT_NODE_TIMEOUT_MS = 30_000;
export const MIN_NODE_TIMEOUT_MS = 100;
export const MAX_NODE_TIMEOUT_MS = 15 * 60 * 1000;
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1_000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;
export const MAX_RETRY_ATTEMPTS = 5;
export const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

const NO_RETRY_POLICY = Object.freeze({
  max_attempts: 1,
  backoff: NODE_RETRY_BACKOFF.FIXED,
  initial_delay_ms: 0,
  max_delay_ms: 0
});
const RETRY_POLICY_FIELDS = Object.freeze([
  "max_attempts",
  "backoff",
  "initial_delay_ms",
  "max_delay_ms"
]);

export class WorkflowNodeExecutionPolicyError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "WorkflowNodeExecutionPolicyError";
    this.code = "workflow_node_execution_policy_invalid";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function assertWorkflowNodeExecutionPoliciesValid({
  nodes
} = {}) {
  const violations = findWorkflowNodeExecutionPolicyViolations({ nodes });

  if (violations.length > 0) {
    throw new WorkflowNodeExecutionPolicyError(
      "Workflow node retry and timeout policies are invalid.",
      { violations }
    );
  }
}

export function findWorkflowNodeExecutionPolicyViolations({
  nodes
} = {}) {
  if (!Array.isArray(nodes)) {
    return [
      {
        type: "invalid_nodes",
        message: "Workflow nodes must be an array."
      }
    ];
  }

  return nodes.flatMap((node, index) => validateNodeExecutionPolicy(node, index));
}

export function applyWorkflowNodeExecutionPolicyDefaults({
  nodes
} = {}) {
  assertWorkflowNodeExecutionPoliciesValid({ nodes });

  return nodes.map((node) => {
    const normalizedRetryPolicy = normalizeRetryPolicy(node.retry_policy);

    return deepFreeze({
      ...deepClone(node),
      timeout_ms: node.timeout_ms ?? DEFAULT_NODE_TIMEOUT_MS,
      retry_policy: normalizedRetryPolicy
    });
  });
}

export function getDefaultNodeExecutionPolicy() {
  return deepFreeze({
    timeout_ms: DEFAULT_NODE_TIMEOUT_MS,
    retry_policy: { ...NO_RETRY_POLICY }
  });
}

function validateNodeExecutionPolicy(node, index) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [
      {
        type: "invalid_node",
        node_index: index,
        message: `Workflow node at index ${index} must be an object.`
      }
    ];
  }

  const nodeId = resolveNodeId(node, index);
  const violations = [
    ...validateTimeout(node.timeout_ms, nodeId),
    ...validateRetryPolicy(node.retry_policy, nodeId)
  ];

  return violations;
}

function validateTimeout(timeoutMs, nodeId) {
  if (timeoutMs === undefined) {
    return [];
  }

  if (!Number.isInteger(timeoutMs)) {
    return [
      {
        type: "invalid_timeout",
        node_id: nodeId,
        message: `Node "${nodeId}" timeout_ms must be an integer.`
      }
    ];
  }

  if (timeoutMs < MIN_NODE_TIMEOUT_MS || timeoutMs > MAX_NODE_TIMEOUT_MS) {
    return [
      {
        type: "timeout_out_of_range",
        node_id: nodeId,
        min_timeout_ms: MIN_NODE_TIMEOUT_MS,
        max_timeout_ms: MAX_NODE_TIMEOUT_MS,
        message:
          `Node "${nodeId}" timeout_ms must be between ${MIN_NODE_TIMEOUT_MS} and ${MAX_NODE_TIMEOUT_MS}.`
      }
    ];
  }

  return [];
}

function validateRetryPolicy(retryPolicy, nodeId) {
  if (retryPolicy === undefined) {
    return [];
  }

  if (!retryPolicy || typeof retryPolicy !== "object" || Array.isArray(retryPolicy)) {
    return [
      {
        type: "invalid_retry_policy",
        node_id: nodeId,
        message: `Node "${nodeId}" retry_policy must be an object.`
      }
    ];
  }

  const violations = [
    ...validateRetryPolicyFields(retryPolicy, nodeId),
    ...validateMaxAttempts(retryPolicy.max_attempts, nodeId),
    ...validateBackoff(retryPolicy.backoff, nodeId),
    ...validateDelay({
      value: retryPolicy.initial_delay_ms,
      field: "initial_delay_ms",
      type: "invalid_retry_initial_delay",
      nodeId
    }),
    ...validateDelay({
      value: retryPolicy.max_delay_ms,
      field: "max_delay_ms",
      type: "invalid_retry_max_delay",
      nodeId
    })
  ];

  if (violations.length > 0) {
    return violations;
  }

  const normalized = normalizeRetryPolicy(retryPolicy);

  if (
    normalized.max_attempts > 1 &&
    normalized.initial_delay_ms < MIN_NODE_TIMEOUT_MS
  ) {
    violations.push({
      type: "retry_initial_delay_too_low",
      node_id: nodeId,
      min_delay_ms: MIN_NODE_TIMEOUT_MS,
      message:
        `Node "${nodeId}" retry_policy.initial_delay_ms must be at least ${MIN_NODE_TIMEOUT_MS} when retries are enabled.`
    });
  }

  if (normalized.max_delay_ms < normalized.initial_delay_ms) {
    violations.push({
      type: "retry_max_delay_too_low",
      node_id: nodeId,
      message:
        `Node "${nodeId}" retry_policy.max_delay_ms must be greater than or equal to initial_delay_ms.`
    });
  }

  return violations;
}

function validateRetryPolicyFields(retryPolicy, nodeId) {
  return Object.keys(retryPolicy)
    .filter((field) => !RETRY_POLICY_FIELDS.includes(field))
    .map((field) => ({
      type: "unsupported_retry_policy_field",
      node_id: nodeId,
      field,
      supported: RETRY_POLICY_FIELDS,
      message: `Node "${nodeId}" retry_policy.${field} is not supported.`
    }));
}

function validateMaxAttempts(maxAttempts, nodeId) {
  if (maxAttempts === undefined) {
    return [];
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_RETRY_ATTEMPTS) {
    return [
      {
        type: "retry_attempts_out_of_range",
        node_id: nodeId,
        min_attempts: 1,
        max_attempts: MAX_RETRY_ATTEMPTS,
        message:
          `Node "${nodeId}" retry_policy.max_attempts must be between 1 and ${MAX_RETRY_ATTEMPTS}.`
      }
    ];
  }

  return [];
}

function validateBackoff(backoff, nodeId) {
  if (backoff === undefined) {
    return [];
  }

  if (!Object.values(NODE_RETRY_BACKOFF).includes(backoff)) {
    return [
      {
        type: "invalid_retry_backoff",
        node_id: nodeId,
        allowed: Object.values(NODE_RETRY_BACKOFF),
        message: `Node "${nodeId}" retry_policy.backoff is not supported.`
      }
    ];
  }

  return [];
}

function validateDelay({
  value,
  field,
  type,
  nodeId
}) {
  if (value === undefined) {
    return [];
  }

  if (!Number.isInteger(value) || value < 0 || value > MAX_RETRY_DELAY_MS) {
    return [
      {
        type,
        node_id: nodeId,
        field,
        min_delay_ms: 0,
        max_delay_ms: MAX_RETRY_DELAY_MS,
        message:
          `Node "${nodeId}" retry_policy.${field} must be between 0 and ${MAX_RETRY_DELAY_MS}.`
      }
    ];
  }

  return [];
}

function normalizeRetryPolicy(retryPolicy) {
  if (retryPolicy === undefined) {
    return { ...NO_RETRY_POLICY };
  }

  const maxAttempts = retryPolicy.max_attempts ?? NO_RETRY_POLICY.max_attempts;
  const backoff = retryPolicy.backoff ?? NO_RETRY_POLICY.backoff;
  const initialDelayMs =
    retryPolicy.initial_delay_ms ??
    (maxAttempts > 1 ? DEFAULT_RETRY_INITIAL_DELAY_MS : NO_RETRY_POLICY.initial_delay_ms);
  const maxDelayMs =
    retryPolicy.max_delay_ms ??
    (maxAttempts > 1 ? Math.max(initialDelayMs, DEFAULT_RETRY_MAX_DELAY_MS) : initialDelayMs);

  return {
    max_attempts: maxAttempts,
    backoff,
    initial_delay_ms: initialDelayMs,
    max_delay_ms: maxDelayMs
  };
}

function resolveNodeId(node, index) {
  return typeof node.id === "string" && node.id.trim() !== ""
    ? node.id.trim()
    : `node:${index}`;
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
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
