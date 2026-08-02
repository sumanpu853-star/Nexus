import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkspaceAdministrationService } from "../../src/application/workspaceAdministrationService.js";
import {
  WORKSPACE_ROLES
} from "../../src/domain/workspacePolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkspaceRepositories
} from "../../src/infrastructure/inMemoryWorkspaceRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workspace administration service manages members and project links", async () => {
  const { service, workflowService } = createWorkspaceFixture();
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const created = await service.createWorkspace({
    actor: { id: "owner_1" },
    name: "Enterprise Workspace"
  });

  await service.addWorkspaceMember({
    actor: { id: "owner_1" },
    workspace_id: created.workspace.id,
    user_id: "viewer_1",
    role: WORKSPACE_ROLES.VIEWER
  });
  const link = await service.linkProjectToWorkspace({
    actor: { id: "owner_1" },
    workspace_id: created.workspace.id,
    project_id: project.id
  });
  const projects = await service.listWorkspaceProjects({
    actor: { id: "viewer_1" },
    workspace_id: created.workspace.id
  });
  const members = await service.listWorkspaceMembers({
    actor: { id: "viewer_1" },
    workspace_id: created.workspace.id
  });

  assert.equal(created.membership.role, WORKSPACE_ROLES.OWNER);
  assert.equal(link.project_id, project.id);
  assert.equal(projects[0].id, project.id);
  assert.deepEqual(
    members.map((member) => [member.user_id, member.role]),
    [
      ["owner_1", WORKSPACE_ROLES.OWNER],
      ["viewer_1", WORKSPACE_ROLES.VIEWER]
    ]
  );
  await assert.rejects(
    () =>
      service.linkProjectToWorkspace({
        actor: { id: "viewer_1" },
        workspace_id: created.workspace.id,
        project_id: project.id
      }),
    /workspace permission/
  );
});

function createWorkspaceFixture() {
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

  return {
    workflowService,
    service: createWorkspaceAdministrationService({
      workspaceRepository: workspaceRepositories.workspaces,
      workspaceMembershipRepository: workspaceRepositories.memberships,
      workspaceProjectLinkRepository: workspaceRepositories.projectLinks,
      projectRepository: securityRepositories.projects,
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
