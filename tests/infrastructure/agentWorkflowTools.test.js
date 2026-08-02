import assert from "node:assert/strict";
import test from "node:test";
import { createKnowledgeBaseService } from "../../src/application/knowledgeBaseService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkflowExecutionService } from "../../src/application/workflowExecutionService.js";
import {
  WORKFLOW_TRIGGER_SOURCES
} from "../../src/domain/workflowExecutionPolicy.js";
import {
  createKnowledgeSearchAgentTool,
  createWorkflowRunAgentTool
} from "../../src/infrastructure/agentWorkflowTools.js";
import {
  createDeterministicEmbeddingProvider
} from "../../src/infrastructure/deterministicEmbeddingProvider.js";
import {
  createInMemoryKnowledgeRepositories
} from "../../src/infrastructure/inMemoryKnowledgeRepositories.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import { createInMemoryVectorIndex } from "../../src/infrastructure/inMemoryVectorIndex.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("knowledge search agent tool delegates to project-scoped RAG search", async () => {
  const { project, knowledgeService } = await createToolFixture();
  const knowledgeBase = await knowledgeService.createKnowledgeBase({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support KB",
    chunking: {
      max_chars: 120,
      overlap_chars: 20
    }
  });

  await knowledgeService.ingestKnowledgeDocument({
    actor: { id: "owner_1" },
    project_id: project.id,
    knowledge_base_id: knowledgeBase.id,
    title: "Password Reset",
    content: "Reset password steps require a verified email and admin session review."
  });

  const output = await createKnowledgeSearchAgentTool({
    knowledgeBaseService: knowledgeService
  }).handler({
    input: {
      knowledge_base_id: knowledgeBase.id,
      query: "verified email password",
      limit: 1
    },
    context: {
      actor_id: "owner_1",
      project_id: project.id
    }
  });

  assert.equal(output.knowledge_base_id, knowledgeBase.id);
  assert.equal(output.result_count, 1);
  assert.equal(output.results[0].source.title, "Password Reset");
});

test("workflow run agent tool queues child workflows as sub-workflow executions", async () => {
  const { project, workflowService, executionService, repositories } =
    await createToolFixture();
  const childWorkflow = await workflowService.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Child Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });

  const output = await createWorkflowRunAgentTool({
    workflowExecutionService: executionService
  }).handler({
    input: {
      workflow_id: childWorkflow.id,
      input: { prompt: "Handle child task" },
      metadata: { requested_by: "agent" }
    },
    context: {
      actor_id: "owner_1",
      project_id: project.id,
      agent_id: "agent_1",
      run_id: "agent_run_1"
    }
  });
  const executions = await repositories.executions.findByWorkflowId(childWorkflow.id);

  assert.equal(output.queued, true);
  assert.equal(output.execution_id, executions[0].id);
  assert.equal(output.trigger_source, WORKFLOW_TRIGGER_SOURCES.SUB_WORKFLOW);
  assert.equal(executions[0].metadata.source, "agent_tool");
  assert.equal(executions[0].metadata.parent_agent_id, "agent_1");
});

async function createToolFixture() {
  const repositories = createInMemorySecurityRepositories();
  const knowledgeRepositories = createInMemoryKnowledgeRepositories();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const executionService = createWorkflowExecutionService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    executionRepository: repositories.executions,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const knowledgeService = createKnowledgeBaseService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    knowledgeBaseRepository: knowledgeRepositories.knowledgeBases,
    knowledgeDocumentRepository: knowledgeRepositories.knowledgeDocuments,
    knowledgeChunkRepository: knowledgeRepositories.knowledgeChunks,
    vectorIndex: createInMemoryVectorIndex(),
    embeddingProvider: createDeterministicEmbeddingProvider({ dimensions: 8 }),
    idGenerator,
    clock: () => new Date(timestamp)
  });

  return {
    project,
    repositories,
    workflowService,
    executionService,
    knowledgeService
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
