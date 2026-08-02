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
  createInMemorySecurityRepositories
} from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkflowCollaborationRepositories
} from "../../src/infrastructure/inMemoryWorkflowCollaborationRepositories.js";
import {
  createWorkflowCollaborationHttpHandler
} from "../../src/interfaces/workflowCollaborationHttpHandler.js";

const timestamp = "2026-07-27T00:00:00.000Z";

test("workflow collaboration http handler manages versions, comments, templates, and packages", async () => {
  const { handler, workflowService, securityRepositories, project, workflow } =
    await createHttpFixture();

  const snapshot1 = await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/versions`,
    actor: { id: "owner_1" },
    body: {
      project_id: project.id,
      change_summary: "Initial version"
    }
  });

  assert.equal(snapshot1.status, 201);
  assert.equal(snapshot1.body.version.version, 1);

  await securityRepositories.workflows.save(
    createWorkflowRecord({
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
      updated_at: "2026-07-27T01:00:00.000Z"
    })
  );

  await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/versions`,
    actor: { id: "owner_1" },
    body: {
      project_id: project.id,
      change_summary: "Add HTTP request"
    }
  });

  const compare = await handler.handle({
    method: "GET",
    path: `/workflows/${workflow.id}/versions/compare`,
    actor: { id: "viewer_1" },
    query: {
      project_id: project.id,
      left_version: "1",
      right_version: "2"
    }
  });
  const comment = await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/comments`,
    actor: { id: "viewer_1" },
    body: {
      project_id: project.id,
      version: 2,
      node_id: "http",
      body: "Please review this new request."
    }
  });
  const template = await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/templates`,
    actor: { id: "owner_1" },
    body: {
      project_id: project.id,
      version: 2,
      template_id: "template_http",
      name: "HTTP Collaboration Template",
      tags: ["http"]
    }
  });
  const restore = await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/versions/1/restore`,
    actor: { id: "owner_1" },
    body: {
      project_id: project.id
    }
  });
  const exportPackage = await handler.handle({
    method: "GET",
    path: `/workflows/${workflow.id}/export-package`,
    actor: { id: "viewer_1" },
    query: {
      project_id: project.id
    }
  });
  const second = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Imported Project"
  });
  const imported = await handler.handle({
    method: "POST",
    path: "/workflows/import-package",
    actor: { id: "owner_1" },
    body: {
      project_id: second.project.id,
      package_data: exportPackage.body.package_data,
      name: "Imported Via HTTP"
    }
  });
  const versions = await handler.handle({
    method: "GET",
    path: `/workflows/${workflow.id}/versions`,
    actor: { id: "viewer_1" },
    query: {
      project_id: project.id
    }
  });

  assert.equal(compare.status, 200);
  assert.equal(compare.body.comparison.summary.added_nodes, 1);
  assert.equal(comment.status, 201);
  assert.equal(template.body.template.source_version, 2);
  assert.equal(restore.body.restore_result.workflow.draft_version, 3);
  assert.equal(exportPackage.body.package_data.versions.length, 3);
  assert.equal(imported.status, 201);
  assert.equal(imported.body.import_result.workflow.name, "Imported Via HTTP");
  assert.deepEqual(
    versions.body.versions.map((version) => version.version),
    [1, 2, 3]
  );
});

test("workflow collaboration http handler maps authorization failures", async () => {
  const { handler, project, workflow } = await createHttpFixture();

  await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/versions`,
    actor: { id: "owner_1" },
    body: {
      project_id: project.id
    }
  });

  const response = await handler.handle({
    method: "POST",
    path: `/workflows/${workflow.id}/versions/1/restore`,
    actor: { id: "viewer_1" },
    body: {
      project_id: project.id
    }
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "forbidden");
});

async function createHttpFixture() {
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
  const collaborationService = createWorkflowCollaborationService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
    workflowRepository: securityRepositories.workflows,
    versionRepository: collaborationRepositories.versions,
    commentRepository: collaborationRepositories.comments,
    templateRepository: collaborationRepositories.templates,
    idGenerator,
    clock: () => new Date(timestamp)
  });

  return {
    project,
    workflow,
    workflowService,
    securityRepositories,
    collaborationRepositories,
    handler: createWorkflowCollaborationHttpHandler({
      workflowCollaborationService: collaborationService
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
