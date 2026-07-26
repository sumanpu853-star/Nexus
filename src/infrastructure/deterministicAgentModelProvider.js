export function createDeterministicAgentModelProvider({
  defaultModel = "nexus-agent-deterministic-v1"
} = {}) {
  const normalizedDefaultModel = normalizeRequiredString(defaultModel, "Default model");

  return Object.freeze({
    async generateResponse({
      instructions,
      input = {},
      model = {},
      memory = [],
      tools = []
    } = {}) {
      const prompt = extractPrompt(input);
      const modelName = normalizeRequiredString(
        model.model ?? normalizedDefaultModel,
        "Agent model"
      );
      const requestedToolCalls = normalizeRequestedToolCalls(input.tool_requests ?? []);
      const availableToolNames = tools.map((tool) => tool.name).filter(Boolean);
      const memoryCount = Array.isArray(memory) ? memory.length : 0;
      const message = [
        `Model ${modelName} received: ${truncate(prompt, 80)}`,
        `Instructions: ${truncate(instructions, 80)}`,
        `Memory messages: ${memoryCount}`,
        `Tools: ${availableToolNames.join(", ") || "none"}`
      ].join(" | ");

      return Object.freeze({
        message,
        requested_tool_calls: Object.freeze(requestedToolCalls),
        usage: estimateUsage({
          instructions,
          prompt,
          message
        })
      });
    }
  });
}

function normalizeRequestedToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    throw new TypeError("tool_requests must be an array.");
  }

  return toolCalls.map((toolCall) => {
    if (!toolCall || typeof toolCall !== "object" || Array.isArray(toolCall)) {
      throw new TypeError("tool_requests entries must be objects.");
    }

    return Object.freeze({
      tool_name: normalizeRequiredString(
        toolCall.tool_name ?? toolCall.name,
        "Tool request name"
      ),
      input: normalizePlainObject(toolCall.input ?? {}, "Tool request input")
    });
  });
}

function estimateUsage({
  instructions,
  prompt,
  message
}) {
  const inputTokens = estimateTokens(`${instructions ?? ""} ${prompt}`);
  const outputTokens = estimateTokens(message);

  return Object.freeze({
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens
  });
}

function extractPrompt(input) {
  if (input && typeof input.prompt === "string" && input.prompt.trim() !== "") {
    return input.prompt.trim();
  }

  return JSON.stringify(input ?? {});
}

function estimateTokens(value) {
  return Math.max(1, String(value).split(/[^a-zA-Z0-9]+/).filter(Boolean).length);
}

function truncate(value, maxLength) {
  const normalized = normalizeRequiredString(value, "Text");

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3)}...`;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}
