import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_PERMISSIONS,
  PROJECT_ROLES,
  assertPasswordPolicy,
  assertProjectPermission,
  assertWorkflowBelongsToProject,
  createProjectMembership,
  createUserAccount,
  createWorkflowRecord,
  normalizeEmail,
  roleHasPermission
} from "../../src/domain/securityPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("normalizes user accounts and strips unsafe email casing", () => {
  const user = createUserAccount({
    id: "user_1",
    email: "  OWNER@Example.COM ",
    name: " Owner ",
    password_hash: "hash",
    created_at: timestamp
  });

  assert.deepEqual(user, {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    password_hash: "hash",
    created_at: timestamp
  });
  assert.equal(Object.isFrozen(user), true);
});

test("validates email and password policy", () => {
  assert.equal(normalizeEmail("Admin@Example.com"), "admin@example.com");
  assert.throws(() => normalizeEmail("not-an-email"), /Email must be valid/);
  assert.throws(() => assertPasswordPolicy("short"), /at least 12 characters/);
  assert.doesNotThrow(() => assertPasswordPolicy("long-enough-password"));
});

test("maps project roles to permissions", () => {
  assert.equal(
    roleHasPermission(PROJECT_ROLES.OWNER, PROJECT_PERMISSIONS.MANAGE_CREDENTIALS),
    true
  );
  assert.equal(
    roleHasPermission(PROJECT_ROLES.VIEWER, PROJECT_PERMISSIONS.MANAGE_CREDENTIALS),
    false
  );
  assert.equal(
    roleHasPermission(PROJECT_ROLES.VIEWER, PROJECT_PERMISSIONS.READ_WORKFLOW),
    true
  );
  assert.equal(
    roleHasPermission(PROJECT_ROLES.EDITOR, PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES),
    true
  );
  assert.equal(
    roleHasPermission(PROJECT_ROLES.VIEWER, PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES),
    true
  );
  assert.equal(
    roleHasPermission(PROJECT_ROLES.VIEWER, PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES),
    false
  );
});

test("assertProjectPermission requires membership and role permission", () => {
  const memberships = [
    createProjectMembership({
      project_id: "project_1",
      user_id: "viewer_1",
      role: PROJECT_ROLES.VIEWER,
      created_at: timestamp
    })
  ];

  assertProjectPermission({
    actor_id: "viewer_1",
    project_id: "project_1",
    memberships,
    permission: PROJECT_PERMISSIONS.READ_WORKFLOW
  });
  assert.throws(
    () =>
      assertProjectPermission({
        actor_id: "viewer_1",
        project_id: "project_1",
        memberships,
        permission: PROJECT_PERMISSIONS.CREATE_WORKFLOW
      }),
    /required project permission/
  );
  assert.throws(
    () =>
      assertProjectPermission({
        actor_id: "outsider_1",
        project_id: "project_1",
        memberships,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      }),
    /does not belong/
  );
});

test("workflow records follow the roadmap object shape", () => {
  const workflow = createWorkflowRecord({
    id: "workflow_1",
    name: "RAG Intake",
    owner_id: "user_1",
    project_id: "project_1",
    nodes: [{ id: "trigger", type: "manual" }],
    edges: [],
    settings: { timeout_ms: 30000 },
    created_at: timestamp
  });

  assert.equal(workflow.draft_version, 1);
  assert.equal(workflow.published_version, null);
  assert.equal(workflow.is_active, false);
  assert.equal(Object.isFrozen(workflow.nodes[0]), true);
});

test("assertWorkflowBelongsToProject blocks cross-project workflow access", () => {
  const workflow = createWorkflowRecord({
    id: "workflow_1",
    name: "RAG Intake",
    owner_id: "user_1",
    project_id: "project_1",
    created_at: timestamp
  });

  assert.equal(
    assertWorkflowBelongsToProject({ workflow, project_id: "project_1" }),
    workflow
  );
  assert.throws(
    () => assertWorkflowBelongsToProject({ workflow, project_id: "project_2" }),
    /not available/
  );
});
