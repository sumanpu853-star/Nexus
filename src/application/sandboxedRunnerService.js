import { assertWorkflowNodesSafe } from "../domain/executionSafetyPolicy.js";

export function createSandboxedRunnerService({
  runners = []
} = {}) {
  const runnersByType = createRunnerMap(runners);
  const getRunnerCapabilities = () =>
    Object.freeze(
      Object.fromEntries(
        [...runnersByType.keys()].map((nodeType) => [
          nodeType,
          Object.freeze({ sandboxed: true })
        ])
      )
    );

  return Object.freeze({
    getRunnerCapabilities,

    async runNode({
      node,
      input = {}
    } = {}) {
      const normalizedNode = normalizeNode(node);
      const runner = runnersByType.get(normalizedNode.type);
      const runnerCapabilities = getRunnerCapabilities();

      assertWorkflowNodesSafe({
        nodes: [normalizedNode],
        runnerCapabilities
      });

      if (!runner) {
        throw new TypeError(`No sandboxed runner is configured for node type "${normalizedNode.type}".`);
      }

      return deepFreeze({
        node_id: normalizedNode.id,
        node_type: normalizedNode.type,
        output: await runner.run({
          node: deepClone(normalizedNode),
          input: deepClone(input)
        })
      });
    }
  });
}

function createRunnerMap(runners) {
  if (!Array.isArray(runners)) {
    throw new TypeError("createSandboxedRunnerService requires runners to be an array.");
  }

  const runnersByType = new Map();

  for (const runner of runners) {
    const normalized = normalizeRunner(runner);

    if (runnersByType.has(normalized.node_type)) {
      throw new TypeError(`Sandboxed runner for node type "${normalized.node_type}" is duplicated.`);
    }

    runnersByType.set(normalized.node_type, normalized);
  }

  return runnersByType;
}

function normalizeRunner(runner) {
  if (!runner || typeof runner !== "object" || Array.isArray(runner)) {
    throw new TypeError("Sandboxed runner must be an object.");
  }

  if (runner.sandboxed !== true) {
    throw new TypeError("Sandboxed runner must declare sandboxed: true.");
  }

  if (typeof runner.run !== "function") {
    throw new TypeError("Sandboxed runner must define run().");
  }

  return Object.freeze({
    node_type: normalizeRequiredString(runner.node_type, "Sandboxed runner node_type"),
    sandboxed: true,
    run: runner.run
  });
}

function normalizeNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new TypeError("Workflow node must be an object.");
  }

  return Object.freeze({
    ...deepClone(node),
    id: normalizeRequiredString(node.id, "Workflow node id"),
    type: normalizeRequiredString(node.type, "Workflow node type")
  });
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
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
