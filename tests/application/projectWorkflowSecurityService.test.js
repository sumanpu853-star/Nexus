import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("createProjectForUser creates owner membership for project isolation", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  const result = await service.createProjectForUser({
    actor: { id: "user_1" },
    name: "Ops Automation"
  });

  assert.equal(result.project.owner_id, "user_1");
  assert.deepEqual(result.membership, {
    project_id: "project_1",
    user_id: "user_1",
    role: PROJECT_ROLES.OWNER,
    created_at: timestamp
  });
});

test("createWorkflow requires project membership with write permission", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const { project } = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  await service.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "RAG Intake",
    nodes: [{ id: "manual", type: "manual" }],
    edges: []
  });

  assert.equal(workflow.project_id, project.id);
  assert.equal(workflow.owner_id, "owner_1");
  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "viewer_1" },
        project_id: project.id,
        name: "Viewer Workflow"
      }),
    /required project permission/
  );
});

test("listProjectWorkflows allows viewers and blocks outsiders", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const { project } = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  await service.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });
  await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "RAG Intake"
  });

  const workflows = await service.listProjectWorkflows({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].name, "RAG Intake");
  await assert.rejects(
    () =>
      service.listProjectWorkflows({
        actor: { id: "outsider_1" },
        project_id: project.id
      }),
    /does not belong/
  );
});

test("getWorkflow blocks cross-project workflow access", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const first = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "First Project"
  });
  const second = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Second Project"
  });
  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: first.project.id,
    name: "RAG Intake"
  });

  await assert.rejects(
    () =>
      service.getWorkflow({
        actor: { id: "owner_1" },
        project_id: second.project.id,
        workflow_id: workflow.id
      }),
    /not available/
  );
});

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
