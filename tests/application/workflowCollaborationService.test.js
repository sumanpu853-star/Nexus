import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectWorkflowSecurityService
} from "../../src/application/projectWorkflowSecurityService.js";
import {
  createWorkflowCollaborationService
} from "../../src/application/workflowCollaborationService.js";
import {
  PROJECT_ROLES,
  createWorkflowRecord
} from "../../src/domain/securityPolicy.js";
import {
  WORKFLOW_COMMENT_STATUSES
} from "../../src/domain/workflowCollaborationPolicy.js";
import {
  createInMemorySecurityRepositories
} from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkflowCollaborationRepositories
} from "../../src/infrastructure/inMemoryWorkflowCollaborationRepositories.js";

const timestamp = "2026-07-27T00:00:00.000Z";

test("workflow collaboration service versions, compares, restores, comments, and templates", async () => {
  const { service, workflowService, securityRepositories, project, workflow } =
    await createCollaborationFixture();

  const version1 = await service.createWorkflowVersion({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    change_summary: "Initial workflow"
  });
  const updatedWorkflow = createWorkflowRecord({
    ...workflow,
    draft_version: 2,
    nodes: [
      ...workflow.nodes,
      {
        id: "http",
        type: "http_request",
        label: "HTTP Request",
        parameters: {
          method: "GET",
          url: "https://example.com"
        },
        credential_refs: {},
        timeout_ms: 30000,
        retry: {
          max_attempts: 1,
          backoff_ms: 0
        }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http", type: "success" }
    ],
    settings: {
      execution_mode: "manual",
      concurrency: 2
    },
    updated_at: "2026-07-27T01:00:00.000Z"
  });

  await securityRepositories.workflows.save(updatedWorkflow);

  const version2 = await service.createWorkflowVersion({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    change_summary: "Add HTTP request"
  });
  const comparison = await service.compareWorkflowVersions({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    left_version: version1.version,
    right_version: version2.version
  });
  const comment = await service.addWorkflowComment({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    version: 2,
    node_id: "http",
    body: "Please check retry behavior.",
    metadata: {
      severity: "medium"
    }
  });
  const resolved = await service.resolveWorkflowComment({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    comment_id: comment.id
  });
  const template = await service.createWorkflowTemplateFromVersion({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    version: 2,
    template_id: "template_review",
    name: "HTTP Review Template",
    tags: ["http", "review"]
  });
  const restored = await service.restoreWorkflowVersion({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    version: 1
  });
  const versions = await service.listWorkflowVersions({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id
  });

  assert.equal(comparison.summary.added_nodes, 1);
  assert.equal(resolved.status, WORKFLOW_COMMENT_STATUSES.RESOLVED);
  assert.equal(template.source_version, 2);
  assert.equal(restored.workflow.draft_version, 3);
  assert.equal(restored.workflow.nodes.length, 1);
  assert.deepEqual(versions.map((version) => version.version), [1, 2, 3]);

  const second = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Second Project"
  });
  const packageData = await service.exportWorkflowCollaborationPackage({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id
  });
  const imported = await service.importWorkflowCollaborationPackage({
    actor: { id: "owner_1" },
    project_id: second.project.id,
    package_data: packageData,
    name: "Imported Workflow"
  });

  assert.notEqual(imported.workflow.id, workflow.id);
  assert.equal(imported.workflow.project_id, second.project.id);
  assert.equal(imported.workflow.name, "Imported Workflow");
  assert.equal(imported.versions.length, 3);
  assert.equal(imported.comments.length, 1);
  assert.equal(imported.templates.length, 1);
});

test("workflow collaboration service enforces write permissions", async () => {
  const { service, project, workflow } = await createCollaborationFixture();

  await service.createWorkflowVersion({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id
  });

  await assert.rejects(
    () =>
      service.restoreWorkflowVersion({
        actor: { id: "viewer_1" },
        project_id: project.id,
        workflow_id: workflow.id,
        version: 1
      }),
    /required project permission/
  );

  const comment = await service.addWorkflowComment({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    body: "Viewer can still participate."
  });

  assert.equal(comment.author_id, "viewer_1");
});

async function createCollaborationFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const collaborationRepositories = createInMemoryWorkflowCollaborationRepositories();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
    workflowRepository: securityRepositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });

  await workflowService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  const workflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Collaborative Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });

  return {
    project,
    workflow,
    workflowService,
    securityRepositories,
    collaborationRepositories,
    service: createWorkflowCollaborationService({
      projectRepository: securityRepositories.projects,
      membershipRepository: securityRepositories.memberships,
      workflowRepository: securityRepositories.workflows,
      versionRepository: collaborationRepositories.versions,
      commentRepository: collaborationRepositories.comments,
      templateRepository: collaborationRepositories.templates,
      idGenerator,
      clock: () => new Date(timestamp)
    })
  };
}

function sequenceIds() {
  const counters = new Map();

  return {
    nextId(prefix) {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);

      return `${prefix}_${next}`;
    }
  };
}
