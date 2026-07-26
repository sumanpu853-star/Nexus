import assert from "node:assert/strict";
import test from "node:test";
import { createAgentService } from "../../src/application/agentService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import {
  AGENT_MEMORY_SCOPES,
  AGENT_RUN_STATUSES,
  AGENT_TOOL_CALL_STATUSES,
  AGENT_TOOL_TYPES
} from "../../src/domain/agentPolicy.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  createDeterministicAgentModelProvider
} from "../../src/infrastructure/deterministicAgentModelProvider.js";
import {
  createInMemoryAgentRepositories
} from "../../src/infrastructure/inMemoryAgentRepositories.js";
import {
  createInMemoryAgentToolRegistry
} from "../../src/infrastructure/inMemoryAgentToolRegistry.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("agent service creates, lists, and versions project scoped agents", async () => {
  const { project, service } = await createAgentFixture();

  const created = await service.createAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support Agent",
    instructions: "Answer support questions."
  });
  const updated = await service.updateAgentPrompt({
    actor: { id: "owner_1" },
    project_id: project.id,
    agent_id: created.agent.id,
    instructions: "Answer support questions with citations."
  });
  const agents = await service.listAgents({
    actor: { id: "viewer_1" },
    project_id: project.id
  });
  const promptVersions = await service.listAgentPromptVersions({
    actor: { id: "viewer_1" },
    project_id: project.id,
    agent_id: created.agent.id
  });

  assert.equal(created.prompt_version.version, 1);
  assert.equal(updated.agent.prompt_version, 2);
  assert.equal(agents[0].id, created.agent.id);
  assert.deepEqual(
    promptVersions.map((version) => version.version),
    [1, 2]
  );
  await assert.rejects(
    () =>
      service.createAgent({
        actor: { id: "viewer_1" },
        project_id: project.id,
        name: "Bad Agent",
        instructions: "No"
      }),
    /required project permission/
  );
});

test("agent service runs allowed tools and stores visible tool calls", async () => {
  const { project, service } = await createAgentFixture();
  const created = await service.createAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support Agent",
    instructions: "Use the knowledge search tool before answering.",
    tools: [
      {
        name: "knowledge_search",
        type: AGENT_TOOL_TYPES.KNOWLEDGE
      }
    ],
    memory: {
      scope: AGENT_MEMORY_SCOPES.SESSION,
      key: "support"
    }
  });
  const run = await service.runAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    agent_id: created.agent.id,
    session_id: "session_1",
    input: {
      prompt: "How do I reset a password?",
      tool_requests: [
        {
          tool_name: "knowledge_search",
          input: { query: "reset password" }
        }
      ]
    }
  });
  const secondRun = await service.runAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    agent_id: created.agent.id,
    session_id: "session_1",
    input: {
      prompt: "What did I ask before?"
    }
  });
  const runs = await service.listAgentRuns({
    actor: { id: "viewer_1" },
    project_id: project.id,
    agent_id: created.agent.id
  });

  assert.equal(run.status, AGENT_RUN_STATUSES.COMPLETED);
  assert.equal(run.tool_calls[0].status, AGENT_TOOL_CALL_STATUSES.COMPLETED);
  assert.deepEqual(run.tool_calls[0].output.results, ["reset-password-doc"]);
  assert.equal(run.output.tool_results[0].tool_name, "knowledge_search");
  assert.equal(secondRun.output.message.includes("Memory messages: 2"), true);
  assert.equal(runs.length, 2);
});

test("agent service blocks unapproved and disallowed tool calls", async () => {
  const { project, service } = await createAgentFixture();
  const created = await service.createAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Careful Agent",
    instructions: "Use tools only when allowed.",
    tools: [
      {
        name: "send_email",
        type: AGENT_TOOL_TYPES.INTEGRATION,
        requires_approval: true
      }
    ]
  });
  const run = await service.runAgent({
    actor: { id: "owner_1" },
    project_id: project.id,
    agent_id: created.agent.id,
    input: {
      prompt: "Email the customer",
      tool_requests: [
        {
          tool_name: "send_email",
          input: { to: "customer@example.com" }
        }
      ]
    }
  });

  assert.equal(run.status, AGENT_RUN_STATUSES.FAILED);
  assert.equal(run.tool_calls[0].status, AGENT_TOOL_CALL_STATUSES.BLOCKED);
  assert.equal(run.tool_calls[0].error.code, "agent_tool_approval_required");
  await assert.rejects(
    () =>
      service.runAgent({
        actor: { id: "viewer_1" },
        project_id: project.id,
        agent_id: created.agent.id,
        input: { prompt: "Try to run" }
      }),
    /required project permission/
  );
});

async function createAgentFixture() {
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

  await workflowService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  return {
    project,
    service: createAgentService({
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
        },
        {
          name: "send_email",
          handler: async () => ({ sent: true })
        }
      ]),
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
