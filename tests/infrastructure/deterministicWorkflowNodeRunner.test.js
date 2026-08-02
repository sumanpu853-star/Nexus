import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeterministicWorkflowNodeRunner
} from "../../src/infrastructure/deterministicWorkflowNodeRunner.js";

test("deterministic workflow node runner returns stable default outputs", async () => {
  const runner = createDeterministicWorkflowNodeRunner();
  const http = await runner.runNode({
    node: {
      id: "http",
      type: "http_request",
      parameters: {
        method: "POST",
        url: "https://example.com/api",
        body: { ok: true }
      }
    },
    input: { prompt: "hello" },
    context: {}
  });
  const slack = await runner.runNode({
    node: {
      id: "notify",
      type: "slack",
      parameters: {
        channel: "#ops",
        message: "Done"
      }
    },
    input: {},
    context: {}
  });
  const slackAgain = await runner.runNode({
    node: {
      id: "notify",
      type: "slack",
      parameters: {
        channel: "#ops",
        message: "Done"
      }
    },
    input: {},
    context: {}
  });

  assert.deepEqual(http.output, {
    status_code: 200,
    method: "POST",
    url: "https://example.com/api",
    body: { ok: true }
  });
  assert.equal(slack.output.message_id, slackAgain.output.message_id);
  assert.equal(http.logs[0].message, "Executed node http");
  assert.equal(http.trace.attributes.node_type, "http_request");
});

test("deterministic workflow node runner supports custom handlers", async () => {
  const runner = createDeterministicWorkflowNodeRunner({
    handlers: {
      http: () => ({
        output: { status_code: 202 },
        usage: { input_tokens: 1, output_tokens: 2 },
        cost: { amount: 0.001 },
        logs: [{ message: "Accepted", metadata: { route: "custom" } }],
        secretValues: ["secret-token"]
      })
    }
  });

  const result = await runner.runNode({
    node: {
      id: "http",
      type: "http_request",
      parameters: {
        url: "https://example.com/api"
      }
    },
    input: {},
    context: {}
  });

  assert.deepEqual(result.output, { status_code: 202 });
  assert.deepEqual(result.usage, { input_tokens: 1, output_tokens: 2 });
  assert.equal(result.logs[0].level, "info");
  assert.deepEqual(result.secretValues, ["secret-token"]);
});
