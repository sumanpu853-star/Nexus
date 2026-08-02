import {
  AuthorizationError
} from "./securityPolicy.js";

export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer"
});

export const WORKSPACE_PERMISSIONS = Object.freeze({
  MANAGE_WORKSPACE: "workspace:manage",
  MANAGE_MEMBERS: "workspace:members:manage",
  MANAGE_PROJECTS: "workspace:projects:manage",
  READ_WORKSPACE: "workspace:read",
  READ_AUDIT_LOGS: "workspace:audit_logs:read"
});

const ROLE_PERMISSIONS = new Map([
  [
    WORKSPACE_ROLES.OWNER,
    new Set(Object.values(WORKSPACE_PERMISSIONS))
  ],
  [
    WORKSPACE_ROLES.ADMIN,
    new Set(Object.values(WORKSPACE_PERMISSIONS))
  ],
  [
    WORKSPACE_ROLES.MEMBER,
    new Set([
      WORKSPACE_PERMISSIONS.READ_WORKSPACE
    ])
  ],
  [
    WORKSPACE_ROLES.VIEWER,
    new Set([
      WORKSPACE_PERMISSIONS.READ_WORKSPACE
    ])
  ]
]);

export function createWorkspaceRecord({
  id,
  name,
  owner_id,
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Workspace id"),
    name: normalizeRequiredString(name, "Workspace name"),
    owner_id: normalizeRequiredString(owner_id, "Workspace owner_id"),
    created_at: normalizeTimestamp(created_at, "Workspace created_at"),
    updated_at: normalizeTimestamp(updated_at, "Workspace updated_at")
  });
}

export function createWorkspaceMembershipRecord({
  workspace_id,
  user_id,
  role,
  created_at
} = {}) {
  return deepFreeze({
    workspace_id: normalizeRequiredString(
      workspace_id,
      "Workspace membership workspace_id"
    ),
    user_id: normalizeRequiredString(user_id, "Workspace membership user_id"),
    role: normalizeWorkspaceRole(role),
    created_at: normalizeTimestamp(created_at, "Workspace membership created_at")
  });
}

export function createWorkspaceProjectLinkRecord({
  workspace_id,
  project_id,
  linked_by,
  created_at
} = {}) {
  return deepFreeze({
    workspace_id: normalizeRequiredString(
      workspace_id,
      "Workspace project link workspace_id"
    ),
    project_id: normalizeRequiredString(
      project_id,
      "Workspace project link project_id"
    ),
    linked_by: normalizeRequiredString(
      linked_by,
      "Workspace project link linked_by"
    ),
    created_at: normalizeTimestamp(created_at, "Workspace project link created_at")
  });
}

export function workspaceRoleHasPermission(role, permission) {
  return ROLE_PERMISSIONS.get(normalizeWorkspaceRole(role)).has(
    normalizeWorkspacePermission(permission)
  );
}

export function assertWorkspacePermission({
  actor_id,
  workspace_id,
  memberships,
  permission
} = {}) {
  const membership = findWorkspaceMembership({
    actor_id,
    workspace_id,
    memberships
  });

  if (!membership) {
    throw new AuthorizationError(
      "User does not belong to this workspace.",
      "workspace_membership_required"
    );
  }

  if (!workspaceRoleHasPermission(membership.role, permission)) {
    throw new AuthorizationError(
      "User does not have the required workspace permission.",
      "workspace_permission_required"
    );
  }

  return membership;
}

export function findWorkspaceMembership({
  actor_id,
  workspace_id,
  memberships
} = {}) {
  const actorId = normalizeRequiredString(actor_id, "Actor id");
  const workspaceId = normalizeRequiredString(workspace_id, "Workspace id");
  const membershipList = normalizeArray(memberships, "Workspace memberships");

  return membershipList.find((membership) =>
    membership.user_id === actorId && membership.workspace_id === workspaceId
  ) ?? null;
}

export function assertWorkspaceProjectLinked({
  link,
  workspace_id,
  project_id
} = {}) {
  const workspaceId = normalizeRequiredString(workspace_id, "Workspace id");
  const projectId = normalizeRequiredString(project_id, "Project id");

  if (!link || link.workspace_id !== workspaceId || link.project_id !== projectId) {
    throw new AuthorizationError(
      "Project is not linked to this workspace.",
      "workspace_project_link_required"
    );
  }

  return link;
}

function normalizeWorkspaceRole(role) {
  if (!Object.values(WORKSPACE_ROLES).includes(role)) {
    throw new TypeError(`Unsupported workspace role: ${role}`);
  }

  return role;
}

function normalizeWorkspacePermission(permission) {
  if (!Object.values(WORKSPACE_PERMISSIONS).includes(permission)) {
    throw new TypeError(`Unsupported workspace permission: ${permission}`);
  }

  return permission;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
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

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
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
