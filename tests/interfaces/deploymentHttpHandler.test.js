import assert from "node:assert/strict";
import test from "node:test";
import { createDeploymentService } from "../../src/application/deploymentService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import {
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES
} from "../../src/domain/deploymentPolicy.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  createInMemoryDeploymentRepositories
} from "../../src/infrastructure/inMemoryDeploymentRepositories.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import { createDeploymentHttpHandler } from "../../src/interfaces/deploymentHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("deployment http handler configures environments, publishes, lists, and disables", async () => {
  const { project, workflow, handler } = await createDeploymentHandlerFixture();
  const environment = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: "/deployment-environments/production",
    body: {
      project_id: project.id,
      variables: {
        API_BASE_URL: "https://api.example.com"
      }
    }
  });
  const environments = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/deployment-environments",
    query: { project_id: project.id }
  });
  const published = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/deployments",
    body: {
      project_id: project.id,
      workflow_id: workflow.id,
      environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
    }
  });
  const active = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/deployments/active",
    query: {
      project_id: project.id,
      workflow_id: workflow.id,
      environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
    }
  });
  const deployments = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/deployments",
    query: { project_id: project.id }
  });
  const disabled = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/deployments/${published.body.deployment.id}/disable`,
    body: { project_id: project.id }
  });

  assert.equal(environment.status, 200);
  assert.equal(environments.body.environments.length, 1);
  assert.equal(published.status, 201);
  assert.equal(active.body.deployment.id, published.body.deployment.id);
  assert.equal(deployments.body.deployments.length, 1);
  assert.equal(disabled.body.deployment.status, DEPLOYMENT_STATUSES.DISABLED);
});

test("deployment http handler maps validation and auth failures", async () => {
  const { project, handler } = await createDeploymentHandlerFixture();
  const invalidEnvironment = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: "/deployment-environments/qa",
    body: {
      project_id: project.id
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "PUT",
    path: "/deployment-environments/staging",
    body: {
      project_id: project.id
    }
  });

  assert.equal(invalidEnvironment.status, 400);
  assert.equal(forbidden.status, 403);
});

async function createDeploymentHandlerFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const deploymentRepositories = createInMemoryDeploymentRepositories();
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
  const workflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Production Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });

  await workflowService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  const service = createDeploymentService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
    workflowRepository: securityRepositories.workflows,
    environmentRepository: deploymentRepositories.environments,
    deploymentRepository: deploymentRepositories.deployments,
    idGenerator,
    webhookBaseUrl: "https://nexus.test",
    clock: () => new Date(timestamp)
  });

  return {
    project,
    workflow,
    handler: createDeploymentHttpHandler({ deploymentService: service })
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
