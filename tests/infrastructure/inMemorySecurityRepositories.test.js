import assert from "node:assert/strict";
import test from "node:test";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

test("in-memory security repositories return cloned records", async () => {
  const repositories = createInMemorySecurityRepositories();
  await repositories.users.save({
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    password_hash: "hash",
    created_at: "2026-07-26T00:00:00.000Z"
  });

  const user = await repositories.users.findById("user_1");
  user.email = "mutated@example.com";

  assert.equal((await repositories.users.findById("user_1")).email, "owner@example.com");
});

test("in-memory security repositories update user email indexes", async () => {
  const repositories = createInMemorySecurityRepositories();
  await repositories.users.save({
    id: "user_1",
    email: "old@example.com",
    name: "Owner",
    password_hash: "hash",
    created_at: "2026-07-26T00:00:00.000Z"
  });
  await repositories.users.save({
    id: "user_1",
    email: "new@example.com",
    name: "Owner",
    password_hash: "hash",
    created_at: "2026-07-26T00:00:00.000Z"
  });

  assert.equal(await repositories.users.findByEmail("old@example.com"), null);
  assert.equal((await repositories.users.findByEmail("new@example.com")).id, "user_1");
});

test("in-memory security repositories replace memberships per project user", async () => {
  const repositories = createInMemorySecurityRepositories();

  await repositories.memberships.save({
    project_id: "project_1",
    user_id: "user_1",
    role: "viewer",
    created_at: "2026-07-26T00:00:00.000Z"
  });
  await repositories.memberships.save({
    project_id: "project_1",
    user_id: "user_1",
    role: "editor",
    created_at: "2026-07-26T00:00:00.000Z"
  });

  assert.deepEqual(await repositories.memberships.findByProjectId("project_1"), [
    {
      project_id: "project_1",
      user_id: "user_1",
      role: "editor",
      created_at: "2026-07-26T00:00:00.000Z"
    }
  ]);
});

test("in-memory security repositories update workflow project indexes", async () => {
  const repositories = createInMemorySecurityRepositories();
  await repositories.workflows.save({
    id: "workflow_1",
    name: "RAG Intake",
    project_id: "project_1",
    owner_id: "user_1",
    draft_version: 1,
    published_version: null,
    nodes: [],
    edges: [],
    settings: {},
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    published_at: null,
    is_active: false
  });
  await repositories.workflows.save({
    id: "workflow_1",
    name: "RAG Intake",
    project_id: "project_2",
    owner_id: "user_1",
    draft_version: 1,
    published_version: null,
    nodes: [],
    edges: [],
    settings: {},
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    published_at: null,
    is_active: false
  });

  assert.deepEqual(await repositories.workflows.findByProjectId("project_1"), []);
  assert.equal((await repositories.workflows.findByProjectId("project_2")).length, 1);
});

test("in-memory security repositories update execution workflow indexes", async () => {
  const repositories = createInMemorySecurityRepositories();
  await repositories.executions.save({
    id: "execution_1",
    workflow_id: "workflow_1",
    workflow_version: 1,
    project_id: "project_1",
    status: "queued",
    trigger_source: "manual",
    mode: "manual",
    started_by: "user_1",
    partial_of_execution_id: null,
    rerun_from_node_id: null,
    input: {},
    output: null,
    error: null,
    failed_node_id: null,
    node_runs: [],
    plan: {},
    metadata: {},
    started_at: "2026-07-26T00:00:00.000Z",
    finished_at: null,
    duration_ms: null,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z"
  });
  await repositories.executions.save({
    id: "execution_1",
    workflow_id: "workflow_2",
    workflow_version: 1,
    project_id: "project_1",
    status: "queued",
    trigger_source: "manual",
    mode: "manual",
    started_by: "user_1",
    partial_of_execution_id: null,
    rerun_from_node_id: null,
    input: {},
    output: null,
    error: null,
    failed_node_id: null,
    node_runs: [],
    plan: {},
    metadata: {},
    started_at: "2026-07-26T00:00:00.000Z",
    finished_at: null,
    duration_ms: null,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z"
  });

  assert.deepEqual(await repositories.executions.findByWorkflowId("workflow_1"), []);
  assert.equal((await repositories.executions.findByWorkflowId("workflow_2")).length, 1);
});

test("in-memory security repositories update credential project indexes", async () => {
  const repositories = createInMemorySecurityRepositories();
  await repositories.credentials.save({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    project_id: "project_1",
    owner_id: "user_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    metadata: {},
    redaction_keys: ["token"],
    shared_with_user_ids: [],
    external_ref: null,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z"
  });
  await repositories.credentials.save({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    project_id: "project_2",
    owner_id: "user_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    metadata: {},
    redaction_keys: ["token"],
    shared_with_user_ids: [],
    external_ref: null,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z"
  });

  assert.deepEqual(await repositories.credentials.findByProjectId("project_1"), []);
  assert.equal((await repositories.credentials.findByProjectId("project_2")).length, 1);
});
