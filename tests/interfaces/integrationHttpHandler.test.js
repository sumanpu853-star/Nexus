import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationService } from "../../src/application/integrationService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createCredentialRecord } from "../../src/domain/credentialPolicy.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  createDeterministicIntegrationGateway
} from "../../src/infrastructure/deterministicIntegrationGateway.js";
import {
  createInMemoryIntegrationRepositories
} from "../../src/infrastructure/inMemoryIntegrationRepositories.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import { createIntegrationHttpHandler } from "../../src/interfaces/integrationHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("integration http handler lists, connects, invokes, and registers triggers", async () => {
  const { project, workflow, handler } = await createIntegrationHandlerFixture();
  const definitions = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/integrations",
    query: { project_id: project.id }
  });
  const created = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/integration-connections",
    body: {
      project_id: project.id,
      integration_type: "slack",
      name: "Ops Slack",
      credential_id: "credential_slack"
    }
  });
  const connectionId = created.body.connection.id;
  const invoked = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/integration-connections/${connectionId}/invoke`,
    body: {
      project_id: project.id,
      action: "send_message",
      input: {
        channel: "#ops",
        message: "Deployment complete"
      }
    }
  });
  const invocations = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: `/integration-connections/${connectionId}/invocations`,
    query: { project_id: project.id }
  });
  const webhook = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/webhooks",
    body: {
      project_id: project.id,
      workflow_id: workflow.id,
      path: "/hooks/intake"
    }
  });
  const schedule = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/schedules",
    body: {
      project_id: project.id,
      workflow_id: workflow.id,
      cron: "*/5 * * * *"
    }
  });

  assert.equal(definitions.status, 200);
  assert.equal(definitions.body.integrations.some((definition) => definition.type === "github"), true);
  assert.equal(created.status, 201);
  assert.equal(invoked.body.invocation.output.delivered, true);
  assert.equal(invocations.body.invocations.length, 1);
  assert.equal(webhook.body.webhook.path, "/hooks/intake");
  assert.equal(schedule.body.schedule.timezone, "UTC");
});

test("integration http handler maps validation and auth failures", async () => {
  const { project, handler } = await createIntegrationHandlerFixture();
  const missingName = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/integration-connections",
    body: {
      project_id: project.id,
      integration_type: "http"
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "POST",
    path: "/integration-connections",
    body: {
      project_id: project.id,
      integration_type: "http",
      name: "Viewer HTTP"
    }
  });

  assert.equal(missingName.status, 400);
  assert.equal(forbidden.status, 403);
});

async function createIntegrationHandlerFixture() {
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

  const service = createIntegrationService({
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
  });

  return {
    project,
    workflow,
    handler: createIntegrationHttpHandler({ integrationService: service })
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
