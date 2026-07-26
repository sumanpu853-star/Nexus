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
import { createKnowledgeBaseHttpHandler } from "../../src/interfaces/knowledgeBaseHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("knowledge base http handler creates, lists, ingests, and searches", async () => {
  const { project, handler } = await createKnowledgeHandlerFixture();
  const created = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/knowledge-bases",
    body: {
      project_id: project.id,
      name: "Support KB",
      chunking: {
        max_chars: 140,
        overlap_chars: 20
      }
    }
  });
  const knowledgeBaseId = created.body.knowledge_base.id;
  const listed = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/knowledge-bases",
    query: {
      project_id: project.id
    }
  });
  const ingested = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/knowledge-bases/${knowledgeBaseId}/documents`,
    body: {
      project_id: project.id,
      title: "Password Reset",
      content: "Reset password from account security with verified email. ".repeat(8),
      metadata: {
        topic: "identity"
      }
    }
  });
  const search = await handler.handle({
    actor: { id: "viewer_1" },
    method: "POST",
    path: `/knowledge-bases/${knowledgeBaseId}/search`,
    body: {
      project_id: project.id,
      query: "reset password",
      limit: 1
    }
  });

  assert.equal(created.status, 201);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.knowledge_bases[0].id, knowledgeBaseId);
  assert.equal(ingested.status, 201);
  assert.equal(ingested.body.document.title, "Password Reset");
  assert.equal(search.status, 200);
  assert.equal(search.body.search.results[0].source.title, "Password Reset");
});

test("knowledge base http handler maps validation and auth errors", async () => {
  const { project, handler } = await createKnowledgeHandlerFixture();
  const missingName = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: "/knowledge-bases",
    body: {
      project_id: project.id
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "outsider_1" },
    method: "GET",
    path: "/knowledge-bases",
    query: {
      project_id: project.id
    }
  });

  assert.equal(missingName.status, 400);
  assert.equal(forbidden.status, 403);
});

async function createKnowledgeHandlerFixture() {
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

  const service = createKnowledgeBaseService({
    projectRepository: securityRepositories.projects,
    membershipRepository: securityRepositories.memberships,
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
    handler: createKnowledgeBaseHttpHandler({ knowledgeBaseService: service })
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
