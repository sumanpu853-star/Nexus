export class WorkflowGraphValidationError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "WorkflowGraphValidationError";
    this.code = "workflow_graph_invalid";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function assertWorkflowGraphValid({
  nodes,
  edges
} = {}) {
  const violations = findWorkflowGraphViolations({ nodes, edges });

  if (violations.length > 0) {
    throw new WorkflowGraphValidationError(
      "Workflow graph must be a valid directed acyclic graph.",
      { violations }
    );
  }
}

export function findWorkflowGraphViolations({
  nodes,
  edges
} = {}) {
  const violations = [];
  const normalizedNodes = normalizeNodes(nodes, violations);
  const normalizedEdges = normalizeEdges(edges, violations);
  const nodeIds = new Set();
  const duplicateIds = new Set();

  for (const node of normalizedNodes) {
    if (nodeIds.has(node.id)) {
      duplicateIds.add(node.id);
      violations.push({
        type: "duplicate_node_id",
        node_id: node.id,
        message: `Node id "${node.id}" is duplicated.`
      });
      continue;
    }

    nodeIds.add(node.id);
  }

  for (const edge of normalizedEdges) {
    if (edge.source === edge.target) {
      violations.push({
        type: "self_edge",
        edge_id: edge.id,
        source: edge.source,
        target: edge.target,
        message: `Edge "${edge.id}" cannot connect node "${edge.source}" to itself.`
      });
    }

    if (!nodeIds.has(edge.source)) {
      violations.push({
        type: "missing_edge_source",
        edge_id: edge.id,
        source: edge.source,
        message: `Edge "${edge.id}" references missing source node "${edge.source}".`
      });
    }

    if (!nodeIds.has(edge.target)) {
      violations.push({
        type: "missing_edge_target",
        edge_id: edge.id,
        target: edge.target,
        message: `Edge "${edge.id}" references missing target node "${edge.target}".`
      });
    }
  }

  if (violations.length > 0) {
    return violations;
  }

  return [
    ...violations,
    ...findCycleViolations({
      nodes: normalizedNodes,
      edges: normalizedEdges,
      duplicateIds
    })
  ];
}

export function topologicallySortWorkflowNodes({
  nodes,
  edges
} = {}) {
  assertWorkflowGraphValid({ nodes, edges });

  const normalizedNodes = normalizeNodes(nodes, []);
  const normalizedEdges = normalizeEdges(edges, []);
  const incomingCounts = new Map(normalizedNodes.map((node) => [node.id, 0]));
  const outgoing = new Map(normalizedNodes.map((node) => [node.id, []]));

  for (const edge of normalizedEdges) {
    incomingCounts.set(edge.target, incomingCounts.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const queue = normalizedNodes
    .filter((node) => incomingCounts.get(node.id) === 0)
    .map((node) => node.id);
  const sorted = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    sorted.push(nodeId);

    for (const target of outgoing.get(nodeId)) {
      incomingCounts.set(target, incomingCounts.get(target) - 1);

      if (incomingCounts.get(target) === 0) {
        queue.push(target);
      }
    }
  }

  return sorted;
}

function findCycleViolations({
  nodes,
  edges,
  duplicateIds
}) {
  if (duplicateIds.size > 0) {
    return [];
  }

  const incomingCounts = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    incomingCounts.set(edge.target, incomingCounts.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const queue = nodes
    .filter((node) => incomingCounts.get(node.id) === 0)
    .map((node) => node.id);
  let visited = 0;

  while (queue.length > 0) {
    const nodeId = queue.shift();
    visited += 1;

    for (const target of outgoing.get(nodeId)) {
      incomingCounts.set(target, incomingCounts.get(target) - 1);

      if (incomingCounts.get(target) === 0) {
        queue.push(target);
      }
    }
  }

  if (visited === nodes.length) {
    return [];
  }

  const cycleNodeIds = [...incomingCounts.entries()]
    .filter(([, incomingCount]) => incomingCount > 0)
    .map(([nodeId]) => nodeId);

  return [
    {
      type: "cycle",
      node_ids: cycleNodeIds,
      message: `Workflow graph contains a cycle involving: ${cycleNodeIds.join(", ")}.`
    }
  ];
}

function normalizeNodes(nodes, violations) {
  if (!Array.isArray(nodes)) {
    violations.push({
      type: "invalid_nodes",
      message: "Workflow nodes must be an array."
    });
    return [];
  }

  return nodes.flatMap((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      violations.push({
        type: "invalid_node",
        node_index: index,
        message: `Workflow node at index ${index} must be an object.`
      });
      return [];
    }

    const id = normalizeRequiredString(node.id);
    const type = normalizeRequiredString(node.type);

    if (!id) {
      violations.push({
        type: "missing_node_id",
        node_index: index,
        message: `Workflow node at index ${index} must define a non-empty id.`
      });
    }

    if (!type) {
      violations.push({
        type: "missing_node_type",
        node_index: index,
        node_id: id || null,
        message: `Workflow node at index ${index} must define a non-empty type.`
      });
    }

    return id && type ? [{ id, type }] : [];
  });
}

function normalizeEdges(edges, violations) {
  if (!Array.isArray(edges)) {
    violations.push({
      type: "invalid_edges",
      message: "Workflow edges must be an array."
    });
    return [];
  }

  return edges.flatMap((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      violations.push({
        type: "invalid_edge",
        edge_index: index,
        message: `Workflow edge at index ${index} must be an object.`
      });
      return [];
    }

    const source = normalizeRequiredString(edge.source);
    const target = normalizeRequiredString(edge.target);
    const id = normalizeRequiredString(edge.id) || `edge:${index}`;

    if (!source) {
      violations.push({
        type: "missing_edge_source",
        edge_id: id,
        edge_index: index,
        message: `Workflow edge "${id}" must define a non-empty source.`
      });
    }

    if (!target) {
      violations.push({
        type: "missing_edge_target",
        edge_id: id,
        edge_index: index,
        message: `Workflow edge "${id}" must define a non-empty target.`
      });
    }

    return source && target ? [{ id, source, target }] : [];
  });
}

function normalizeRequiredString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
