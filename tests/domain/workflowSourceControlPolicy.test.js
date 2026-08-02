import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFLOW_SOURCE_CONTROL_DESTINATIONS,
  createWorkflowExportFiles,
  createWorkflowSourceControlExportRecord
} from "../../src/domain/workflowSourceControlPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow source control policy creates canonical export files", () => {
  const files = createWorkflowExportFiles({
    workflow: {
      id: "workflow_1",
      project_id: "project_1",
      name: "Support",
      draft_version: 2,
      nodes: [{ id: "manual", type: "manual" }],
      edges: []
    },
    exported_by: "owner_1",
    exported_at: timestamp
  });
  const workflowPayload = JSON.parse(files[0].content);

  assert.equal(files[0].path, "workflows/workflow_1/workflow.v2.json");
  assert.equal(files[1].path, "workflows/workflow_1/manifest.json");
  assert.equal(workflowPayload.exported_version, 2);
  assert.equal(files[0].content.endsWith("\n"), true);
});

test("workflow source control policy validates export records", () => {
  const record = createWorkflowSourceControlExportRecord({
    id: "workflow_export_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    workflow_version: 1,
    destination: {
      type: WORKFLOW_SOURCE_CONTROL_DESTINATIONS.GIT,
      repository: "git@example.com:nexus/workflows.git",
      branch: "main"
    },
    files: [
      {
        path: "workflows/workflow_1/workflow.v1.json",
        content: "{}"
      }
    ],
    commit_ref: "git:abc123",
    exported_by: "owner_1",
    exported_at: timestamp
  });

  assert.equal(record.destination.type, "git");
  assert.throws(
    () =>
      createWorkflowSourceControlExportRecord({
        ...record,
        files: [{ path: "../outside.json", content: "{}" }]
      }),
    /inside the export root/
  );
});
