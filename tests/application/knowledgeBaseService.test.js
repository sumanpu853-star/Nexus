import assert from "node:assert/strict";
import test from "node:test";
import { createKnowledgeBaseService } from "../../src/application/knowledgeBaseService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import {
  createDeterministicEmbeddingProvider
} from "../../src/infrastructure/deterministicEmbeddingProvider.js";
import {
  createInMemoryKnowledgeRepositories
} from "../../src/infrastructure/inMemoryKnowledgeRepositories.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";
import { createInMemoryVectorIndex } from "../../src/infrastructure/inMemoryVectorIndex.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("knowledge base service creates and lists project scoped knowledge bases", async () => {
  const { project, service } = await createKnowledgeFixture();

  const knowledgeBase = await service.createKnowledgeBase({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support KB"
  });
  const knowledgeBases = await service.listKnowledgeBases({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(knowledgeBase.owner_id, "owner_1");
  assert.equal(knowledgeBases[0].id, knowledgeBase.id);
  await assert.rejects(
    () =>
      service.listKnowledgeBases({
        actor: { id: "outsider_1" },
        project_id: project.id
      }),
    /does not belong/
  );
});

test("knowledge base service blocks viewers from ingestion", async () => {
  const { project, service } = await createKnowledgeFixture();
  const knowledgeBase = await service.createKnowledgeBase({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support KB"
  });

  await assert.rejects(
    () =>
      service.ingestKnowledgeDocument({
        actor: { id: "viewer_1" },
        project_id: project.id,
        knowledge_base_id: knowledgeBase.id,
        title: "Viewer Upload",
        content: "Viewers should not be able to change knowledge content."
      }),
    /required project permission/
  );
});

test("knowledge base service ingests, embeds, searches, and reranks content", async () => {
  const { project, service } = await createKnowledgeFixture();
  const knowledgeBase = await service.createKnowledgeBase({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Support KB",
    chunking: {
      max_chars: 140,
      overlap_chars: 25
    }
  });
  const ingestion = await service.ingestKnowledgeDocument({
    actor: { id: "owner_1" },
    project_id: project.id,
    knowledge_base_id: knowledgeBase.id,
    title: "Password Reset",
    source_uri: "kb://password-reset",
    metadata: { topic: "identity" },
    content: [
      "Reset password instructions start in account security with a verified email.",
      "Administrators can revoke sessions after a password reset completes.",
      "Billing exports are available from workspace settings for finance teams."
    ].join(" ").repeat(3)
  });
  const search = await service.searchKnowledgeBase({
    actor: { id: "viewer_1" },
    project_id: project.id,
    knowledge_base_id: knowledgeBase.id,
    query: "reset password verified email",
    limit: 1
  });

  assert.equal(ingestion.document.title, "Password Reset");
  assert.equal(ingestion.chunks.length > 1, true);
  assert.equal(search.results.length, 1);
  assert.equal(search.results[0].source.title, "Password Reset");
  assert.equal(search.results[0].metadata.topic, "identity");
  assert.equal(typeof search.results[0].rerank_score, "number");
});

async function createKnowledgeFixture() {
  const securityRepositories = createInMemorySecurityRepositories();
  const knowledgeRepositories = createInMemoryKnowledgeRepositories();
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
    service: createKnowledgeBaseService({
      projectRepository: securityRepositories.projects,
      membershipRepository: securityRepositories.memberships,
      knowledgeBaseRepository: knowledgeRepositories.knowledgeBases,
      knowledgeDocumentRepository: knowledgeRepositories.knowledgeDocuments,
      knowledgeChunkRepository: knowledgeRepositories.knowledgeChunks,
      vectorIndex: createInMemoryVectorIndex(),
      embeddingProvider: createDeterministicEmbeddingProvider({ dimensions: 8 }),
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
