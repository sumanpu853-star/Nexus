import {
  AuthorizationError,
  PROJECT_PERMISSIONS,
  assertProjectPermission
} from "./securityPolicy.js";

const DEFAULT_REDACTION_KEYS = Object.freeze([
  "api_key",
  "apikey",
  "authorization",
  "client_secret",
  "credential",
  "password",
  "private_key",
  "refresh_token",
  "secret",
  "token"
]);

export function createCredentialRecord({
  id,
  name,
  type,
  owner_id,
  project_id,
  encrypted_secret,
  metadata = {},
  redaction_keys = DEFAULT_REDACTION_KEYS,
  shared_with_user_ids = [],
  external_ref = null,
  created_at,
  updated_at = created_at
} = {}) {
  const normalizedEncryptedSecret = normalizeNullableString(
    encrypted_secret,
    "Credential encrypted_secret"
  );
  const normalizedExternalRef = normalizeNullableExternalRef(external_ref);

  if (!normalizedEncryptedSecret && !normalizedExternalRef) {
    throw new TypeError("Credential must define encrypted_secret or external_ref.");
  }

  return deepFreeze({
    id: normalizeRequiredString(id, "Credential id"),
    name: normalizeRequiredString(name, "Credential name"),
    type: normalizeRequiredString(type, "Credential type"),
    owner_id: normalizeRequiredString(owner_id, "Credential owner_id"),
    project_id: normalizeRequiredString(project_id, "Credential project_id"),
    encrypted_secret: normalizedEncryptedSecret,
    metadata: normalizePlainObject(metadata, "Credential metadata"),
    redaction_keys: normalizeStringList(redaction_keys, "Credential redaction_keys"),
    shared_with_user_ids: normalizeStringList(
      shared_with_user_ids,
      "Credential shared_with_user_ids"
    ),
    external_ref: normalizedExternalRef,
    created_at: normalizeTimestamp(created_at, "Credential created_at"),
    updated_at: normalizeTimestamp(updated_at, "Credential updated_at")
  });
}

export function toSafeCredential(credential) {
  if (!credential) {
    return null;
  }

  return deepFreeze({
    id: credential.id,
    name: credential.name,
    type: credential.type,
    owner_id: credential.owner_id,
    project_id: credential.project_id,
    metadata: deepClone(credential.metadata ?? {}),
    redaction_keys: [...(credential.redaction_keys ?? [])],
    shared_with_user_ids: [...(credential.shared_with_user_ids ?? [])],
    external_ref: credential.external_ref ? deepClone(credential.external_ref) : null,
    created_at: credential.created_at,
    updated_at: credential.updated_at
  });
}

export function assertCredentialBelongsToProject({
  credential,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!credential || credential.project_id !== projectId) {
    throw new AuthorizationError(
      "Credential is not available in this project.",
      "credential_not_in_project"
    );
  }

  return credential;
}

export function assertCredentialManagementPermission({
  actor_id,
  project_id,
  memberships
} = {}) {
  return assertProjectPermission({
    actor_id,
    project_id,
    memberships,
    permission: PROJECT_PERMISSIONS.MANAGE_CREDENTIALS
  });
}

export function assertCredentialSecretAccess({
  actor_id,
  credential,
  memberships
} = {}) {
  const actorId = normalizeRequiredString(actor_id, "Actor id");

  if (credential.owner_id === actorId || credential.shared_with_user_ids.includes(actorId)) {
    return credential;
  }

  try {
    assertProjectPermission({
      actor_id: actorId,
      project_id: credential.project_id,
      memberships,
      permission: PROJECT_PERMISSIONS.MANAGE_CREDENTIALS
    });
  } catch {
    throw new AuthorizationError(
      "User does not have access to this credential secret.",
      "credential_secret_access_required"
    );
  }

  return credential;
}

export function shareCredentialWithUser({
  credential,
  user_id,
  updated_at
} = {}) {
  const userId = normalizeRequiredString(user_id, "Shared credential user_id");
  const sharedWith = new Set(credential.shared_with_user_ids ?? []);
  sharedWith.add(userId);

  return createCredentialRecord({
    ...credential,
    shared_with_user_ids: [...sharedWith].sort(),
    updated_at
  });
}

export function getDefaultRedactionKeys() {
  return [...DEFAULT_REDACTION_KEYS];
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return Object.freeze(value.map((entry) => normalizeRequiredString(entry, field)));
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeNullableExternalRef(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizePlainObject(value, "Credential external_ref");

  return {
    ...normalized,
    provider: normalizeRequiredString(
      normalized.provider,
      "Credential external_ref.provider"
    ),
    ref: normalizeRequiredString(normalized.ref, "Credential external_ref.ref")
  };
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
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
