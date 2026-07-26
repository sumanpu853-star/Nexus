import {
  WORKFLOW_EDGE_TYPES,
  isWorkflowErrorEdge,
  isWorkflowSuccessEdge
} from "./workflowErrorBranchPolicy.js";
import { topologicallySortWorkflowNodes } from "./workflowGraphPolicy.js";

export class WorkflowExecutionPlanError extends Error {
  constructor(message, {
    code = "workflow_execution_plan_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "WorkflowExecutionPlanError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createWorkflowExecutionPlan({
  workflow,
  start_node_id = null
} = {}) {
  const nodes = normalizeWorkflowNodes(workflow);
  const edges = normalizeWorkflowEdges(workflow);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const startNodeId = normalizeNullableNodeId(start_node_id);

  if (startNodeId && !nodeIds.has(startNodeId)) {
    throw new WorkflowExecutionPlanError(
      `Workflow does not contain start node "${startNodeId}".`,
      {
        code: "workflow_execution_start_node_missing",
        details: { start_node_id: startNodeId }
      }
    );
  }

  const sortedNodeIds = topologicallySortWorkflowNodes({ nodes, edges });
  const successEdges = edges.filter((edge) => isWorkflowSuccessEdge(edge));
  const errorBranches = edges
    .filter((edge) => isWorkflowErrorEdge(edge))
    .map((edge) => ({
      edge_id: edge.id,
      source_node_id: edge.source,
      target_node_id: edge.target
    }));
  const rootNodeIds = startNodeId
    ? [startNodeId]
    : findDefaultStartNodeIds({
      nodes,
      successEdges,
      errorBranches
    });
  const reachableNodeIds = collectReachableSuccessNodeIds({
    rootNodeIds,
    successEdges
  });

  return deepFreeze({
    workflow_id: workflow.id ?? null,
    start_node_id: startNodeId,
    node_ids: sortedNodeIds.filter((nodeId) => reachableNodeIds.has(nodeId)),
    error_branches: errorBranches
  });
}

export function resolveWorkflowErrorBranch({
  workflow,
  failed_node_id
} = {}) {
  const failedNodeId = normalizeRequiredNodeId(failed_node_id, "failed_node_id");
  const plan = createWorkflowExecutionPlan({ workflow });

  return (
    plan.error_branches.find((branch) => branch.source_node_id === failedNodeId) ??
    null
  );
}

function findDefaultStartNodeIds({
  nodes,
  successEdges,
  errorBranches
}) {
  const successTargets = new Set(successEdges.map((edge) => edge.target));
  const errorTargets = new Set(errorBranches.map((branch) => branch.target_node_id));
  const normalRoots = nodes
    .map((node) => node.id)
    .filter((nodeId) => !successTargets.has(nodeId) && !errorTargets.has(nodeId));

  if (normalRoots.length > 0) {
    return normalRoots;
  }

  return nodes
    .map((node) => node.id)
    .filter((nodeId) => !successTargets.has(nodeId));
}

function collectReachableSuccessNodeIds({
  rootNodeIds,
  successEdges
}) {
  const reachable = new Set();
  const outgoing = new Map();

  for (const edge of successEdges) {
    const existing = outgoing.get(edge.source) ?? [];
    outgoing.set(edge.source, [...existing, edge.target]);
  }

  const queue = [...rootNodeIds];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (reachable.has(nodeId)) {
      continue;
    }

    reachable.add(nodeId);
    queue.push(...(outgoing.get(nodeId) ?? []));
  }

  return reachable;
}

function normalizeWorkflowNodes(workflow) {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new WorkflowExecutionPlanError("Workflow must be an object.");
  }

  if (!Array.isArray(workflow.nodes)) {
    throw new WorkflowExecutionPlanError("Workflow nodes must be an array.");
  }

  return workflow.nodes.map((node, index) => ({
    id: normalizeRequiredNodeId(node?.id, `nodes[${index}].id`),
    type: normalizeRequiredNodeId(node?.type, `nodes[${index}].type`)
  }));
}

function normalizeWorkflowEdges(workflow) {
  if (!Array.isArray(workflow.edges)) {
    throw new WorkflowExecutionPlanError("Workflow edges must be an array.");
  }

  return workflow.edges.map((edge, index) => ({
    id: normalizeOptionalString(edge?.id) ?? `edge:${index}`,
    source: normalizeRequiredNodeId(edge?.source, `edges[${index}].source`),
    target: normalizeRequiredNodeId(edge?.target, `edges[${index}].target`),
    type: normalizeOptionalString(edge?.type) ?? WORKFLOW_EDGE_TYPES.SUCCESS
  }));
}

function normalizeRequiredNodeId(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WorkflowExecutionPlanError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableNodeId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredNodeId(value, "start_node_id");
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
