import assert from "node:assert/strict";
import test from "node:test";
import {
  INTEGRATION_CONNECTION_STATUSES,
  INTEGRATION_INVOCATION_STATUSES,
  assertCredentialRequirementSatisfied,
  assertIntegrationActionAllowed,
  createIntegrationConnectionRecord,
  createIntegrationInvocationRecord,
  createScheduleTriggerRecord,
  createWebhookEndpointRecord,
  findIntegrationDefinition,
  getBuiltInIntegrationDefinitions
} from "../../src/domain/integrationPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("integration policy exposes priority built-in integration definitions", () => {
  const definitions = getBuiltInIntegrationDefinitions();
  const types = definitions.map((definition) => definition.type);
  const github = findIntegrationDefinition({
    type: "github",
    definitions
  });

  assert.deepEqual(
    [
      "http",
      "slack",
      "teams",
      "gmail",
      "outlook_email",
      "google_drive",
      "github",
      "database",
      "webhook",
      "schedule"
    ].every((type) => types.includes(type)),
    true
  );
  assert.deepEqual(github.actions, [
    "create_issue",
    "comment_on_issue",
    "dispatch_workflow"
  ]);
  assert.equal(Object.isFrozen(definitions[0].actions), true);
});

test("integration policy normalizes connection, invocation, webhook, and schedule records", () => {
  const connection = createIntegrationConnectionRecord({
    id: "connection_1",
    project_id: "project_1",
    owner_id: "owner_1",
    integration_type: "slack",
    name: "Ops Slack",
    credential_id: "credential_1",
    settings: { channel_prefix: "#ops" },
    created_at: timestamp
  });
  const invocation = createIntegrationInvocationRecord({
    id: "invocation_1",
    project_id: "project_1",
    connection_id: connection.id,
    integration_type: "slack",
    action: "send_message",
    input: { channel: "#ops" },
    output: { delivered: true },
    started_at: timestamp,
    finished_at: timestamp
  });
  const webhook = createWebhookEndpointRecord({
    id: "webhook_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    path: "/hooks/intake",
    secret_ref: "credential_2",
    created_at: timestamp
  });
  const schedule = createScheduleTriggerRecord({
    id: "schedule_1",
    project_id: "project_1",
    workflow_id: "workflow_1",
    cron: "*/5 * * * *",
    created_at: timestamp
  });

  assert.equal(connection.status, INTEGRATION_CONNECTION_STATUSES.ACTIVE);
  assert.equal(invocation.status, INTEGRATION_INVOCATION_STATUSES.SUCCESS);
  assert.equal(webhook.path, "/hooks/intake");
  assert.equal(schedule.timezone, "UTC");
  assert.equal(Object.isFrozen(invocation.output), true);
});

test("integration policy rejects unsupported actions and missing required credentials", () => {
  const definitions = getBuiltInIntegrationDefinitions();
  const slack = findIntegrationDefinition({
    type: "slack",
    definitions
  });

  assert.throws(
    () =>
      assertCredentialRequirementSatisfied({
        definition: slack,
        credential_id: null
      }),
    /requires a credential/
  );
  assert.throws(
    () =>
      assertIntegrationActionAllowed({
        definition: slack,
        action: "archive_channel"
      }),
    /not supported/
  );
  assert.equal(
    assertIntegrationActionAllowed({
      definition: slack,
      action: "send_message"
    }),
    "send_message"
  );
});

test("integration policy validates webhook paths and schedule cron syntax", () => {
  assert.throws(
    () =>
      createWebhookEndpointRecord({
        id: "webhook_1",
        project_id: "project_1",
        workflow_id: "workflow_1",
        path: "hooks/intake",
        created_at: timestamp
      }),
    /must start with/
  );
  assert.throws(
    () =>
      createScheduleTriggerRecord({
        id: "schedule_1",
        project_id: "project_1",
        workflow_id: "workflow_1",
        cron: "every five minutes",
        created_at: timestamp
      }),
    /five fields/
  );
});
