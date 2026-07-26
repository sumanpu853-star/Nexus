export function createInMemoryAgentToolRegistry(initialTools = []) {
  const toolsByName = new Map();

  for (const tool of initialTools) {
    registerTool(tool);
  }

  return Object.freeze({
    async listTools() {
      return [...toolsByName.values()].map((tool) => toSafeTool(tool));
    },

    async findToolByName(name) {
      const tool = toolsByName.get(normalizeRequiredString(name, "Tool name"));

      return tool ? toSafeTool(tool) : null;
    },

    async invokeTool({
      tool_name,
      input = {},
      context = {}
    } = {}) {
      const toolName = normalizeRequiredString(tool_name, "Tool name");
      const tool = toolsByName.get(toolName);

      if (!tool) {
        throw new TypeError(`Agent tool "${toolName}" is not registered.`);
      }

      return normalizePlainObject(
        await tool.handler({
          input: normalizePlainObject(input, "Tool input"),
          context: normalizePlainObject(context, "Tool context")
        }),
        "Tool output"
      );
    }
  });

  function registerTool(tool) {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      throw new TypeError("Agent tools must be objects.");
    }

    const name = normalizeRequiredString(tool.name, "Tool name");

    if (toolsByName.has(name)) {
      throw new TypeError(`Agent tool "${name}" is duplicated.`);
    }

    if (typeof tool.handler !== "function") {
      throw new TypeError(`Agent tool "${name}" requires a handler.`);
    }

    toolsByName.set(name, {
      name,
      description: normalizeOptionalString(tool.description ?? "", "Tool description"),
      handler: tool.handler
    });
  }
}

function toSafeTool(tool) {
  return Object.freeze({
    name: tool.name,
    description: tool.description
  });
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}
