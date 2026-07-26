import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeterministicAgentModelProvider
} from "../../src/infrastructure/deterministicAgentModelProvider.js";

test("deterministic agent model provider returns stable messages and tool requests", async () => {
  const provider = createDeterministicAgentModelProvider();
  const response = await provider.generateResponse({
    instructions: "Answer with context.",
    input: {
      prompt: "How do I reset a password?",
      tool_requests: [
        {
          tool_name: "knowledge_search",
          input: { query: "reset password" }
        }
      ]
    },
    model: {
      model: "nexus-agent-deterministic-v1"
    },
    memory: [{ role: "user", content: "Earlier question" }],
    tools: [{ name: "knowledge_search" }]
  });

  assert.equal(response.message.includes("reset a password"), true);
  assert.equal(response.requested_tool_calls[0].tool_name, "knowledge_search");
  assert.equal(response.usage.total_tokens, response.usage.input_tokens + response.usage.output_tokens);
});

test("deterministic agent model provider validates tool requests", async () => {
  const provider = createDeterministicAgentModelProvider();

  await assert.rejects(
    () =>
      provider.generateResponse({
        instructions: "Answer.",
        input: {
          tool_requests: [{ input: {} }]
        }
      }),
    /Tool request name/
  );
});
