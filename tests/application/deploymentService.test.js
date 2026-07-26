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

const timestamp = "2026-07-26T00:00:00.000Z";

test("deployment service manages project scoped environments and variables", async () => {
  const { project, service } = await createDeploymentFixture();
  const environment = await service.upsertEnvironment({
    actor: { id: "owner_1" },
    project_id: project.id,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    variables: {
      API_BASE_URL: "https://api.example.com",
      API_TOKEN: {
        is_secret: true,
        secret_ref: "credential_api"
      }
    }
  });
  const environments = await service.listEnvironments({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(environment.environment, DEPLOYMENT_ENVIRONMENTS.PRODUCTION);
  assert.equal(environment.variables.API_TOKEN.value, null);
  assert.equal(environments.length, 1);
  await assert.rejects(
    () =>
      service.upsertEnvironment({
        actor: { id: "viewer_1" },
        project_id: project.id,
        environment: DEPLOYMENT_ENVIRONMENTS.STAGING
      }),
    /required project permission/
  );
});

test("deployment service publishes workflow versions and records active deployments", async () => {
  const { project, workflow, securityRepositories, service } = await createDeploymentFixture();

  await service.upsertEnvironment({
    actor: { id: "owner_1" },
    project_id: project.id,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    variables: {
      API_BASE_URL: "https://api.example.com"
    }
  });

  const deployment = await service.publishWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
  });
  const active = await service.getActiveDeployment({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
  });
  const updatedWorkflow = await securityRepositories.workflows.findById(workflow.id);

  assert.equal(deployment.status, DEPLOYMENT_STATUSES.ACTIVE);
  assert.equal(deployment.workflow_version, 1);
  assert.equal(deployment.webhook_url, "https://nexus.test/webhooks/project_1/production/workflow_1");
  assert.equal(deployment.variable_snapshot.API_BASE_URL.value, "https://api.example.com");
  assert.equal(active.id, deployment.id);
  assert.equal(updatedWorkflow.published_version, 1);
  assert.equal(updatedWorkflow.is_active, true);
});

test("deployment service disables previous active deployments on republish", async () => {
  const { project, workflow, service } = await createDeploymentFixture();

  await service.upsertEnvironment({
    actor: { id: "owner_1" },
    project_id: project.id,
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING
  });

  const first = await service.publishWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING
  });
  const second = await service.publishWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING
  });
  const deployments = await service.listDeployments({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.deepEqual(
    deployments.map((deployment) => [deployment.id, deployment.status]),
    [
      [first.id, DEPLOYMENT_STATUSES.DISABLED],
      [second.id, DEPLOYMENT_STATUSES.ACTIVE]
    ]
  );
});

test("deployment service enforces project boundaries and configured environments", async () => {
  const { project, workflow, service } = await createDeploymentFixture();

  await assert.rejects(
    () =>
      service.publishWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        workflow_id: workflow.id,
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
      }),
    /must be configured/
  );
  await service.upsertEnvironment({
    actor: { id: "owner_1" },
    project_id: project.id,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
  });
  await assert.rejects(
    () =>
      service.publishWorkflow({
        actor: { id: "viewer_1" },
        project_id: project.id,
        workflow_id: workflow.id,
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
      }),
    /required project permission/
  );
  await assert.rejects(
    () =>
      service.publishWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        workflow_id: "workflow_missing",
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
      }),
    /Workflow is not available/
  );
});

test("deployment service disables deployments through manage permission", async () => {
  const { project, workflow, service } = await createDeploymentFixture();

  await service.upsertEnvironment({
    actor: { id: "owner_1" },
    project_id: project.id,
    environment: DEPLOYMENT_ENVIRONMENTS.DEVELOPMENT
  });

  const deployment = await service.publishWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.DEVELOPMENT
  });
  const disabled = await service.disableDeployment({
    actor: { id: "owner_1" },
    project_id: project.id,
    deployment_id: deployment.id
  });
  const active = await service.getActiveDeployment({
    actor: { id: "viewer_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    environment: DEPLOYMENT_ENVIRONMENTS.DEVELOPMENT
  });

  assert.equal(disabled.status, DEPLOYMENT_STATUSES.DISABLED);
  assert.equal(disabled.disabled_at, timestamp);
  assert.equal(active, null);
  await assert.rejects(
    () =>
      service.disableDeployment({
        actor: { id: "viewer_1" },
        project_id: project.id,
        deployment_id: deployment.id
      }),
    /required project permission/
  );
});

async function createDeploymentFixture() {
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

  return {
    project,
    workflow,
    securityRepositories,
    service: createDeploymentService({
      projectRepository: securityRepositories.projects,
      membershipRepository: securityRepositories.memberships,
      workflowRepository: securityRepositories.workflows,
      environmentRepository: deploymentRepositories.environments,
      deploymentRepository: deploymentRepositories.deployments,
      idGenerator,
      webhookBaseUrl: "https://nexus.test",
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
