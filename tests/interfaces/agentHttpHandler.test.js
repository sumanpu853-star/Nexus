import assert from "node:assert/strict";
import test from "node:test";
import { createAgentService } from "../../src/application/agentService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
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
import { createAgentHttpHandler } from "../../src/interfaces/agentHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("agent http handler creates, updates, runs, and lists agents", async () => {
  const { project, handler } = await createAgentHandlerFixture();
  const created = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/agents",
    body: {
      project_id: project.id,
      name: "Support Agent",
      instructions: "Answer with context.",
      tools: [{ name: "knowledge_search", type: "knowledge" }]
    }
  });
  const agentId = created.body.agent.id;
  const updated = await handler.handle({
    actor: { id: "owner_1" },
    method: "PATCH",
    path: `/agents/${agentId}/prompt`,
    body: {
      project_id: project.id,
      instructions: "Answer with context and citations."
    }
  });
  const run = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/agents/${agentId}/runs`,
    body: {
      project_id: project.id,
      input: {
        prompt: "Reset password",
        tool_requests: [
          {
            tool_name: "knowledge_search",
            input: { query: "reset password" }
          }
        ]
      }
    }
  });
  const runs = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: `/agents/${agentId}/runs`,
    query: {
      project_id: project.id
    }
  });

  assert.equal(created.status, 201);
  assert.equal(updated.body.agent.prompt_version, 2);
  assert.equal(run.status, 201);
  assert.equal(run.body.run.tool_calls[0].output.results[0], "doc_1");
  assert.equal(runs.status, 200);
  assert.equal(runs.body.runs.length, 1);
});

test("agent http handler maps validation and auth failures", async () => {
  const { project, handler } = await createAgentHandlerFixture();
  const missingName = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/agents",
    body: {
      project_id: project.id,
      instructions: "Missing name"
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "POST",
    path: "/agents",
    body: {
      project_id: project.id,
      name: "Viewer Agent",
      instructions: "Should fail"
    }
  });

  assert.equal(missingName.status, 400);
  assert.equal(forbidden.status, 403);
});

async function createAgentHandlerFixture() {
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
          results: ["doc_1"]
        })
      }
    ]),
    idGenerator,
    clock: () => new Date(timestamp)
  });

  return {
    project,
    handler: createAgentHttpHandler({ agentService: service })
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
