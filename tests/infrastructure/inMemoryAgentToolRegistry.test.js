import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryAgentToolRegistry
} from "../../src/infrastructure/inMemoryAgentToolRegistry.js";

test("in-memory agent tool registry invokes registered tools", async () => {
  const registry = createInMemoryAgentToolRegistry([
    {
      name: "knowledge_search",
      description: "Search knowledge",
      handler: async ({ input, context }) => ({
        query: input.query,
        project_id: context.project_id,
        results: []
      })
    }
  ]);

  const tools = await registry.listTools();
  const output = await registry.invokeTool({
    tool_name: "knowledge_search",
    input: { query: "reset password" },
    context: { project_id: "project_1" }
  });

  assert.equal(tools[0].name, "knowledge_search");
  assert.deepEqual(output, {
    query: "reset password",
    project_id: "project_1",
    results: []
  });
});

test("in-memory agent tool registry rejects missing and malformed tools", async () => {
  assert.throws(
    () => createInMemoryAgentToolRegistry([{ name: "bad" }]),
    /handler/
  );

  const registry = createInMemoryAgentToolRegistry([]);

  await assert.rejects(
    () =>
      registry.invokeTool({
        tool_name: "missing",
        input: {},
        context: {}
      }),
    /not registered/
  );
});
