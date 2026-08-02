import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLES,
  assertWorkspacePermission,
  createWorkspaceMembershipRecord,
  createWorkspaceProjectLinkRecord,
  createWorkspaceRecord,
  workspaceRoleHasPermission
} from "../../src/domain/workspacePolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workspace policy creates workspace, membership, and project link records", () => {
  const workspace = createWorkspaceRecord({
    id: "workspace_1",
    name: "Enterprise",
    owner_id: "owner_1",
    created_at: timestamp
  });
  const membership = createWorkspaceMembershipRecord({
    workspace_id: workspace.id,
    user_id: "admin_1",
    role: WORKSPACE_ROLES.ADMIN,
    created_at: timestamp
  });
  const link = createWorkspaceProjectLinkRecord({
    workspace_id: workspace.id,
    project_id: "project_1",
    linked_by: "owner_1",
    created_at: timestamp
  });

  assert.equal(workspace.owner_id, "owner_1");
  assert.equal(membership.role, WORKSPACE_ROLES.ADMIN);
  assert.equal(link.project_id, "project_1");
  assert.equal(Object.isFrozen(workspace), true);
});

test("workspace policy gates permissions by workspace role", () => {
  const memberships = [
    createWorkspaceMembershipRecord({
      workspace_id: "workspace_1",
      user_id: "admin_1",
      role: WORKSPACE_ROLES.ADMIN,
      created_at: timestamp
    }),
    createWorkspaceMembershipRecord({
      workspace_id: "workspace_1",
      user_id: "viewer_1",
      role: WORKSPACE_ROLES.VIEWER,
      created_at: timestamp
    })
  ];

  assert.equal(
    workspaceRoleHasPermission(
      WORKSPACE_ROLES.ADMIN,
      WORKSPACE_PERMISSIONS.MANAGE_PROJECTS
    ),
    true
  );
  assert.equal(
    assertWorkspacePermission({
      actor_id: "viewer_1",
      workspace_id: "workspace_1",
      memberships,
      permission: WORKSPACE_PERMISSIONS.READ_WORKSPACE
    }).role,
    WORKSPACE_ROLES.VIEWER
  );
  assert.throws(
    () =>
      assertWorkspacePermission({
        actor_id: "viewer_1",
        workspace_id: "workspace_1",
        memberships,
        permission: WORKSPACE_PERMISSIONS.MANAGE_PROJECTS
      }),
    /workspace permission/
  );
});
