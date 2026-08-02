import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryWorkflowCollaborationRepositories
} from "../../src/infrastructure/inMemoryWorkflowCollaborationRepositories.js";

const timestamp = "2026-07-27T00:00:00.000Z";

test("in-memory workflow collaboration repositories save and clone records", async () => {
  const repositories = createInMemoryWorkflowCollaborationRepositories();

  await repositories.versions.save({
    id: "version_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    version: 1,
    name: "Workflow",
    nodes: [],
    edges: [],
    settings: {},
    created_by: "owner_1",
    created_at: timestamp
  });
  await repositories.comments.save({
    id: "comment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    body: "Looks good.",
    author_id: "owner_1",
    status: "open",
    metadata: {},
    created_at: timestamp,
    resolved_by: null,
    resolved_at: null
  });
  await repositories.templates.save({
    id: "template_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    source_version: 1,
    name: "Template",
    description: "",
    tags: [],
    nodes: [],
    edges: [],
    settings: {},
    created_by: "owner_1",
    created_at: timestamp
  });

  const version = (await repositories.versions.findByWorkflowId("workflow_1"))[0];
  const comment = (await repositories.comments.findByWorkflowId("workflow_1"))[0];
  const template = (await repositories.templates.findByProjectId("project_1"))[0];

  version.name = "Mutated";
  comment.body = "Mutated";
  template.name = "Mutated";

  assert.equal(
    (await repositories.versions.findById("version_1")).name,
    "Workflow"
  );
  assert.equal(
    (await repositories.comments.findById("comment_1")).body,
    "Looks good."
  );
  assert.equal(
    (await repositories.templates.findById("template_1")).name,
    "Template"
  );
});
