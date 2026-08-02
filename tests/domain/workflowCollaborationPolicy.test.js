import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_COMMENT_STATUSES,
  WORKFLOW_COLLABORATION_PACKAGE_FORMAT,
  WORKFLOW_VERSION_SOURCES,
  compareWorkflowVersions,
  createWorkflowCollaborationPackage,
  createWorkflowCollaborationTemplateRecord,
  createWorkflowCommentRecord,
  createWorkflowVersionRecord,
  createWorkflowVersionRecordFromWorkflow,
  filterWorkflowComments,
  resolveWorkflowCommentRecord
} from "../../src/domain/workflowCollaborationPolicy.js";

const timestamp = "2026-07-27T00:00:00.000Z";

test("workflow collaboration policy creates version and comment records", () => {
  const workflow = createWorkflow();
  const version = createWorkflowVersionRecordFromWorkflow({
    id: "version_1",
    workflow,
    change_summary: "Initial version",
    created_by: "owner_1",
    created_at: timestamp
  });
  const comment = createWorkflowCommentRecord({
    id: "comment_1",
    project_id: workflow.project_id,
    workflow_id: workflow.id,
    version: 1,
    node_id: "manual",
    body: "Please confirm the manual trigger copy.",
    author_id: "viewer_1",
    created_at: timestamp
  });
  const resolved = resolveWorkflowCommentRecord({
    comment,
    resolved_by: "owner_1",
    resolved_at: "2026-07-27T01:00:00.000Z"
  });

  assert.equal(version.version, 1);
  assert.equal(version.source, WORKFLOW_VERSION_SOURCES.SNAPSHOT);
  assert.equal(comment.status, WORKFLOW_COMMENT_STATUSES.OPEN);
  assert.equal(resolved.status, WORKFLOW_COMMENT_STATUSES.RESOLVED);
  assert.equal(resolved.resolved_by, "owner_1");
});

test("workflow collaboration policy compares workflow versions", () => {
  const left = createVersion({
    version: 1,
    nodes: [{ id: "manual", type: "manual" }],
    settings: { execution_mode: "manual" }
  });
  const right = createVersion({
    version: 2,
    name: "Updated Workflow",
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "http",
        type: "http_request",
        parameters: {
          method: "GET",
          url: "https://example.com"
        }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http", type: "success" }
    ],
    settings: { execution_mode: "manual", concurrency: 2 }
  });

  const comparison = compareWorkflowVersions({ left, right });

  assert.equal(comparison.summary.added_nodes, 1);
  assert.equal(comparison.summary.added_edges, 1);
  assert.equal(comparison.summary.metadata_changed, 1);
  assert.equal(comparison.summary.settings_changed, true);
  assert.equal(comparison.changes.some((change) => change.path === "nodes.http"), true);
});

test("workflow collaboration policy filters comments and creates templates", () => {
  const open = createWorkflowCommentRecord({
    id: "comment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    version: 1,
    node_id: "manual",
    body: "Open comment",
    author_id: "viewer_1",
    created_at: timestamp
  });
  const resolved = resolveWorkflowCommentRecord({
    comment: {
      ...open,
      id: "comment_2",
      body: "Resolved comment",
      created_at: "2026-07-27T01:00:00.000Z"
    },
    resolved_by: "owner_1",
    resolved_at: "2026-07-27T02:00:00.000Z"
  });
  const template = createWorkflowCollaborationTemplateRecord({
    id: "template_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    source_version: 1,
    name: "Review Template",
    tags: ["review"],
    nodes: [{ id: "manual", type: "manual" }],
    edges: [],
    settings: {},
    created_by: "owner_1",
    created_at: timestamp
  });

  assert.deepEqual(
    filterWorkflowComments({
      comments: [resolved, open],
      status: WORKFLOW_COMMENT_STATUSES.OPEN
    }).map((comment) => comment.id),
    ["comment_1"]
  );
  assert.equal(template.source_version, 1);
  assert.equal(template.tags[0], "review");
});

test("workflow collaboration policy creates portable packages", () => {
  const workflow = createWorkflow();
  const version = createWorkflowVersionRecordFromWorkflow({
    id: "version_1",
    workflow,
    created_by: "owner_1",
    created_at: timestamp
  });
  const packageData = createWorkflowCollaborationPackage({
    workflow,
    versions: [version],
    comments: [],
    templates: [],
    exported_by: "owner_1",
    exported_at: timestamp
  });

  assert.equal(packageData.format, WORKFLOW_COLLABORATION_PACKAGE_FORMAT);
  assert.equal(packageData.workflow.id, workflow.id);
  assert.equal(packageData.versions[0].version, 1);
});

function createWorkflow(overrides = {}) {
  return {
    id: "workflow_1",
    project_id: "project_1",
    owner_id: "owner_1",
    name: "Workflow",
    description: "",
    draft_version: 1,
    published_version: null,
    nodes: [{ id: "manual", type: "manual" }],
    edges: [],
    settings: {},
    created_at: timestamp,
    updated_at: timestamp,
    published_at: null,
    is_active: false,
    ...overrides
  };
}

function createVersion(overrides = {}) {
  return createWorkflowVersionRecord({
    id: `version_${overrides.version ?? 1}`,
    project_id: "project_1",
    workflow_id: "workflow_1",
    version: 1,
    name: "Workflow",
    description: "",
    nodes: [{ id: "manual", type: "manual" }],
    edges: [],
    settings: {},
    created_by: "owner_1",
    created_at: timestamp,
    ...overrides
  });
}
