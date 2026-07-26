const PYTHON_SCRIPT_NODE_TYPE = "python_script";
const DISABLED_UNSANDBOXED_NODE_TYPES = Object.freeze([PYTHON_SCRIPT_NODE_TYPE]);

export class UnsafeExecutionError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "UnsafeExecutionError";
    this.code = "unsafe_execution_disabled";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function assertWorkflowNodesSafe({
  nodes,
  runnerCapabilities = {}
} = {}) {
  const violations = findUnsafeWorkflowNodeViolations({
    nodes,
    runnerCapabilities
  });

  if (violations.length > 0) {
    throw new UnsafeExecutionError(
      "Workflow contains disabled unsafe execution nodes.",
      { violations }
    );
  }
}

export function findUnsafeWorkflowNodeViolations({
  nodes,
  runnerCapabilities = {}
} = {}) {
  const workflowNodes = normalizeNodes(nodes);

  return workflowNodes.flatMap((node, index) =>
    isNodeTypeDisabledWithoutSandbox(node.type, runnerCapabilities)
      ? [
          {
            node_id: resolveNodeId(node, index),
            node_type: node.type,
            reason:
              `${node.type} is disabled until a sandboxed runner is available.`
          }
        ]
      : []
  );
}

export function isNodeTypeDisabledWithoutSandbox(nodeType, runnerCapabilities = {}) {
  const normalizedType = normalizeNodeType(nodeType);

  return (
    DISABLED_UNSANDBOXED_NODE_TYPES.includes(normalizedType) &&
    !isSandboxedRunnerAvailable(normalizedType, runnerCapabilities)
  );
}

export function getDisabledUnsandboxedNodeTypes() {
  return [...DISABLED_UNSANDBOXED_NODE_TYPES];
}

function isSandboxedRunnerAvailable(nodeType, runnerCapabilities) {
  return runnerCapabilities?.[nodeType]?.sandboxed === true;
}

function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) {
    throw new TypeError("Workflow nodes must be an array.");
  }

  return nodes.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new TypeError(`Workflow node at index ${index} must be an object.`);
    }

    return {
      ...node,
      type: normalizeNodeType(node.type)
    };
  });
}

function normalizeNodeType(nodeType) {
  if (typeof nodeType !== "string" || nodeType.trim() === "") {
    throw new TypeError("Workflow node type must be a non-empty string.");
  }

  return nodeType.trim();
}

function resolveNodeId(node, index) {
  return typeof node.id === "string" && node.id.trim() !== ""
    ? node.id.trim()
    : `node:${index}`;
}
