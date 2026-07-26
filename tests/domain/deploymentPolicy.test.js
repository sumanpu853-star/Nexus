import assert from "node:assert/strict";
import test from "node:test";
import {
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES,
  assertDeploymentBelongsToProject,
  createDeploymentEnvironmentRecord,
  createDeploymentRecord,
  createDeploymentWebhookUrl
} from "../../src/domain/deploymentPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("deployment policy normalizes environment variables without storing secret values", () => {
  const environment = createDeploymentEnvironmentRecord({
    id: "deployment_environment_1",
    project_id: "project_1",
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    variables: {
      API_BASE_URL: "https://api.example.com",
      SLACK_TOKEN: {
        is_secret: true,
        secret_ref: "credential_slack"
      }
    },
    created_at: timestamp
  });

  assert.deepEqual(environment.variables, {
    API_BASE_URL: {
      value: "https://api.example.com",
      is_secret: false,
      secret_ref: null
    },
    SLACK_TOKEN: {
      value: null,
      is_secret: true,
      secret_ref: "credential_slack"
    }
  });
  assert.equal(Object.isFrozen(environment.variables.SLACK_TOKEN), true);
});

test("deployment policy creates stable deployment records and webhook URLs", () => {
  const webhookUrl = createDeploymentWebhookUrl({
    base_url: "https://nexus.example.com/",
    project_id: "project_1",
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING,
    workflow_id: "workflow_1"
  });
  const deployment = createDeploymentRecord({
    id: "deployment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    workflow_version: 3,
    environment: DEPLOYMENT_ENVIRONMENTS.STAGING,
    webhook_url: webhookUrl,
    variable_snapshot: {
      API_BASE_URL: "https://staging.example.com"
    },
    created_by: "owner_1",
    created_at: timestamp
  });

  assert.equal(webhookUrl, "https://nexus.example.com/webhooks/project_1/staging/workflow_1");
  assert.equal(deployment.status, DEPLOYMENT_STATUSES.ACTIVE);
  assert.equal(deployment.published_at, timestamp);
  assert.equal(deployment.disabled_at, null);
});

test("deployment policy validates environments, variable names, and secret refs", () => {
  assert.throws(
    () =>
      createDeploymentEnvironmentRecord({
        id: "deployment_environment_1",
        project_id: "project_1",
        environment: "qa",
        created_at: timestamp
      }),
    /not supported/
  );
  assert.throws(
    () =>
      createDeploymentEnvironmentRecord({
        id: "deployment_environment_1",
        project_id: "project_1",
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
        variables: {
          apiBaseUrl: "https://api.example.com"
        },
        created_at: timestamp
      }),
    /uppercase/
  );
  assert.throws(
    () =>
      createDeploymentEnvironmentRecord({
        id: "deployment_environment_1",
        project_id: "project_1",
        environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
        variables: {
          API_TOKEN: {
            is_secret: true,
            value: "raw-secret"
          }
        },
        created_at: timestamp
      }),
    /secret_ref/
  );
});

test("deployment policy blocks cross-project deployment access", () => {
  const deployment = createDeploymentRecord({
    id: "deployment_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    workflow_version: 1,
    environment: DEPLOYMENT_ENVIRONMENTS.PRODUCTION,
    webhook_url: "https://nexus.example.com/webhooks/project_1/production/workflow_1",
    created_by: "owner_1",
    created_at: timestamp
  });

  assert.equal(
    assertDeploymentBelongsToProject({
      deployment,
      project_id: "project_1"
    }),
    deployment
  );
  assert.throws(
    () =>
      assertDeploymentBelongsToProject({
        deployment,
        project_id: "project_2"
      }),
    /not available/
  );
});
