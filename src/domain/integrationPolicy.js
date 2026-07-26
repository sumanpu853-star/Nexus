export const INTEGRATION_CATEGORIES = Object.freeze({
  HTTP: "http",
  COMMUNICATION: "communication",
  EMAIL: "email",
  STORAGE: "storage",
  DEVELOPER: "developer",
  DATABASE: "database",
  TRIGGER: "trigger"
});

export const INTEGRATION_AUTH_TYPES = Object.freeze({
  NONE: "none",
  API_KEY: "api_key",
  OAUTH2: "oauth2",
  DATABASE: "database",
  WEBHOOK_SECRET: "webhook_secret"
});

export const INTEGRATION_CONNECTION_STATUSES = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled"
});

export const INTEGRATION_INVOCATION_STATUSES = Object.freeze({
  SUCCESS: "success",
  FAILED: "failed"
});

const BUILT_IN_INTEGRATION_DEFINITIONS = deepFreeze([
  createIntegrationDefinitionRecord({
    type: "http",
    label: "HTTP",
    category: INTEGRATION_CATEGORIES.HTTP,
    description: "Call arbitrary HTTP endpoints through a request adapter.",
    auth_type: INTEGRATION_AUTH_TYPES.NONE,
    credential_required: false,
    actions: ["request"]
  }),
  createIntegrationDefinitionRecord({
    type: "slack",
    label: "Slack",
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    description: "Send Slack channel or thread messages.",
    auth_type: INTEGRATION_AUTH_TYPES.API_KEY,
    credential_required: true,
    actions: ["send_message"]
  }),
  createIntegrationDefinitionRecord({
    type: "teams",
    label: "Microsoft Teams",
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    description: "Send Microsoft Teams channel messages.",
    auth_type: INTEGRATION_AUTH_TYPES.OAUTH2,
    credential_required: true,
    actions: ["send_message"]
  }),
  createIntegrationDefinitionRecord({
    type: "gmail",
    label: "Gmail",
    category: INTEGRATION_CATEGORIES.EMAIL,
    description: "Send Gmail messages.",
    auth_type: INTEGRATION_AUTH_TYPES.OAUTH2,
    credential_required: true,
    actions: ["send_email"]
  }),
  createIntegrationDefinitionRecord({
    type: "outlook_email",
    label: "Outlook Email",
    category: INTEGRATION_CATEGORIES.EMAIL,
    description: "Send Outlook email messages.",
    auth_type: INTEGRATION_AUTH_TYPES.OAUTH2,
    credential_required: true,
    actions: ["send_email"]
  }),
  createIntegrationDefinitionRecord({
    type: "google_drive",
    label: "Google Drive",
    category: INTEGRATION_CATEGORIES.STORAGE,
    description: "Upload, download, and list Google Drive files.",
    auth_type: INTEGRATION_AUTH_TYPES.OAUTH2,
    credential_required: true,
    actions: ["upload_file", "download_file", "list_files"]
  }),
  createIntegrationDefinitionRecord({
    type: "github",
    label: "GitHub",
    category: INTEGRATION_CATEGORIES.DEVELOPER,
    description: "Create issues, comment on issues, and dispatch workflows.",
    auth_type: INTEGRATION_AUTH_TYPES.API_KEY,
    credential_required: true,
    actions: ["create_issue", "comment_on_issue", "dispatch_workflow"]
  }),
  createIntegrationDefinitionRecord({
    type: "database",
    label: "Database",
    category: INTEGRATION_CATEGORIES.DATABASE,
    description: "Run parameterized database queries through a database adapter.",
    auth_type: INTEGRATION_AUTH_TYPES.DATABASE,
    credential_required: true,
    actions: ["query"]
  }),
  createIntegrationDefinitionRecord({
    type: "webhook",
    label: "Webhook",
    category: INTEGRATION_CATEGORIES.TRIGGER,
    description: "Receive external events through project-scoped webhook endpoints.",
    auth_type: INTEGRATION_AUTH_TYPES.WEBHOOK_SECRET,
    credential_required: false,
    actions: [],
    triggers: ["webhook_received"]
  }),
  createIntegrationDefinitionRecord({
    type: "schedule",
    label: "Schedule",
    category: INTEGRATION_CATEGORIES.TRIGGER,
    description: "Run workflows from cron-like schedules.",
    auth_type: INTEGRATION_AUTH_TYPES.NONE,
    credential_required: false,
    actions: [],
    triggers: ["schedule_tick"]
  })
]);

export class IntegrationPolicyValidationError extends Error {
  constructor(message, {
    code = "integration_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "IntegrationPolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function getBuiltInIntegrationDefinitions() {
  return BUILT_IN_INTEGRATION_DEFINITIONS.map((definition) =>
    deepFreeze(deepClone(definition))
  );
}

export function findIntegrationDefinition({
  type,
  definitions = getBuiltInIntegrationDefinitions()
} = {}) {
  const normalizedType = normalizeRequiredString(type, "Integration type");

  return createDefinitionMap(definitions).get(normalizedType) ?? null;
}

export function createIntegrationDefinitionRecord({
  type,
  label,
  category,
  description = "",
  auth_type = INTEGRATION_AUTH_TYPES.NONE,
  credential_required = false,
  actions = [],
  triggers = []
} = {}) {
  return deepFreeze({
    type: normalizeRequiredString(type, "Integration definition type"),
    label: normalizeRequiredString(label, "Integration definition label"),
    category: normalizeEnum(
      category,
      INTEGRATION_CATEGORIES,
      "Integration definition category"
    ),
    description: normalizeOptionalString(
      description,
      "Integration definition description"
    ),
    auth_type: normalizeEnum(
      auth_type,
      INTEGRATION_AUTH_TYPES,
      "Integration definition auth_type"
    ),
    credential_required: Boolean(credential_required),
    actions: normalizeStringArray(actions, "Integration definition actions"),
    triggers: normalizeStringArray(triggers, "Integration definition triggers")
  });
}

export function createIntegrationConnectionRecord({
  id,
  project_id,
  owner_id,
  integration_type,
  name,
  credential_id = null,
  settings = {},
  status = INTEGRATION_CONNECTION_STATUSES.ACTIVE,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Integration connection id"),
    project_id: normalizeRequiredString(
      project_id,
      "Integration connection project_id"
    ),
    owner_id: normalizeRequiredString(owner_id, "Integration connection owner_id"),
    integration_type: normalizeRequiredString(
      integration_type,
      "Integration connection integration_type"
    ),
    name: normalizeRequiredString(name, "Integration connection name"),
    credential_id: normalizeNullableString(
      credential_id,
      "Integration connection credential_id"
    ),
    settings: normalizePlainObject(settings, "Integration connection settings"),
    status: normalizeEnum(
      status,
      INTEGRATION_CONNECTION_STATUSES,
      "Integration connection status"
    ),
    created_at: normalizeTimestamp(created_at, "Integration connection created_at"),
    updated_at: normalizeTimestamp(updated_at, "Integration connection updated_at")
  });
}

export function createIntegrationInvocationRecord({
  id,
  project_id,
  connection_id,
  integration_type,
  action,
  input = {},
  output = null,
  status = INTEGRATION_INVOCATION_STATUSES.SUCCESS,
  error = null,
  started_at,
  finished_at,
  duration_ms = 0
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Integration invocation id"),
    project_id: normalizeRequiredString(
      project_id,
      "Integration invocation project_id"
    ),
    connection_id: normalizeRequiredString(
      connection_id,
      "Integration invocation connection_id"
    ),
    integration_type: normalizeRequiredString(
      integration_type,
      "Integration invocation integration_type"
    ),
    action: normalizeRequiredString(action, "Integration invocation action"),
    input: normalizePlainObject(input, "Integration invocation input"),
    output: normalizeNullablePlainObject(output, "Integration invocation output"),
    status: normalizeEnum(
      status,
      INTEGRATION_INVOCATION_STATUSES,
      "Integration invocation status"
    ),
    error: normalizeNullableError(error, "Integration invocation error"),
    started_at: normalizeTimestamp(started_at, "Integration invocation started_at"),
    finished_at: normalizeTimestamp(finished_at, "Integration invocation finished_at"),
    duration_ms: normalizeNonNegativeInteger(
      duration_ms,
      "Integration invocation duration_ms"
    )
  });
}

export function createWebhookEndpointRecord({
  id,
  project_id,
  workflow_id,
  connection_id = null,
  path,
  secret_ref = null,
  is_active = true,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Webhook endpoint id"),
    project_id: normalizeRequiredString(project_id, "Webhook endpoint project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Webhook endpoint workflow_id"),
    connection_id: normalizeNullableString(
      connection_id,
      "Webhook endpoint connection_id"
    ),
    path: normalizeWebhookPath(path),
    secret_ref: normalizeNullableString(secret_ref, "Webhook endpoint secret_ref"),
    is_active: Boolean(is_active),
    created_at: normalizeTimestamp(created_at, "Webhook endpoint created_at"),
    updated_at: normalizeTimestamp(updated_at, "Webhook endpoint updated_at")
  });
}

export function createScheduleTriggerRecord({
  id,
  project_id,
  workflow_id,
  cron,
  timezone = "UTC",
  is_active = true,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Schedule trigger id"),
    project_id: normalizeRequiredString(project_id, "Schedule trigger project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Schedule trigger workflow_id"),
    cron: normalizeCronExpression(cron),
    timezone: normalizeRequiredString(timezone, "Schedule trigger timezone"),
    is_active: Boolean(is_active),
    created_at: normalizeTimestamp(created_at, "Schedule trigger created_at"),
    updated_at: normalizeTimestamp(updated_at, "Schedule trigger updated_at")
  });
}

export function assertIntegrationActionAllowed({
  definition,
  action
} = {}) {
  const normalizedDefinition = createIntegrationDefinitionRecord(definition);
  const normalizedAction = normalizeRequiredString(action, "Integration action");

  if (!normalizedDefinition.actions.includes(normalizedAction)) {
    throw new IntegrationPolicyValidationError(
      `Integration action "${normalizedAction}" is not supported.`,
      {
        code: "integration_action_not_supported",
        details: {
          integration_type: normalizedDefinition.type,
          action: normalizedAction,
          supported: normalizedDefinition.actions
        }
      }
    );
  }

  return normalizedAction;
}

export function assertIntegrationConnectionBelongsToProject({
  connection,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!connection || connection.project_id !== projectId) {
    throw new IntegrationPolicyValidationError(
      "Integration connection is not available in this project.",
      {
        code: "integration_connection_not_in_project",
        details: { project_id: projectId }
      }
    );
  }

  return connection;
}

export function assertCredentialRequirementSatisfied({
  definition,
  credential_id
} = {}) {
  const normalizedDefinition = createIntegrationDefinitionRecord(definition);

  if (
    normalizedDefinition.credential_required &&
    (typeof credential_id !== "string" || credential_id.trim() === "")
  ) {
    throw new IntegrationPolicyValidationError(
      `Integration "${normalizedDefinition.type}" requires a credential.`,
      {
        code: "integration_credential_required",
        details: { integration_type: normalizedDefinition.type }
      }
    );
  }
}

function createDefinitionMap(definitions) {
  if (!Array.isArray(definitions)) {
    throw new IntegrationPolicyValidationError("Integration definitions must be an array.");
  }

  const definitionsByType = new Map();

  for (const definition of definitions) {
    const normalized = createIntegrationDefinitionRecord(definition);

    if (definitionsByType.has(normalized.type)) {
      throw new IntegrationPolicyValidationError(
        `Integration definition "${normalized.type}" is duplicated.`,
        {
          code: "integration_definition_duplicated",
          details: { integration_type: normalized.type }
        }
      );
    }

    definitionsByType.set(normalized.type, normalized);
  }

  return definitionsByType;
}

function normalizeWebhookPath(path) {
  const normalized = normalizeRequiredString(path, "Webhook endpoint path");

  if (!normalized.startsWith("/")) {
    throw new IntegrationPolicyValidationError("Webhook endpoint path must start with /.");
  }

  if (!/^\/[a-zA-Z0-9/_-]+$/.test(normalized)) {
    throw new IntegrationPolicyValidationError(
      "Webhook endpoint path contains unsupported characters."
    );
  }

  return normalized;
}

function normalizeCronExpression(cron) {
  const normalized = normalizeRequiredString(cron, "Schedule trigger cron");
  const parts = normalized.split(/\s+/);

  if (parts.length !== 5) {
    throw new IntegrationPolicyValidationError(
      "Schedule trigger cron must contain five fields.",
      {
        code: "integration_schedule_cron_invalid",
        details: { cron: normalized }
      }
    );
  }

  for (const part of parts) {
    if (!/^[0-9*/,\-]+$/.test(part)) {
      throw new IntegrationPolicyValidationError(
        "Schedule trigger cron contains unsupported characters.",
        {
          code: "integration_schedule_cron_invalid",
          details: { cron: normalized }
        }
      );
    }
  }

  return normalized;
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new IntegrationPolicyValidationError(`${field} is not supported.`, {
      code: "integration_policy_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new IntegrationPolicyValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new IntegrationPolicyValidationError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationPolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
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

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new IntegrationPolicyValidationError(`${field} must be an array.`);
  }

  return Object.freeze(value.map((entry) => normalizeRequiredString(entry, field)));
}

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new IntegrationPolicyValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new IntegrationPolicyValidationError(`${field} must be an ISO timestamp.`);
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
