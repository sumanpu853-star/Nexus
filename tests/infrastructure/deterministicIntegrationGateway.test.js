import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeterministicIntegrationGateway
} from "../../src/infrastructure/deterministicIntegrationGateway.js";

test("deterministic integration gateway returns stable default outputs", async () => {
  const gateway = createDeterministicIntegrationGateway();
  const http = await gateway.invoke({
    definition: { type: "http" },
    connection: {
      id: "connection_1",
      integration_type: "http",
      settings: { base_url: "https://api.example.com" }
    },
    action: "request",
    input: { method: "POST", body: { ok: true } },
    context: { project_id: "project_1" }
  });
  const slack = await gateway.invoke({
    definition: { type: "slack" },
    connection: { id: "connection_2", integration_type: "slack" },
    action: "send_message",
    input: { channel: "#ops", message: "Deployment complete" },
    context: { project_id: "project_1" }
  });

  assert.deepEqual(http, {
    status_code: 200,
    method: "POST",
    url: "https://api.example.com",
    body: { ok: true }
  });
  assert.equal(slack.delivered, true);
  assert.equal(slack.message_id, "message_ce955c84");
});

test("deterministic integration gateway supports custom handlers", async () => {
  const gateway = createDeterministicIntegrationGateway({
    handlers: {
      "github:create_issue": async ({ input }) => ({
        issue_number: 42,
        title: input.title
      })
    }
  });
  const output = await gateway.invoke({
    definition: { type: "github" },
    connection: { id: "connection_1", integration_type: "github" },
    action: "create_issue",
    input: { title: "Broken build" },
    context: { project_id: "project_1" }
  });

  assert.deepEqual(output, {
    issue_number: 42,
    title: "Broken build"
  });
  await assert.rejects(
    () =>
      gateway.invoke({
        definition: { type: "github" },
        connection: { id: "connection_1", integration_type: "github" },
        action: "create_issue",
        input: [],
        context: { project_id: "project_1" }
      }),
    /Integration input must be an object/
  );
});
