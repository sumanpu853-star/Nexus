import assert from "node:assert/strict";
import test from "node:test";
import {
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES
} from "../../src/domain/deploymentPolicy.js";
import {
  createInMemoryDeploymentRepositories
} from "../../src/infrastructure/inMemoryDeploymentRepositories.js";

test("in-memory deployment repositories save and clone environments and deployments", async () => {
  const repositories = createInMemoryDeploymentRepositories();
  const environment = {
    id: "deployment_environment_1",
    project_id: "project_1",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    variables: {
      API_BASE_URL: {
        value: "https://api.example.com",
        is_secret: false,
        secret_ref: null
      }
    }
  };

  const savedEnvironment = await repositories.environments.save(environment);
  savedEnvironment.variables.API_BASE_URL.value = "changed";
  await repositories.deployments.save({
    id: "deployment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    status: DEPLOYMENT_STATUSES.ACTIVE
  });

  assert.equal(
    (
      await repositories.environments.findByProjectEnvironment({
        project_id: "project_1",
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
      })
    ).variables.API_BASE_URL.value,
    "https://api.example.com"
  );
  assert.equal((await repositories.deployments.findByProjectId("project_1"))[0].id, "deployment_1");
});

test("in-memory deployment repositories update indexes and active deployment lookups", async () => {
  const repositories = createInMemoryDeploymentRepositories();

  await repositories.environments.save({
    id: "deployment_environment_1",
    project_id: "project_1",
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING,
    variables: {}
  });
  await repositories.environments.save({
    id: "deployment_environment_1",
    project_id: "project_2",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    variables: {}
  });
  await repositories.deployments.save({
    id: "deployment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    status: DEPLOYMENT_STATUSES.ACTIVE
  });
  await repositories.deployments.save({
    id: "deployment_2",
    project_id: "project_1",
    workflow_id: "workflow_1",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    status: DEPLOYMENT_STATUSES.ACTIVE
  });

  assert.deepEqual(await repositories.environments.findByProjectId("project_1"), []);
  assert.equal((await repositories.environments.findByProjectId("project_2"))[0].environment, "production");
  assert.equal(
    (
      await repositories.deployments.findActiveByWorkflowEnvironment({
        project_id: "project_1",
        workflow_id: "workflow_1",
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION
      })
    ).id,
    "deployment_2"
  );
});
