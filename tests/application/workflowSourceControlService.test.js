import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import {
  createWorkflowSourceControlService
} from "../../src/application/workflowSourceControlService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import {
  createInMemoryWorkflowSourceControlGateway
} from "../../src/infrastructure/inMemoryWorkflowSourceControlGateway.js";
import {
  createInMemoryWorkflowSourceControlRepositories
} from "../../src/infrastructure/inMemoryWorkflowSourceControlRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("workflow source control service exports authorized workflow versions", async () => {
  const { project, workflow, gateway, service } = await createSourceControlFixture();

  const exportRecord = await service.exportWorkflowVersion({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    destination: {
      type: "git",
      repository: "git@example.com:nexus/workflows.git",
      branch: "main"
    }
  });
  const exports = await service.listWorkflowExports({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id
  });
  const gatewayExports = await gateway.listExports();

  assert.equal(exportRecord.workflow_version, 1);
  assert.equal(exportRecord.commit_ref.startsWith("git:"), true);
  assert.equal(exports.length, 1);
  assert.equal(gatewayExports[0].files.length, 2);
  assert.equal(
    JSON.parse(gatewayExports[0].files[0].content).name,
    "Exported Workflow"
  );
});

test("workflow source control service blocks cross-project exports", async () => {
  const { project, workflow, service, workflowService } = await createSourceControlFixture();
  const second = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Second Project"
  });

  await assert.rejects(
    () =>
      service.exportWorkflowVersion({
        actor: { id: "owner_1" },
        project_id: second.project.id,
        workflow_id: workflow.id
      }),
    /not available/
  );
  assert.notEqual(project.id, second.project.id);
});

async function createSourceControlFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const exportRepositories = createInMemoryWorkflowSourceControlRepositories();
  const gateway = createInMemoryWorkflowSourceControlGateway();
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
    name: "Exported Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });

  return {
    project,
    workflow,
    workflowService,
    gateway,
    service: createWorkflowSourceControlService({
      projectRepository: securityRepositories.projects,
      membershipRepository: securityRepositories.memberships,
      workflowRepository: securityRepositories.workflows,
      exportRepository: exportRepositories.exports,
      sourceControlGateway: gateway,
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
