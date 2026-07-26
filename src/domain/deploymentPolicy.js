export const DEPLOYMENT_ENVIRONMENTS = Object.freeze({
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production"
});

export const DEPLOYMENT_STATUSES = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled"
});

export class DeploymentPolicyValidationError extends Error {
  constructor(message, {
    code = "deployment_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "DeploymentPolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createDeploymentEnvironmentRecord({
  id,
  project_id,
  environment,
  variables = {},
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Deployment environment id"),
    project_id: normalizeRequiredString(
      project_id,
      "Deployment environment project_id"
    ),
    environment: normalizeDeploymentEnvironment(environment),
    variables: normalizeEnvironmentVariables(variables),
    created_at: normalizeTimestamp(created_at, "Deployment environment created_at"),
    updated_at: normalizeTimestamp(updated_at, "Deployment environment updated_at")
  });
}

export function createDeploymentRecord({
  id,
  project_id,
  workflow_id,
  workflow_version,
  environment,
  status = DEPLOYMENT_STATUSES.ACTIVE,
  webhook_url,
  variable_snapshot = {},
  created_by,
  created_at,
  published_at = created_at,
  disabled_at = null
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Deployment id"),
    project_id: normalizeRequiredString(project_id, "Deployment project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Deployment workflow_id"),
    workflow_version: normalizePositiveInteger(
      workflow_version,
      "Deployment workflow_version"
    ),
    environment: normalizeDeploymentEnvironment(environment),
    status: normalizeEnum(status, DEPLOYMENT_STATUSES, "Deployment status"),
    webhook_url: normalizeUrl(webhook_url, "Deployment webhook_url"),
    variable_snapshot: normalizeEnvironmentVariables(variable_snapshot),
    created_by: normalizeRequiredString(created_by, "Deployment created_by"),
    created_at: normalizeTimestamp(created_at, "Deployment created_at"),
    published_at: normalizeTimestamp(published_at, "Deployment published_at"),
    disabled_at: normalizeNullableTimestamp(disabled_at, "Deployment disabled_at")
  });
}

export function createDeploymentWebhookUrl({
  base_url,
  project_id,
  environment,
  workflow_id
} = {}) {
  const baseUrl = normalizeUrl(base_url, "Deployment webhook base_url").replace(/\/+$/, "");
  const projectId = normalizeRequiredString(project_id, "Project id");
  const normalizedEnvironment = normalizeDeploymentEnvironment(environment);
  const workflowId = normalizeRequiredString(workflow_id, "Workflow id");

  return `${baseUrl}/webhooks/${encodeURIComponent(projectId)}/${normalizedEnvironment}/${encodeURIComponent(workflowId)}`;
}

export function normalizeDeploymentEnvironment(environment) {
  return normalizeEnum(
    environment,
    DEPLOYMENT_ENVIRONMENTS,
    "Deployment environment"
  );
}

export function assertDeploymentBelongsToProject({
  deployment,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!deployment || deployment.project_id !== projectId) {
    throw new DeploymentPolicyValidationError(
      "Deployment is not available in this project.",
      {
        code: "deployment_not_in_project",
        details: { project_id: projectId }
      }
    );
  }

  return deployment;
}

export function assertDeploymentEnvironmentBelongsToProject({
  deploymentEnvironment,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!deploymentEnvironment || deploymentEnvironment.project_id !== projectId) {
    throw new DeploymentPolicyValidationError(
      "Deployment environment is not available in this project.",
      {
        code: "deployment_environment_not_in_project",
        details: { project_id: projectId }
      }
    );
  }

  return deploymentEnvironment;
}

function normalizeEnvironmentVariables(value) {
  const variables = normalizePlainObject(value, "Deployment environment variables");
  const normalized = {};

  for (const [key, entry] of Object.entries(variables).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const variableName = normalizeVariableName(key);
    normalized[variableName] = normalizeVariableValue(entry, variableName);
  }

  return normalized;
}

function normalizeVariableName(value) {
  const name = normalizeRequiredString(value, "Deployment environment variable name");

  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    throw new DeploymentPolicyValidationError(
      "Deployment environment variable names must use uppercase letters, numbers, and underscores.",
      {
        code: "deployment_variable_name_invalid",
        details: { variable: name }
      }
    );
  }

  return name;
}

function normalizeVariableValue(value, variableName) {
  if (typeof value === "string") {
    return deepFreeze({
      value,
      is_secret: false,
      secret_ref: null
    });
  }

  const normalized = normalizePlainObject(
    value,
    `Deployment environment variable ${variableName}`
  );
  const isSecret = Boolean(normalized.is_secret);
  const secretRef = normalizeNullableRequiredString(
    normalized.secret_ref,
    `Deployment environment variable ${variableName} secret_ref`
  );

  if (isSecret) {
    if (!secretRef) {
      throw new DeploymentPolicyValidationError(
        "Secret deployment environment variables must use secret_ref.",
        {
          code: "deployment_secret_variable_ref_required",
          details: { variable: variableName }
        }
      );
    }

    if (normalized.value !== undefined && normalized.value !== null) {
      throw new DeploymentPolicyValidationError(
        "Secret deployment environment variables must not store raw values.",
        {
          code: "deployment_secret_variable_value_forbidden",
          details: { variable: variableName }
        }
      );
    }

    return deepFreeze({
      value: null,
      is_secret: true,
      secret_ref: secretRef
    });
  }

  if (secretRef) {
    throw new DeploymentPolicyValidationError(
      "Non-secret deployment environment variables must not define secret_ref.",
      {
        code: "deployment_plain_variable_secret_ref_forbidden",
        details: { variable: variableName }
      }
    );
  }

  return deepFreeze({
    value: normalizeStringValue(
      normalized.value ?? "",
      `Deployment environment variable ${variableName} value`
    ),
    is_secret: false,
    secret_ref: null
  });
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new DeploymentPolicyValidationError(`${field} is not supported.`, {
      code: "deployment_policy_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DeploymentPolicyValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeStringValue(value, field) {
  if (typeof value !== "string") {
    throw new DeploymentPolicyValidationError(`${field} must be a string.`);
  }

  return value;
}

function normalizeNullableRequiredString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeploymentPolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new DeploymentPolicyValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeUrl(value, field) {
  const normalized = normalizeRequiredString(value, field);

  try {
    const url = new URL(normalized);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }

    return url.toString();
  } catch {
    throw new DeploymentPolicyValidationError(`${field} must be an HTTP URL.`);
  }
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new DeploymentPolicyValidationError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
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
