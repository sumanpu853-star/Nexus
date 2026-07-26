import {
  createNodeDefinition,
  findNodeDefinitionByType,
  getBuiltInNodeDefinitions
} from "../domain/nodeDefinitionPolicy.js";

export function createNodeCatalogService({
  nodeDefinitions = getBuiltInNodeDefinitions()
} = {}) {
  assertNodeDefinitions(nodeDefinitions);
  const seenTypes = new Set();
  const catalogDefinitions = nodeDefinitions.map((definition) => {
    const normalized = createNodeDefinition(definition);

    if (seenTypes.has(normalized.type)) {
      throw new TypeError(`Node definition "${normalized.type}" is duplicated.`);
    }

    seenTypes.add(normalized.type);

    return normalized;
  });

  return Object.freeze({
    async listNodeDefinitions({
      include_disabled = true
    } = {}) {
      return catalogDefinitions
        .filter((definition) =>
          include_disabled || definition.availability.status !== "disabled"
        )
        .map((definition) => deepFreeze(deepClone(definition)));
    },

    async getNodeDefinition({
      type
    } = {}) {
      const definition = findNodeDefinitionByType({
        type,
        nodeDefinitions: catalogDefinitions
      });

      if (!definition) {
        throw new TypeError(`Node type "${type}" is not available in the node catalog.`);
      }

      return deepFreeze(deepClone(definition));
    }
  });
}

function assertNodeDefinitions(nodeDefinitions) {
  if (!Array.isArray(nodeDefinitions)) {
    throw new TypeError("createNodeCatalogService requires nodeDefinitions to be an array.");
  }
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
