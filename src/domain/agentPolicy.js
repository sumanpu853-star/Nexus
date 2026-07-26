export const AGENT_MEMORY_SCOPES = Object.freeze({
  NONE: "none",
  SESSION: "session",
  USER: "user",
  SEMANTIC: "semantic"
});

export const AGENT_TOOL_TYPES = Object.freeze({
  KNOWLEDGE: "knowledge",
  WORKFLOW: "workflow",
  INTEGRATION: "integration",
  CUSTOM: "custom"
});

export const AGENT_RUN_STATUSES = Object.freeze({
  COMPLETED: "completed",
  FAILED: "failed"
});

export const AGENT_TOOL_CALL_STATUSES = Object.freeze({
  COMPLETED: "completed",
  FAILED: "failed",
  BLOCKED: "blocked"
});

export const AGENT_MESSAGE_ROLES = Object.freeze({
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool"
});

export const DEFAULT_AGENT_MODEL = deepFreeze({
  provider: "deterministic",
  model: "nexus-agent-deterministic-v1",
  temperature: 0.2,
  max_output_tokens: 1024
});

export const DEFAULT_AGENT_MEMORY = deepFreeze({
  scope: AGENT_MEMORY_SCOPES.SESSION,
  key: "default"
});

export class AgentPolicyValidationError extends Error {
  constructor(message, {
    code = "agent_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "AgentPolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createAgentRecord({
  id,
  project_id,
  owner_id,
  name,
  description = "",
  instructions,
  model = {},
  memory = {},
  tools = [],
  prompt_version = 1,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Agent id"),
    project_id: normalizeRequiredString(project_id, "Agent project_id"),
    owner_id: normalizeRequiredString(owner_id, "Agent owner_id"),
    name: normalizeRequiredString(name, "Agent name"),
    description: normalizeOptionalString(description, "Agent description"),
    instructions: normalizeRequiredString(instructions, "Agent instructions"),
    model: normalizeAgentModel(model),
    memory: normalizeAgentMemory(memory),
    tools: normalizeAgentTools(tools),
    prompt_version: normalizePositiveInteger(prompt_version, "Agent prompt_version"),
    created_at: normalizeTimestamp(created_at, "Agent created_at"),
    updated_at: normalizeTimestamp(updated_at, "Agent updated_at")
  });
}

export function createAgentPromptVersionRecord({
  id,
  agent_id,
  project_id,
  version,
  instructions,
  model = {},
  memory = {},
  tools = [],
  created_by,
  created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Agent prompt version id"),
    agent_id: normalizeRequiredString(agent_id, "Agent prompt version agent_id"),
    project_id: normalizeRequiredString(project_id, "Agent prompt version project_id"),
    version: normalizePositiveInteger(version, "Agent prompt version version"),
    instructions: normalizeRequiredString(
      instructions,
      "Agent prompt version instructions"
    ),
    model: normalizeAgentModel(model),
    memory: normalizeAgentMemory(memory),
    tools: normalizeAgentTools(tools),
    created_by: normalizeRequiredString(
      created_by,
      "Agent prompt version created_by"
    ),
    created_at: normalizeTimestamp(created_at, "Agent prompt version created_at")
  });
}

export function createAgentRunRecord({
  id,
  agent_id,
  project_id,
  started_by,
  status = AGENT_RUN_STATUSES.COMPLETED,
  input = {},
  output = {},
  model = {},
  memory = {},
  tool_calls = [],
  usage = {},
  error = null,
  started_at,
  finished_at,
  duration_ms = 0
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Agent run id"),
    agent_id: normalizeRequiredString(agent_id, "Agent run agent_id"),
    project_id: normalizeRequiredString(project_id, "Agent run project_id"),
    started_by: normalizeRequiredString(started_by, "Agent run started_by"),
    status: normalizeEnum(status, AGENT_RUN_STATUSES, "Agent run status"),
    input: normalizePlainObject(input, "Agent run input"),
    output: normalizePlainObject(output, "Agent run output"),
    model: normalizeAgentModel(model),
    memory: normalizeAgentMemory(memory),
    tool_calls: normalizeToolCallArray(tool_calls),
    usage: createAgentUsageRecord(usage),
    error: normalizeNullableError(error, "Agent run error"),
    started_at: normalizeTimestamp(started_at, "Agent run started_at"),
    finished_at: normalizeTimestamp(finished_at, "Agent run finished_at"),
    duration_ms: normalizeNonNegativeInteger(duration_ms, "Agent run duration_ms")
  });
}

export function createAgentToolPermissionRecord({
  name,
  type = AGENT_TOOL_TYPES.CUSTOM,
  description = "",
  enabled = true,
  requires_approval = false,
  input_schema = {}
} = {}) {
  return deepFreeze({
    name: normalizeRequiredString(name, "Agent tool name"),
    type: normalizeEnum(type, AGENT_TOOL_TYPES, "Agent tool type"),
    description: normalizeOptionalString(description, "Agent tool description"),
    enabled: Boolean(enabled),
    requires_approval: Boolean(requires_approval),
    input_schema: normalizePlainObject(input_schema, "Agent tool input_schema")
  });
}

export function createAgentToolCallRecord({
  id,
  run_id,
  agent_id,
  project_id,
  tool_name,
  status,
  input = {},
  output = null,
  error = null,
  started_at,
  finished_at,
  duration_ms = 0
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Agent tool call id"),
    run_id: normalizeRequiredString(run_id, "Agent tool call run_id"),
    agent_id: normalizeRequiredString(agent_id, "Agent tool call agent_id"),
    project_id: normalizeRequiredString(project_id, "Agent tool call project_id"),
    tool_name: normalizeRequiredString(tool_name, "Agent tool call tool_name"),
    status: normalizeEnum(
      status,
      AGENT_TOOL_CALL_STATUSES,
      "Agent tool call status"
    ),
    input: normalizePlainObject(input, "Agent tool call input"),
    output: normalizeNullablePlainObject(output, "Agent tool call output"),
    error: normalizeNullableError(error, "Agent tool call error"),
    started_at: normalizeTimestamp(started_at, "Agent tool call started_at"),
    finished_at: normalizeTimestamp(finished_at, "Agent tool call finished_at"),
    duration_ms: normalizeNonNegativeInteger(
      duration_ms,
      "Agent tool call duration_ms"
    )
  });
}

export function createAgentMemoryRecord({
  id,
  project_id,
  agent_id,
  scope,
  key,
  messages = [],
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Agent memory id"),
    project_id: normalizeRequiredString(project_id, "Agent memory project_id"),
    agent_id: normalizeRequiredString(agent_id, "Agent memory agent_id"),
    scope: normalizeEnum(scope, AGENT_MEMORY_SCOPES, "Agent memory scope"),
    key: normalizeRequiredString(key, "Agent memory key"),
    messages: normalizeAgentMemoryMessages(messages),
    created_at: normalizeTimestamp(created_at, "Agent memory created_at"),
    updated_at: normalizeTimestamp(updated_at, "Agent memory updated_at")
  });
}

export function createAgentMemoryMessage({
  role,
  content,
  timestamp,
  metadata = {}
} = {}) {
  return deepFreeze({
    role: normalizeEnum(role, AGENT_MESSAGE_ROLES, "Agent memory message role"),
    content: normalizeRequiredString(content, "Agent memory message content"),
    timestamp: normalizeTimestamp(timestamp, "Agent memory message timestamp"),
    metadata: normalizePlainObject(metadata, "Agent memory message metadata")
  });
}

export function appendAgentMemoryMessages({
  memory,
  messages,
  updated_at
} = {}) {
  const normalizedMemory = createAgentMemoryRecord(memory);
  const normalizedMessages = normalizeAgentMemoryMessages(messages);

  return createAgentMemoryRecord({
    ...normalizedMemory,
    messages: [...normalizedMemory.messages, ...normalizedMessages],
    updated_at
  });
}

export function createAgentUsageRecord({
  input_tokens = 0,
  output_tokens = 0,
  total_tokens
} = {}) {
  const normalizedInputTokens = normalizeNonNegativeInteger(
    input_tokens,
    "Agent usage input_tokens"
  );
  const normalizedOutputTokens = normalizeNonNegativeInteger(
    output_tokens,
    "Agent usage output_tokens"
  );
  const inferredTotal = normalizedInputTokens + normalizedOutputTokens;
  const normalizedTotalTokens = total_tokens === undefined
    ? inferredTotal
    : normalizeNonNegativeInteger(total_tokens, "Agent usage total_tokens");

  if (normalizedTotalTokens !== inferredTotal) {
    throw new AgentPolicyValidationError(
      "Agent usage total_tokens must equal input_tokens plus output_tokens.",
      {
        code: "agent_usage_total_invalid",
        details: {
          input_tokens: normalizedInputTokens,
          output_tokens: normalizedOutputTokens,
          total_tokens: normalizedTotalTokens
        }
      }
    );
  }

  return deepFreeze({
    input_tokens: normalizedInputTokens,
    output_tokens: normalizedOutputTokens,
    total_tokens: normalizedTotalTokens
  });
}

export function assertAgentBelongsToProject({
  agent,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!agent || agent.project_id !== projectId) {
    throw new AgentPolicyValidationError("Agent is not available in this project.", {
      code: "agent_not_in_project",
      details: { project_id: projectId }
    });
  }

  return agent;
}

export function assertAgentToolAllowed({
  agent,
  tool_name
} = {}) {
  const normalizedAgent = createAgentRecord(agent);
  const toolName = normalizeRequiredString(tool_name, "Agent tool name");
  const tool = normalizedAgent.tools.find((entry) => entry.name === toolName);

  if (!tool || !tool.enabled) {
    throw new AgentPolicyValidationError(`Agent tool "${toolName}" is not allowed.`, {
      code: "agent_tool_not_allowed",
      details: { tool_name: toolName }
    });
  }

  if (tool.requires_approval) {
    throw new AgentPolicyValidationError(`Agent tool "${toolName}" requires approval.`, {
      code: "agent_tool_approval_required",
      details: { tool_name: toolName }
    });
  }

  return tool;
}

export function normalizeAgentModel(model = {}) {
  const provided = model === undefined || model === null ? {} : model;
  const normalized = {
    ...DEFAULT_AGENT_MODEL,
    ...normalizePlainObject(provided, "Agent model")
  };

  normalized.provider = normalizeRequiredString(
    normalized.provider,
    "Agent model provider"
  );
  normalized.model = normalizeRequiredString(normalized.model, "Agent model");
  normalized.temperature = normalizeTemperature(normalized.temperature);
  normalized.max_output_tokens = normalizePositiveInteger(
    normalized.max_output_tokens,
    "Agent model max_output_tokens"
  );

  if (normalized.max_output_tokens > 32000) {
    throw new AgentPolicyValidationError(
      "Agent model max_output_tokens must be at most 32000.",
      {
        code: "agent_model_max_output_tokens_out_of_range",
        details: { max_output_tokens: normalized.max_output_tokens }
      }
    );
  }

  return deepFreeze(normalized);
}

export function normalizeAgentMemory(memory = {}) {
  const provided = memory === undefined || memory === null ? {} : memory;
  const normalized = {
    ...DEFAULT_AGENT_MEMORY,
    ...normalizePlainObject(provided, "Agent memory")
  };

  normalized.scope = normalizeEnum(
    normalized.scope,
    AGENT_MEMORY_SCOPES,
    "Agent memory scope"
  );
  normalized.key = normalized.scope === AGENT_MEMORY_SCOPES.NONE
    ? normalizeOptionalString(normalized.key ?? "", "Agent memory key")
    : normalizeRequiredString(normalized.key, "Agent memory key");

  return deepFreeze(normalized);
}

function normalizeAgentTools(tools) {
  if (!Array.isArray(tools)) {
    throw new AgentPolicyValidationError("Agent tools must be an array.");
  }

  const names = new Set();

  return deepFreeze(tools.map((tool) => {
    const normalized = createAgentToolPermissionRecord(tool);

    if (names.has(normalized.name)) {
      throw new AgentPolicyValidationError(
        `Agent tool "${normalized.name}" is duplicated.`,
        {
          code: "agent_tool_duplicated",
          details: { tool_name: normalized.name }
        }
      );
    }

    names.add(normalized.name);

    return normalized;
  }));
}

function normalizeToolCallArray(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    throw new AgentPolicyValidationError("Agent run tool_calls must be an array.");
  }

  return deepFreeze(toolCalls.map((toolCall) => createAgentToolCallRecord(toolCall)));
}

function normalizeAgentMemoryMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new AgentPolicyValidationError("Agent memory messages must be an array.");
  }

  return deepFreeze(messages.map((message) => createAgentMemoryMessage(message)));
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new AgentPolicyValidationError(`${field} is not supported.`, {
      code: "agent_policy_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AgentPolicyValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new AgentPolicyValidationError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullablePlainObject(value, field) {
  if (value === null) {
    return null;
  }

  return normalizePlainObject(value, field);
}

function normalizeNullableError(value, field) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return { message: value };
  }

  return normalizePlainObject(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentPolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeTemperature(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 2) {
    throw new AgentPolicyValidationError(
      "Agent model temperature must be a number between 0 and 2.",
      {
        code: "agent_model_temperature_out_of_range",
        details: { temperature: value }
      }
    );
  }

  return Number(value.toFixed(3));
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AgentPolicyValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AgentPolicyValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new AgentPolicyValidationError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
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
