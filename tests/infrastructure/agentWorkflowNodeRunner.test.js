import assert from "node:assert/strict";
import test from "node:test";
import { createAgentService } from "../../src/application/agentService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import {
  AGENT_MEMORY_SCOPES,
  AGENT_TOOL_TYPES
} from "../../src/domain/agentPolicy.js";
import {
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  createAgentWorkflowNodeRunner
} from "../../src/infrastructure/agentWorkflowNodeRunner.js";
import {
  createDeterministicAgentModelProvider
} from "../../src/infrastructure/deterministicAgentModelProvider.js";
import {
  createDeterministicWorkflowNodeRunner
} from "../../src/infrastructure/deterministicWorkflowNodeRunner.js";
import {
  createInMemoryAgentRepositories
} from "../../src/infrastructure/inMemoryAgentRepositories.js";
import {
  createInMemoryAgentToolRegistry
} from "../../src/infrastructure/inMemoryAgentToolRegistry.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("agent workflow node runner invokes persisted agents with visible tool calls", async () => {
  const { project, agent, runner } = await createAgentNodeFixture();

  const result = await runner.runNode({
    workflow: {
      id: "workflow_1",
      project_id: project.id
    },
    execution: {
      id: "execution_1",
      project_id: project.id,
      started_by: "owner_1"
    },
    node: {
      id: "agent_node",
      type: "agent",
      parameters: {
        agent_id: agent.id,
        tool_call_visibility: true
      }
    },
    input: {
      prompt: "Find password reset instructions",
      tool_requests: [
        {
          tool_name: "knowledge_search",
          input: { query: "reset password" }
        }
      ]
    },
    context: {}
  });

  assert.equal(result.status, WORKFLOW_NODE_RUN_STATUSES.SUCCESS);
  assert.equal(result.output.agent_id, agent.id);
  assert.equal(result.output.tool_call_count, 1);
  assert.equal(result.output.tool_calls[0].tool_name, "knowledge_search");
  assert.deepEqual(result.output.tool_results[0].output.results, ["reset-password-doc"]);
  assert.equal(result.usage.total_tokens > 0, true);
  assert.equal(result.cost.amount > 0, true);
  assert.equal(result.trace.kind, WORKFLOW_TRACE_SPAN_KINDS.MODEL);
  assert.equal(result.logs.some((log) => log.message.includes("knowledge_search")), true);
});

test("agent workflow node runner can hide tool call payloads and fallback for ordinary nodes", async () => {
  const { project, agent, runner } = await createAgentNodeFixture();

  const hidden = await runner.runNode({
    workflow: {
      id: "workflow_1",
      project_id: project.id
    },
    execution: {
      id: "execution_1",
      project_id: project.id,
      started_by: "owner_1"
    },
    node: {
      id: "agent_node",
      type: "agent",
      parameters: {
        agent_id: agent.id,
        tool_call_visibility: false
      }
    },
    input: {
      prompt: "Find password reset instructions",
      tool_requests: [
        {
          tool_name: "knowledge_search",
          input: { query: "reset password" }
        }
      ]
    },
    context: {}
  });
  const ordinary = await runner.runNode({
    node: {
      id: "http",
      type: "http_request",
      parameters: {
        method: "POST",
        url: "https://example.com/api",
        body: { ok: true }
      }
    },
    input: {},
    context: {}
  });

  assert.equal(hidden.output.tool_calls_visible, false);
  assert.deepEqual(hidden.output.tool_calls, []);
  assert.deepEqual(hidden.output.tool_results, []);
  assert.equal(ordinary.output.status_code, 200);
});

async function createAgentNodeFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const agentRepositories = createInMemoryAgentRepositories();
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
  const service = createAgentService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
    agentRepository: agentRepositories.agents,
    promptVersionRepository: agentRepositories.promptVersions,
    agentRunRepository: agentRepositories.agentRuns,
    agentMemoryRepository: agentRepositories.agentMemories,
    modelProvider: createDeterministicAgentModelProvider(),
    toolRegistry: createInMemoryAgentToolRegistry([
      {
        name: "knowledge_search",
        handler: async ({ input }) => ({
          query: input.query,
          results: ["reset-password-doc"]
        })
      }
    ]),
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const { agent } = await service.createAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support Agent",
    instructions: "Search before answering.",
    model: {
      input_token_cost_per_1k: 5,
      output_token_cost_per_1k: 10
    },
    memory: {
      scope: AGENT_MEMORY_SCOPES.SESSION,
      key: "support"
    },
    tools: [
      {
        name: "knowledge_search",
        type: AGENT_TOOL_TYPES.KNOWLEDGE
      }
    ]
  });

  return {
    project,
    agent,
    runner: createAgentWorkflowNodeRunner({
      agentService: service,
      fallbackRunner: createDeterministicWorkflowNodeRunner()
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
