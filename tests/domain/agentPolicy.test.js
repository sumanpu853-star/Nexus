import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_MEMORY_SCOPES,
  AGENT_RUN_STATUSES,
  AGENT_TOOL_CALL_STATUSES,
  AGENT_TOOL_TYPES,
  AgentPolicyValidationError,
  appendAgentMemoryMessages,
  assertAgentToolAllowed,
  createAgentMemoryMessage,
  createAgentMemoryRecord,
  createAgentPromptVersionRecord,
  createAgentRecord,
  createAgentRunRecord,
  createAgentToolCallRecord
} from "../../src/domain/agentPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("agent policy creates model, memory, and tool permission records", () => {
  const agent = createAgentRecord({
    id: "agent_1",
    project_id: "project_1",
    owner_id: "owner_1",
    name: "Support Agent",
    instructions: "Answer support questions with cited context.",
    model: {
      model: "nexus-agent-deterministic-v1",
      temperature: 0.4
    },
    memory: {
      scope: AGENT_MEMORY_SCOPES.USER,
      key: "support"
    },
    tools: [
      {
        name: "knowledge_search",
        type: AGENT_TOOL_TYPES.KNOWLEDGE,
        description: "Search the support KB"
      }
    ],
    created_at: timestamp
  });

  assert.equal(agent.model.provider, "deterministic");
  assert.equal(agent.memory.scope, AGENT_MEMORY_SCOPES.USER);
  assert.equal(agent.tools[0].enabled, true);
  assert.equal(Object.isFrozen(agent.tools[0]), true);
});

test("agent policy records prompt versions, tool calls, runs, and usage", () => {
  const promptVersion = createAgentPromptVersionRecord({
    id: "agent_prompt_version_1",
    agent_id: "agent_1",
    project_id: "project_1",
    version: 1,
    instructions: "Use tools carefully.",
    created_by: "owner_1",
    created_at: timestamp
  });
  const toolCall = createAgentToolCallRecord({
    id: "agent_tool_call_1",
    run_id: "agent_run_1",
    agent_id: "agent_1",
    project_id: "project_1",
    tool_name: "knowledge_search",
    status: AGENT_TOOL_CALL_STATUSES.COMPLETED,
    output: { results: [] },
    started_at: timestamp,
    finished_at: timestamp
  });
  const run = createAgentRunRecord({
    id: "agent_run_1",
    agent_id: "agent_1",
    project_id: "project_1",
    started_by: "owner_1",
    status: AGENT_RUN_STATUSES.COMPLETED,
    output: { message: "Done", tool_results: [] },
    tool_calls: [toolCall],
    usage: {
      input_tokens: 5,
      output_tokens: 7
    },
    started_at: timestamp,
    finished_at: timestamp
  });

  assert.equal(promptVersion.version, 1);
  assert.equal(run.usage.total_tokens, 12);
  assert.equal(run.tool_calls[0].tool_name, "knowledge_search");
});

test("agent policy enforces tool allowlists and approval gates", () => {
  const agent = createAgentRecord({
    id: "agent_1",
    project_id: "project_1",
    owner_id: "owner_1",
    name: "Support Agent",
    instructions: "Use tools carefully.",
    tools: [
      { name: "knowledge_search", type: AGENT_TOOL_TYPES.KNOWLEDGE },
      { name: "send_email", type: AGENT_TOOL_TYPES.INTEGRATION, enabled: false },
      { name: "delete_record", type: AGENT_TOOL_TYPES.INTEGRATION, requires_approval: true }
    ],
    created_at: timestamp
  });

  assert.equal(
    assertAgentToolAllowed({ agent, tool_name: "knowledge_search" }).name,
    "knowledge_search"
  );
  assert.throws(
    () => assertAgentToolAllowed({ agent, tool_name: "send_email" }),
    (error) => {
      assert.equal(error.code, "agent_tool_not_allowed");
      return true;
    }
  );
  assert.throws(
    () => assertAgentToolAllowed({ agent, tool_name: "delete_record" }),
    (error) => {
      assert.equal(error.code, "agent_tool_approval_required");
      return true;
    }
  );
});

test("agent policy appends memory messages immutably", () => {
  const memory = createAgentMemoryRecord({
    id: "agent_memory_1",
    project_id: "project_1",
    agent_id: "agent_1",
    scope: AGENT_MEMORY_SCOPES.SESSION,
    key: "session:abc:default",
    messages: [
      createAgentMemoryMessage({
        role: "user",
        content: "Hello",
        timestamp
      })
    ],
    created_at: timestamp
  });
  const appended = appendAgentMemoryMessages({
    memory,
    updated_at: timestamp,
    messages: [
      createAgentMemoryMessage({
        role: "assistant",
        content: "Hi",
        timestamp
      })
    ]
  });

  assert.equal(memory.messages.length, 1);
  assert.equal(appended.messages.length, 2);
  assert.equal(Object.isFrozen(appended.messages[1]), true);
});

test("agent policy rejects invalid models, memory, tools, and usage", () => {
  assert.throws(
    () =>
      createAgentRecord({
        id: "agent_1",
        project_id: "project_1",
        owner_id: "owner_1",
        name: "Bad Agent",
        instructions: "Nope",
        model: {
          temperature: 3
        },
        created_at: timestamp
      }),
    AgentPolicyValidationError
  );
  assert.throws(
    () =>
      createAgentRecord({
        id: "agent_1",
        project_id: "project_1",
        owner_id: "owner_1",
        name: "Bad Agent",
        instructions: "Nope",
        tools: [{ name: "search" }, { name: "search" }],
        created_at: timestamp
      }),
    /duplicated/
  );
  assert.throws(
    () =>
      createAgentRunRecord({
        id: "agent_run_1",
        agent_id: "agent_1",
        project_id: "project_1",
        started_by: "owner_1",
        output: {},
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 3
        },
        started_at: timestamp,
        finished_at: timestamp
      }),
    /total_tokens/
  );
});
