import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkspaceAdministrationService } from "../../src/application/workspaceAdministrationService.js";
import { WORKSPACE_ROLES } from "../../src/domain/workspacePolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkspaceRepositories
} from "../../src/infrastructure/inMemoryWorkspaceRepositories.js";
import {
  createWorkspaceAdministrationHttpHandler
} from "../../src/interfaces/workspaceAdministrationHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workspace administration http handler creates workspaces and links projects", async () => {
  const { handler, workflowService } = createWorkspaceHttpFixture();
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const created = await handler.handle({
    method: "POST",
    path: "/workspaces",
    actor: { id: "owner_1" },
    body: { name: "Enterprise Workspace" }
  });
  const workspaceId = created.body.workspace.id;
  const member = await handler.handle({
    method: "POST",
    path: `/workspaces/${workspaceId}/members`,
    actor: { id: "owner_1" },
    body: {
      user_id: "viewer_1",
      role: WORKSPACE_ROLES.VIEWER
    }
  });
  const linked = await handler.handle({
    method: "POST",
    path: `/workspaces/${workspaceId}/projects`,
    actor: { id: "owner_1" },
    body: { project_id: project.id }
  });
  const projects = await handler.handle({
    method: "GET",
    path: `/workspaces/${workspaceId}/projects`,
    actor: { id: "viewer_1" }
  });

  assert.equal(created.status, 201);
  assert.equal(member.body.membership.role, WORKSPACE_ROLES.VIEWER);
  assert.equal(linked.body.link.project_id, project.id);
  assert.equal(projects.body.projects[0].id, project.id);
});

test("workspace administration http handler maps auth failures", async () => {
  const { handler } = createWorkspaceHttpFixture();
  const response = await handler.handle({
    method: "GET",
    path: "/workspaces/workspace_1/projects",
    actor: { id: "outsider_1" }
  });

  assert.equal(response.status, 400);
});

function createWorkspaceHttpFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const workspaceRepositories = createInMemoryWorkspaceRepositories();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
    workflowRepository: securityRepositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const workspaceService = createWorkspaceAdministrationService({
    workspaceRepository: workspaceRepositories.workspaces,
    workspaceMembershipRepository: workspaceRepositories.memberships,
    workspaceProjectLinkRepository: workspaceRepositories.projectLinks,
    projectRepository: securityRepositories.projects,
    idGenerator,
    clock: () => new Date(timestamp)
  });

  return {
    workflowService,
    handler: createWorkspaceAdministrationHttpHandler({
      workspaceAdministrationService: workspaceService
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
