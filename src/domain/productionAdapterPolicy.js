export const PRODUCTION_ADAPTER_CATEGORIES = Object.freeze({
  PERSISTENCE: "persistence",
  QUEUE: "queue",
  VECTOR_STORE: "vector_store",
  LLM_PROVIDER: "llm_provider",
  INTEGRATION_GATEWAY: "integration_gateway",
  WEBHOOK_DISPATCHER: "webhook_dispatcher",
  SCHEDULER: "scheduler",
  SANDBOX_RUNNER: "sandbox_runner",
  SECRET_PROVIDER: "secret_provider"
});

export const PRODUCTION_ADAPTER_TYPES = Object.freeze({
  DURABLE_PERSISTENCE: "durable_persistence",
  JOB_QUEUE: "job_queue",
  VECTOR_STORE: "vector_store",
  LLM_PROVIDER: "llm_provider",
  INTEGRATION_GATEWAY: "integration_gateway",
  WEBHOOK_DISPATCHER: "webhook_dispatcher",
  SCHEDULER: "scheduler",
  SANDBOX_RUNNER: "sandbox_runner",
  SECRET_PROVIDER: "secret_provider"
});

export const PRODUCTION_ADAPTER_STATUSES = Object.freeze({
  CONFIGURED: "configured",
  DISABLED: "disabled"
});

export const PRODUCTION_ADAPTER_HEALTH_STATUSES = Object.freeze({
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail"
});

export const PRODUCTION_READINESS_STATUSES = Object.freeze({
  READY: "ready",
  DEGRADED: "degraded",
  BLOCKED: "blocked"
});

const RAW_SECRET_SETTING_KEYS = new Set([
  "api_key",
  "access_token",
  "refresh_token",
  "token",
  "password",
  "secret",
  "client_secret",
  "private_key",
  "connection_string"
]);

export class ProductionAdapterPolicyValidationError extends Error {
  constructor(message, {
    code = "production_adapter_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "ProductionAdapterPolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const BUILT_IN_PRODUCTION_ADAPTER_DEFINITIONS = Object.freeze([
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
    label: "Durable persistence",
    description: "Stores projects, workflows, executions, credentials, and deployments.",
    required: true,
    capabilities: [
      "projects",
      "workflows",
      "executions",
      "credentials",
      "deployments"
    ]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.JOB_QUEUE,
    category: PRODUCTION_ADAPTER_CATEGORIES.QUEUE,
    label: "Job queue",
    description: "Queues workflow runs, retries, schedules, and background jobs.",
    required: true,
    capabilities: ["workflow_runs", "retries", "schedules"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.VECTOR_STORE,
    category: PRODUCTION_ADAPTER_CATEGORIES.VECTOR_STORE,
    label: "Vector store",
    description: "Stores and searches embeddings for knowledge bases.",
    required: true,
    capabilities: ["embeddings", "search", "upsert", "replace"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
    category: PRODUCTION_ADAPTER_CATEGORIES.LLM_PROVIDER,
    label: "LLM provider",
    description: "Runs agent model calls, tool calls, and model usage tracking.",
    required: true,
    capabilities: ["agent_runs", "tool_calls", "usage"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.INTEGRATION_GATEWAY,
    category: PRODUCTION_ADAPTER_CATEGORIES.INTEGRATION_GATEWAY,
    label: "Integration gateway",
    description: "Executes external integration calls behind a provider boundary.",
    required: true,
    capabilities: [
      "http",
      "email",
      "chat",
      "storage",
      "developer",
      "database"
    ]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.WEBHOOK_DISPATCHER,
    category: PRODUCTION_ADAPTER_CATEGORIES.WEBHOOK_DISPATCHER,
    label: "Webhook dispatcher",
    description: "Delivers, verifies, and retries webhook events.",
    required: true,
    capabilities: ["delivery", "signature_verification", "retries"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.SCHEDULER,
    category: PRODUCTION_ADAPTER_CATEGORIES.SCHEDULER,
    label: "Scheduler",
    description: "Activates cron and timezone-aware schedule triggers.",
    required: true,
    capabilities: ["cron", "timezone", "activation"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.SANDBOX_RUNNER,
    category: PRODUCTION_ADAPTER_CATEGORIES.SANDBOX_RUNNER,
    label: "Sandbox runner",
    description: "Executes code with timeout and resource limits.",
    required: true,
    capabilities: ["python", "timeout", "resource_limits"]
  }),
  createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.SECRET_PROVIDER,
    category: PRODUCTION_ADAPTER_CATEGORIES.SECRET_PROVIDER,
    label: "Secret provider",
    description: "Resolves external secret references without storing raw secrets.",
    required: true,
    capabilities: ["external_refs", "rotation", "lookup"]
  })
]);

export function getBuiltInProductionAdapterDefinitions() {
  return BUILT_IN_PRODUCTION_ADAPTER_DEFINITIONS.map((definition) =>
    createProductionAdapterDefinitionRecord(definition)
  );
}

export function findProductionAdapterDefinition({
  adapter_type,
  type = adapter_type,
  definitions = getBuiltInProductionAdapterDefinitions()
} = {}) {
  const adapterType = normalizeRequiredString(type, "Production adapter type");

  return (
    normalizeDefinitions(definitions).find(
      (definition) => definition.type === adapterType
    ) ?? null
  );
}

export function createProductionAdapterDefinitionRecord({
  type,
  category,
  label,
  description = "",
  required = true,
  capabilities = []
} = {}) {
  return deepFreeze({
    type: normalizeRequiredString(type, "Production adapter definition type"),
    category: normalizeEnum(
      category,
      PRODUCTION_ADAPTER_CATEGORIES,
      "Production adapter category"
    ),
    label: normalizeRequiredString(label, "Production adapter label"),
    description: normalizeString(description, "Production adapter description"),
    required: Boolean(required),
    capabilities: normalizeStringArray(
      capabilities,
      "Production adapter capabilities"
    )
  });
}

export function createProductionAdapterConfigRecord({
  id,
  adapter_type,
  category,
  provider,
  status = PRODUCTION_ADAPTER_STATUSES.CONFIGURED,
  endpoint = null,
  settings = {},
  secret_ref = null,
  capabilities = [],
  created_at,
  updated_at = created_at
} = {}) {
  const normalizedSettings = normalizePlainObject(
    settings,
    "Production adapter settings"
  );

  assertNoRawSecretSettings(normalizedSettings);

  return deepFreeze({
    id: normalizeRequiredString(id, "Production adapter config id"),
    adapter_type: normalizeRequiredString(
      adapter_type,
      "Production adapter config adapter_type"
    ),
    category: normalizeEnum(
      category,
      PRODUCTION_ADAPTER_CATEGORIES,
      "Production adapter config category"
    ),
    provider: normalizeRequiredString(provider, "Production adapter provider"),
    status: normalizeEnum(
      status,
      PRODUCTION_ADAPTER_STATUSES,
      "Production adapter status"
    ),
    endpoint: normalizeNullableUrl(endpoint, "Production adapter endpoint"),
    settings: normalizedSettings,
    secret_ref: normalizeNullableRequiredString(
      secret_ref,
      "Production adapter secret_ref"
    ),
    capabilities: normalizeStringArray(
      capabilities,
      "Production adapter config capabilities"
    ),
    created_at: normalizeTimestamp(
      created_at,
      "Production adapter config created_at"
    ),
    updated_at: normalizeTimestamp(
      updated_at,
      "Production adapter config updated_at"
    )
  });
}

export function createProductionAdapterHealthCheckRecord({
  id,
  adapter_type,
  status,
  checked_at,
  latency_ms = null,
  message = "",
  details = {}
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Production adapter health check id"),
    adapter_type: normalizeRequiredString(
      adapter_type,
      "Production adapter health check adapter_type"
    ),
    status: normalizeEnum(
      status,
      PRODUCTION_ADAPTER_HEALTH_STATUSES,
      "Production adapter health status"
    ),
    checked_at: normalizeTimestamp(
      checked_at,
      "Production adapter health check checked_at"
    ),
    latency_ms: normalizeNullableNonNegativeInteger(
      latency_ms,
      "Production adapter health check latency_ms"
    ),
    message: normalizeString(
      message,
      "Production adapter health check message"
    ),
    details: normalizePlainObject(
      details,
      "Production adapter health check details"
    )
  });
}

export function createProductionReadinessReport({
  definitions = getBuiltInProductionAdapterDefinitions(),
  configs = [],
  healthChecks = []
} = {}) {
  const normalizedDefinitions = normalizeDefinitions(definitions);
  const normalizedConfigs = normalizeArray(
    configs,
    "Production adapter configs"
  ).map((config) => createProductionAdapterConfigRecord(config));
  const normalizedHealthChecks = normalizeArray(
    healthChecks,
    "Production adapter health checks"
  ).map((healthCheck) => createProductionAdapterHealthCheckRecord(healthCheck));
  const configByAdapterType = new Map(
    normalizedConfigs.map((config) => [config.adapter_type, config])
  );
  const latestHealthByAdapterType = findLatestHealthChecks(
    normalizedHealthChecks
  );
  const items = normalizedDefinitions.map((definition) => {
    const config = configByAdapterType.get(definition.type) ?? null;
    const configured = config?.status === PRODUCTION_ADAPTER_STATUSES.CONFIGURED;
    const healthCheck = latestHealthByAdapterType.get(definition.type) ?? null;

    return deepFreeze({
      adapter_type: definition.type,
      category: definition.category,
      label: definition.label,
      required: definition.required,
      configured,
      provider: configured ? config.provider : null,
      config,
      latest_health_check: healthCheck,
      readiness: resolveItemReadiness({
        definition,
        config,
        configured,
        healthCheck
      })
    });
  });
  const requiredItems = items.filter((item) => item.required);
  const missingRequired = requiredItems.filter(
    (item) => item.readiness === "missing_config" || item.readiness === "disabled"
  );
  const failingRequired = requiredItems.filter(
    (item) => item.readiness === "failing"
  );
  const warningRequired = requiredItems.filter(
    (item) => item.readiness === "warning"
  );
  const uncheckedRequired = requiredItems.filter(
    (item) => item.readiness === "unchecked"
  );
  const status = resolveReadinessStatus({
    missingRequired,
    failingRequired,
    warningRequired,
    uncheckedRequired
  });

  return deepFreeze({
    status,
    required_configured: requiredItems.filter((item) => item.configured).length,
    required_total: requiredItems.length,
    health_status_counts: countLatestHealthStatuses(latestHealthByAdapterType),
    missing_required: missingRequired.map((item) => item.adapter_type),
    failing_required: failingRequired.map((item) => item.adapter_type),
    warning_required: warningRequired.map((item) => item.adapter_type),
    unchecked_required: uncheckedRequired.map((item) => item.adapter_type),
    items
  });
}

function normalizeDefinitions(definitions) {
  return normalizeArray(
    definitions,
    "Production adapter definitions"
  ).map((definition) => createProductionAdapterDefinitionRecord(definition));
}

function resolveItemReadiness({
  definition,
  config,
  configured,
  healthCheck
}) {
  if (!configured) {
    if (config?.status === PRODUCTION_ADAPTER_STATUSES.DISABLED) {
      return "disabled";
    }

    return definition.required ? "missing_config" : "optional_unconfigured";
  }

  if (!healthCheck) {
    return "unchecked";
  }

  if (healthCheck.status === PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL) {
    return "failing";
  }

  if (healthCheck.status === PRODUCTION_ADAPTER_HEALTH_STATUSES.WARN) {
    return "warning";
  }

  return "healthy";
}

function resolveReadinessStatus({
  missingRequired,
  failingRequired,
  warningRequired,
  uncheckedRequired
}) {
  if (missingRequired.length > 0 || failingRequired.length > 0) {
    return PRODUCTION_READINESS_STATUSES.BLOCKED;
  }

  if (warningRequired.length > 0 || uncheckedRequired.length > 0) {
    return PRODUCTION_READINESS_STATUSES.DEGRADED;
  }

  return PRODUCTION_READINESS_STATUSES.READY;
}

function findLatestHealthChecks(healthChecks) {
  const latest = new Map();

  for (const healthCheck of healthChecks) {
    const existing = latest.get(healthCheck.adapter_type);

    if (!existing || Date.parse(healthCheck.checked_at) >= Date.parse(existing.checked_at)) {
      latest.set(healthCheck.adapter_type, healthCheck);
    }
  }

  return latest;
}

function countLatestHealthStatuses(latestHealthByAdapterType) {
  const counts = {
    [PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS]: 0,
    [PRODUCTION_ADAPTER_HEALTH_STATUSES.WARN]: 0,
    [PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL]: 0
  };

  for (const healthCheck of latestHealthByAdapterType.values()) {
    counts[healthCheck.status] += 1;
  }

  return counts;
}

function assertNoRawSecretSettings(settings, path = "settings") {
  if (settings === null || settings === undefined) {
    return;
  }

  if (Array.isArray(settings)) {
    settings.forEach((entry, index) =>
      assertNoRawSecretSettings(entry, `${path}[${index}]`)
    );
    return;
  }

  if (typeof settings !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(settings)) {
    if (
      RAW_SECRET_SETTING_KEYS.has(key.toLowerCase()) &&
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      throw new ProductionAdapterPolicyValidationError(
        "Production adapter settings must not store raw secret values; use secret_ref.",
        {
          code: "production_adapter_raw_secret_forbidden",
          details: { setting: `${path}.${key}` }
        }
      );
    }

    assertNoRawSecretSettings(value, `${path}.${key}`);
  }
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new ProductionAdapterPolicyValidationError(`${field} is not supported.`, {
      code: "production_adapter_policy_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProductionAdapterPolicyValidationError(
      `${field} must be a non-empty string.`
    );
  }

  return value.trim();
}

function normalizeString(value, field) {
  if (typeof value !== "string") {
    throw new ProductionAdapterPolicyValidationError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullableRequiredString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductionAdapterPolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new ProductionAdapterPolicyValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new ProductionAdapterPolicyValidationError(`${field} must be an array.`);
  }

  return [...new Set(value.map((entry) => normalizeRequiredString(entry, field)))];
}

function normalizeNullableUrl(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeRequiredString(value, field);

  try {
    const url = new URL(normalized);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }

    return url.toString();
  } catch {
    throw new ProductionAdapterPolicyValidationError(`${field} must be an HTTP URL.`);
  }
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new ProductionAdapterPolicyValidationError(
      `${field} must be an ISO timestamp.`
    );
  }

  return normalized;
}

function normalizeNullableNonNegativeInteger(value, field) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new ProductionAdapterPolicyValidationError(
      `${field} must be a non-negative integer.`
    );
  }

  return value;
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
