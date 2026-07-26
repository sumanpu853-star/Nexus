export const PROJECT_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer"
});

export const PROJECT_PERMISSIONS = Object.freeze({
  MANAGE_PROJECT: "project:manage",
  MANAGE_MEMBERS: "project:members:manage",
  MANAGE_CREDENTIALS: "credentials:manage",
  MANAGE_KNOWLEDGE_BASES: "knowledge_bases:manage",
  READ_KNOWLEDGE_BASES: "knowledge_bases:read",
  MANAGE_AGENTS: "agents:manage",
  READ_AGENTS: "agents:read",
  RUN_AGENTS: "agents:run",
  MANAGE_INTEGRATIONS: "integrations:manage",
  READ_INTEGRATIONS: "integrations:read",
  RUN_INTEGRATIONS: "integrations:run",
  MANAGE_DEPLOYMENTS: "deployments:manage",
  READ_DEPLOYMENTS: "deployments:read",
  CREATE_WORKFLOW: "workflow:create",
  READ_WORKFLOW: "workflow:read",
  UPDATE_WORKFLOW: "workflow:update",
  RUN_WORKFLOW: "workflow:run"
});

const ROLE_PERMISSIONS = new Map([
  [
    PROJECT_ROLES.OWNER,
    new Set([
      PROJECT_PERMISSIONS.MANAGE_PROJECT,
      PROJECT_PERMISSIONS.MANAGE_MEMBERS,
      PROJECT_PERMISSIONS.MANAGE_CREDENTIALS,
      PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.MANAGE_AGENTS,
      PROJECT_PERMISSIONS.READ_AGENTS,
      PROJECT_PERMISSIONS.RUN_AGENTS,
      PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS,
      PROJECT_PERMISSIONS.READ_INTEGRATIONS,
      PROJECT_PERMISSIONS.RUN_INTEGRATIONS,
      PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS,
      PROJECT_PERMISSIONS.READ_DEPLOYMENTS,
      PROJECT_PERMISSIONS.CREATE_WORKFLOW,
      PROJECT_PERMISSIONS.READ_WORKFLOW,
      PROJECT_PERMISSIONS.UPDATE_WORKFLOW,
      PROJECT_PERMISSIONS.RUN_WORKFLOW
    ])
  ],
  [
    PROJECT_ROLES.ADMIN,
    new Set([
      PROJECT_PERMISSIONS.MANAGE_PROJECT,
      PROJECT_PERMISSIONS.MANAGE_MEMBERS,
      PROJECT_PERMISSIONS.MANAGE_CREDENTIALS,
      PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.MANAGE_AGENTS,
      PROJECT_PERMISSIONS.READ_AGENTS,
      PROJECT_PERMISSIONS.RUN_AGENTS,
      PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS,
      PROJECT_PERMISSIONS.READ_INTEGRATIONS,
      PROJECT_PERMISSIONS.RUN_INTEGRATIONS,
      PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS,
      PROJECT_PERMISSIONS.READ_DEPLOYMENTS,
      PROJECT_PERMISSIONS.CREATE_WORKFLOW,
      PROJECT_PERMISSIONS.READ_WORKFLOW,
      PROJECT_PERMISSIONS.UPDATE_WORKFLOW,
      PROJECT_PERMISSIONS.RUN_WORKFLOW
    ])
  ],
  [
    PROJECT_ROLES.EDITOR,
    new Set([
      PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.MANAGE_AGENTS,
      PROJECT_PERMISSIONS.READ_AGENTS,
      PROJECT_PERMISSIONS.RUN_AGENTS,
      PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS,
      PROJECT_PERMISSIONS.READ_INTEGRATIONS,
      PROJECT_PERMISSIONS.RUN_INTEGRATIONS,
      PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS,
      PROJECT_PERMISSIONS.READ_DEPLOYMENTS,
      PROJECT_PERMISSIONS.CREATE_WORKFLOW,
      PROJECT_PERMISSIONS.READ_WORKFLOW,
      PROJECT_PERMISSIONS.UPDATE_WORKFLOW,
      PROJECT_PERMISSIONS.RUN_WORKFLOW
    ])
  ],
  [
    PROJECT_ROLES.VIEWER,
    new Set([
      PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES,
      PROJECT_PERMISSIONS.READ_AGENTS,
      PROJECT_PERMISSIONS.READ_INTEGRATIONS,
      PROJECT_PERMISSIONS.READ_DEPLOYMENTS,
      PROJECT_PERMISSIONS.READ_WORKFLOW
    ])
  ]
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

export class AuthenticationError extends Error {
  constructor(message, code = "authentication_failed") {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export class AuthorizationError extends Error {
  constructor(message, code = "forbidden") {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function normalizeEmail(email) {
  if (typeof email !== "string") {
    throw new TypeError("Email must be a string.");
  }

  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new TypeError("Email must be valid.");
  }

  return normalized;
}

export function assertPasswordPolicy(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthenticationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      "weak_password"
    );
  }
}

export function createUserAccount({
  id,
  email,
  name = "",
  password_hash,
  created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "User id"),
    email: normalizeEmail(email),
    name: normalizeOptionalString(name, "User name"),
    password_hash: normalizeRequiredString(password_hash, "Password hash"),
    created_at: normalizeTimestamp(created_at, "User created_at")
  });
}

export function createProject({
  id,
  name,
  owner_id,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Project id"),
    name: normalizeRequiredString(name, "Project name"),
    owner_id: normalizeRequiredString(owner_id, "Project owner_id"),
    created_at: normalizeTimestamp(created_at, "Project created_at"),
    updated_at: normalizeTimestamp(updated_at, "Project updated_at")
  });
}

export function createProjectMembership({
  project_id,
  user_id,
  role,
  created_at
} = {}) {
  return deepFreeze({
    project_id: normalizeRequiredString(project_id, "Membership project_id"),
    user_id: normalizeRequiredString(user_id, "Membership user_id"),
    role: normalizeProjectRole(role),
    created_at: normalizeTimestamp(created_at, "Membership created_at")
  });
}

export function createWorkflowRecord({
  id,
  name,
  description = "",
  owner_id,
  project_id,
  draft_version = 1,
  published_version = null,
  nodes = [],
  edges = [],
  settings = {},
  created_at,
  updated_at = created_at,
  published_at = null,
  is_active = false
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Workflow id"),
    name: normalizeRequiredString(name, "Workflow name"),
    description: normalizeOptionalString(description, "Workflow description"),
    owner_id: normalizeRequiredString(owner_id, "Workflow owner_id"),
    project_id: normalizeRequiredString(project_id, "Workflow project_id"),
    draft_version: normalizePositiveInteger(draft_version, "Workflow draft_version"),
    published_version: normalizeNullablePositiveInteger(
      published_version,
      "Workflow published_version"
    ),
    nodes: normalizeArray(nodes, "Workflow nodes"),
    edges: normalizeArray(edges, "Workflow edges"),
    settings: normalizePlainObject(settings, "Workflow settings"),
    created_at: normalizeTimestamp(created_at, "Workflow created_at"),
    updated_at: normalizeTimestamp(updated_at, "Workflow updated_at"),
    published_at: normalizeNullableTimestamp(published_at, "Workflow published_at"),
    is_active: Boolean(is_active)
  });
}

export function roleHasPermission(role, permission) {
  const normalizedRole = normalizeProjectRole(role);
  const normalizedPermission = normalizePermission(permission);

  return ROLE_PERMISSIONS.get(normalizedRole).has(normalizedPermission);
}

export function assertProjectPermission({
  actor_id,
  project_id,
  memberships,
  permission
} = {}) {
  const membership = findProjectMembership({
    actor_id,
    project_id,
    memberships
  });

  if (!membership) {
    throw new AuthorizationError("User does not belong to this project.", "project_membership_required");
  }

  if (!roleHasPermission(membership.role, permission)) {
    throw new AuthorizationError("User does not have the required project permission.");
  }

  return membership;
}

export function findProjectMembership({
  actor_id,
  project_id,
  memberships
} = {}) {
  const actorId = normalizeRequiredString(actor_id, "Actor id");
  const projectId = normalizeRequiredString(project_id, "Project id");
  const membershipList = normalizeArray(memberships, "Project memberships");

  return (
    membershipList.find(
      (membership) => membership.user_id === actorId && membership.project_id === projectId
    ) ?? null
  );
}

export function assertWorkflowBelongsToProject({
  workflow,
  project_id
} = {}) {
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!workflow || workflow.project_id !== projectId) {
    throw new AuthorizationError("Workflow is not available in this project.", "workflow_not_in_project");
  }

  return workflow;
}

function normalizeProjectRole(role) {
  if (!Object.values(PROJECT_ROLES).includes(role)) {
    throw new TypeError(`Unsupported project role: ${role}`);
  }

  return role;
}

function normalizePermission(permission) {
  if (!Object.values(PROJECT_PERMISSIONS).includes(permission)) {
    throw new TypeError(`Unsupported project permission: ${permission}`);
  }

  return permission;
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

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeNullablePositiveInteger(value, field) {
  if (value === null) {
    return null;
  }

  return normalizePositiveInteger(value, field);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return deepClone(value);
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
