export const WORKFLOW_EDGE_TYPES = Object.freeze({
  SUCCESS: "success",
  ERROR: "error"
});

const SUPPORTED_EDGE_TYPES = Object.freeze(Object.values(WORKFLOW_EDGE_TYPES));

export class WorkflowErrorBranchPolicyError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "WorkflowErrorBranchPolicyError";
    this.code = "workflow_error_branch_policy_invalid";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function assertWorkflowErrorBranchPolicyValid({
  edges
} = {}) {
  const violations = findWorkflowErrorBranchPolicyViolations({ edges });

  if (violations.length > 0) {
    throw new WorkflowErrorBranchPolicyError(
      "Workflow error branch policy is invalid.",
      { violations }
    );
  }
}

export function findWorkflowErrorBranchPolicyViolations({
  edges
} = {}) {
  if (!Array.isArray(edges)) {
    return [
      {
        type: "invalid_edges",
        message: "Workflow edges must be an array."
      }
    ];
  }

  const violations = [];
  const errorBranchSources = new Map();

  edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      violations.push({
        type: "invalid_edge",
        edge_index: index,
        message: `Workflow edge at index ${index} must be an object.`
      });
      return;
    }

    const edgeId = resolveEdgeId(edge, index);
    const source = normalizeOptionalString(edge.source);
    const edgeType = normalizeEdgeType(edge.type);

    if (!edgeType) {
      violations.push({
        type: "unsupported_edge_type",
        edge_id: edgeId,
        edge_type: edge.type,
        supported: SUPPORTED_EDGE_TYPES,
        message: `Workflow edge "${edgeId}" type is not supported.`
      });
      return;
    }

    if (edgeType !== WORKFLOW_EDGE_TYPES.ERROR || !source) {
      return;
    }

    const existing = errorBranchSources.get(source);

    if (existing) {
      violations.push({
        type: "duplicate_error_branch",
        source_node_id: source,
        edge_id: edgeId,
        existing_edge_id: existing,
        message: `Node "${source}" can have only one error branch.`
      });
      return;
    }

    errorBranchSources.set(source, edgeId);
  });

  return violations;
}

export function applyWorkflowErrorBranchDefaults({
  edges
} = {}) {
  assertWorkflowErrorBranchPolicyValid({ edges });

  return edges.map((edge) =>
    deepFreeze({
      ...deepClone(edge),
      type: normalizeEdgeType(edge.type)
    })
  );
}

export function isWorkflowSuccessEdge(edge) {
  return normalizeEdgeType(edge?.type) === WORKFLOW_EDGE_TYPES.SUCCESS;
}

export function isWorkflowErrorEdge(edge) {
  return normalizeEdgeType(edge?.type) === WORKFLOW_EDGE_TYPES.ERROR;
}

function normalizeEdgeType(edgeType) {
  if (edgeType === undefined) {
    return WORKFLOW_EDGE_TYPES.SUCCESS;
  }

  const normalized = normalizeOptionalString(edgeType);

  return SUPPORTED_EDGE_TYPES.includes(normalized) ? normalized : null;
}

function resolveEdgeId(edge, index) {
  return normalizeOptionalString(edge.id) ?? `edge:${index}`;
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
