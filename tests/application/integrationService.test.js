import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationService } from "../../src/application/integrationService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createCredentialRecord } from "../../src/domain/credentialPolicy.js";
import {
  INTEGRATION_INVOCATION_STATUSES
} from "../../src/domain/integrationPolicy.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  createDeterministicIntegrationGateway
} from "../../src/infrastructure/deterministicIntegrationGateway.js";
import {
  createInMemoryIntegrationRepositories
} from "../../src/infrastructure/inMemoryIntegrationRepositories.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("integration service lists definitions and manages project scoped connections", async () => {
  const { project, service } = await createIntegrationFixture();
  const definitions = await service.listIntegrationDefinitions({
    actor: { id: "viewer_1" },
    project_id: project.id
  });
  const connection = await service.createConnection({
    actor: { id: "owner_1" },
    project_id: project.id,
    integration_type: "slack",
    name: "Ops Slack",
    credential_id: "credential_slack"
  });
  const connections = await service.listConnections({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(definitions.some((definition) => definition.type === "google_drive"), true);
  assert.equal(connection.integration_type, "slack");
  assert.equal(connections[0].id, connection.id);
  await assert.rejects(
    () =>
      service.createConnection({
        actor: { id: "viewer_1" },
        project_id: project.id,
        integration_type: "http",
        name: "Viewer HTTP"
      }),
    /required project permission/
  );
  await assert.rejects(
    () =>
      service.createConnection({
        actor: { id: "owner_1" },
        project_id: project.id,
        integration_type: "slack",
        name: "Missing Credential"
      }),
    /requires a credential/
  );
});

test("integration service validates credential project boundaries", async () => {
  const { project, service } = await createIntegrationFixture();

  await assert.rejects(
    () =>
      service.createConnection({
        actor: { id: "owner_1" },
        project_id: project.id,
        integration_type: "slack",
        name: "Foreign Slack",
        credential_id: "credential_other"
      }),
    /Credential is not available/
  );
});

test("integration service invokes integrations and stores invocation history", async () => {
  const { project, service } = await createIntegrationFixture();
  const connection = await service.createConnection({
    actor: { id: "owner_1" },
    project_id: project.id,
    integration_type: "slack",
    name: "Ops Slack",
    credential_id: "credential_slack"
  });
  const invocation = await service.invokeIntegration({
    actor: { id: "owner_1" },
    project_id: project.id,
    connection_id: connection.id,
    action: "send_message",
    input: {
      channel: "#ops",
      message: "Deployment complete"
    }
  });
  const invocations = await service.listConnectionInvocations({
    actor: { id: "viewer_1" },
    project_id: project.id,
    connection_id: connection.id
  });

  assert.equal(invocation.status, INTEGRATION_INVOCATION_STATUSES.SUCCESS);
  assert.equal(invocation.output.delivered, true);
  assert.equal(invocations.length, 1);
  await assert.rejects(
    () =>
      service.invokeIntegration({
        actor: { id: "viewer_1" },
        project_id: project.id,
        connection_id: connection.id,
        action: "send_message",
        input: { channel: "#ops", message: "No" }
      }),
    /required project permission/
  );
  await assert.rejects(
    () =>
      service.invokeIntegration({
        actor: { id: "owner_1" },
        project_id: project.id,
        connection_id: connection.id,
        action: "archive_channel",
        input: { channel: "#ops" }
      }),
    /not supported/
  );
});

test("integration service registers webhook endpoints and schedules for project workflows", async () => {
  const { project, workflow, service } = await createIntegrationFixture();
  const webhook = await service.registerWebhook({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    path: "/hooks/intake",
    secret_ref: "credential_slack"
  });
  const schedule = await service.registerSchedule({
    actor: { id: "owner_1" },
    project_id: project.id,
    workflow_id: workflow.id,
    cron: "*/5 * * * *",
    timezone: "Asia/Calcutta"
  });
  const webhooks = await service.listWebhooks({
    actor: { id: "viewer_1" },
    project_id: project.id
  });
  const schedules = await service.listSchedules({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(webhook.path, "/hooks/intake");
  assert.equal(schedule.timezone, "Asia/Calcutta");
  assert.equal(webhooks.length, 1);
  assert.equal(schedules.length, 1);
  await assert.rejects(
    () =>
      service.registerWebhook({
        actor: { id: "viewer_1" },
        project_id: project.id,
        workflow_id: workflow.id,
        path: "/hooks/viewer"
      }),
    /required project permission/
  );
  await assert.rejects(
    () =>
      service.registerSchedule({
        actor: { id: "owner_1" },
        project_id: project.id,
        workflow_id: "workflow_missing",
        cron: "*/5 * * * *"
      }),
    /Workflow is not available/
  );
});

async function createIntegrationFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const integrationRepositories = createInMemoryIntegrationRepositories();
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
  const { project: otherProject } = await workflowService.createProjectForUser({
    actor: { id: "other_owner" },
    name: "Other Project"
  });
  const workflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Webhook Intake",
    nodes: [{ id: "manual", type: "manual" }]
  });

  await workflowService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });
  await securityRepositories.credentials.save(
    createCredentialRecord({
      id: "credential_slack",
      name: "Slack Bot",
      type: "slack_bot_token",
      owner_id: "owner_1",
      project_id: project.id,
      encrypted_secret: "ciphertext",
      created_at: timestamp
    })
  );
  await securityRepositories.credentials.save(
    createCredentialRecord({
      id: "credential_other",
      name: "Other Slack",
      type: "slack_bot_token",
      owner_id: "other_owner",
      project_id: otherProject.id,
      encrypted_secret: "ciphertext",
      created_at: timestamp
    })
  );

  return {
    project,
    workflow,
    service: createIntegrationService({
      projectRepository: securityRepositories.projects,
      membershipRepository: securityRepositories.memberships,
      workflowRepository: securityRepositories.workflows,
      credentialRepository: securityRepositories.credentials,
      connectionRepository: integrationRepositories.connections,
      invocationRepository: integrationRepositories.invocations,
      webhookRepository: integrationRepositories.webhooks,
      scheduleRepository: integrationRepositories.schedules,
      integrationGateway: createDeterministicIntegrationGateway(),
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
