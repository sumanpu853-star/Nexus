import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_KNOWLEDGE_CHUNKING,
  KnowledgeBaseValidationError,
  chunkKnowledgeDocument,
  createKnowledgeBaseRecord,
  createKnowledgeChunkRecord,
  createKnowledgeDocumentRecord,
  rerankKnowledgeSearchResults
} from "../../src/domain/knowledgeBasePolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("knowledge base records normalize the roadmap object shape", () => {
  const knowledgeBase = createKnowledgeBaseRecord({
    id: "knowledge_base_1",
    project_id: "project_1",
    owner_id: "owner_1",
    name: " Support KB ",
    created_at: timestamp
  });

  assert.equal(knowledgeBase.name, "Support KB");
  assert.deepEqual(knowledgeBase.chunking, DEFAULT_KNOWLEDGE_CHUNKING);
  assert.equal(knowledgeBase.embedding_model, "nexus-deterministic-v1");
  assert.equal(Object.isFrozen(knowledgeBase.chunking), true);
});

test("knowledge documents and chunks validate metadata and content hashes", () => {
  const document = createKnowledgeDocumentRecord({
    id: "knowledge_document_1",
    knowledge_base_id: "knowledge_base_1",
    project_id: "project_1",
    title: "Password Reset",
    content_hash: "fnv1a:12345678",
    metadata: { team: "support" },
    created_at: timestamp
  });
  const chunk = createKnowledgeChunkRecord({
    id: "knowledge_chunk_1",
    knowledge_base_id: document.knowledge_base_id,
    document_id: document.id,
    project_id: document.project_id,
    ordinal: 0,
    text: "Reset passwords from the account security page.",
    content_hash: "fnv1a:87654321",
    created_at: timestamp
  });

  assert.equal(document.status, "ready");
  assert.equal(chunk.token_count, 7);
  assert.equal(chunk.embedding_ref, null);
  assert.equal(Object.isFrozen(chunk), true);
});

test("chunkKnowledgeDocument splits content with overlap metadata", () => {
  const content = [
    "Reset password instructions require an account owner and a verified email address.",
    "Billing invoice exports are available from workspace settings after payment clears.",
    "Security audit logs include user, project, workflow, and credential access events."
  ].join(" ").repeat(3);

  const chunks = chunkKnowledgeDocument({
    content,
    chunking: {
      max_chars: 140,
      overlap_chars: 30
    },
    metadata: { topic: "support" }
  });

  assert.equal(chunks.length > 1, true);
  assert.deepEqual(chunks[0].metadata, { topic: "support" });
  assert.equal(chunks[1].ordinal, 1);
  assert.equal(chunks.every((chunk) => chunk.text.length <= 140), true);
});

test("rerankKnowledgeSearchResults blends vector and lexical relevance", () => {
  const results = rerankKnowledgeSearchResults({
    query: "reset password",
    limit: 1,
    results: [
      {
        knowledge_base_id: "knowledge_base_1",
        document_id: "doc_1",
        chunk_id: "chunk_1",
        text: "Billing invoice exports live in workspace settings.",
        score: 0.8
      },
      {
        knowledge_base_id: "knowledge_base_1",
        document_id: "doc_2",
        chunk_id: "chunk_2",
        text: "Reset a password from the account security page.",
        score: 0.6
      }
    ]
  });

  assert.equal(results[0].chunk_id, "chunk_2");
  assert.equal(results[0].rerank_score > results[0].score, true);
});

test("knowledge policy rejects invalid chunking and empty content", () => {
  assert.throws(
    () =>
      createKnowledgeBaseRecord({
        id: "knowledge_base_1",
        project_id: "project_1",
        owner_id: "owner_1",
        name: "Bad KB",
        chunking: {
          max_chars: 90,
          overlap_chars: 10
        },
        created_at: timestamp
      }),
    KnowledgeBaseValidationError
  );
  assert.throws(
    () => chunkKnowledgeDocument({ content: "   " }),
    /non-empty string/
  );
});
