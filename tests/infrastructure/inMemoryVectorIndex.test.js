import assert from "node:assert/strict";
import test from "node:test";
import {
  VECTOR_WRITE_MODES
} from "../../src/domain/knowledgeBasePolicy.js";
import {
  createInMemoryVectorIndex
} from "../../src/infrastructure/inMemoryVectorIndex.js";

test("in-memory vector index searches by cosine similarity", async () => {
  const index = createInMemoryVectorIndex();

  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    vectors: [
      createVector({ id: "vector_1", chunk_id: "chunk_1", embedding: [1, 0] }),
      createVector({ id: "vector_2", chunk_id: "chunk_2", embedding: [0, 1] })
    ]
  });

  const results = await index.search({
    knowledge_base_id: "knowledge_base_1",
    embedding: [1, 0],
    limit: 2
  });

  assert.equal(results[0].id, "vector_1");
  assert.equal(results[0].score, 1);
});

test("in-memory vector index upserts without clearing unrelated vectors", async () => {
  const index = createInMemoryVectorIndex();

  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    vectors: [
      createVector({ id: "vector_1", document_id: "doc_1", chunk_id: "chunk_1" }),
      createVector({ id: "vector_2", document_id: "doc_2", chunk_id: "chunk_2" })
    ]
  });
  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    mode: VECTOR_WRITE_MODES.UPSERT,
    vectors: [
      createVector({
        id: "vector_1",
        document_id: "doc_1",
        chunk_id: "chunk_1",
        embedding: [0, 1]
      })
    ]
  });

  const results = await index.search({
    knowledge_base_id: "knowledge_base_1",
    embedding: [1, 0],
    limit: 10
  });

  assert.deepEqual(
    results.map((result) => result.id).sort(),
    ["vector_1", "vector_2"]
  );
});

test("in-memory vector index append rejects duplicates", async () => {
  const index = createInMemoryVectorIndex();

  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    mode: VECTOR_WRITE_MODES.APPEND,
    vectors: [createVector({ id: "vector_1" })]
  });

  await assert.rejects(
    () =>
      index.writeVectors({
        knowledge_base_id: "knowledge_base_1",
        mode: VECTOR_WRITE_MODES.APPEND,
        vectors: [createVector({ id: "vector_1" })]
      }),
    /already exists/
  );
});

test("in-memory vector index replace is scoped to incoming document ids", async () => {
  const index = createInMemoryVectorIndex();

  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    vectors: [
      createVector({ id: "vector_1", document_id: "doc_1", chunk_id: "chunk_1" }),
      createVector({ id: "vector_2", document_id: "doc_2", chunk_id: "chunk_2" })
    ]
  });
  await index.writeVectors({
    knowledge_base_id: "knowledge_base_1",
    mode: VECTOR_WRITE_MODES.REPLACE,
    vectors: [
      createVector({
        id: "vector_3",
        document_id: "doc_1",
        chunk_id: "chunk_3",
        text: "Updated password policy."
      })
    ]
  });

  const results = await index.search({
    knowledge_base_id: "knowledge_base_1",
    embedding: [1, 0],
    limit: 10
  });

  assert.deepEqual(
    results.map((result) => result.id).sort(),
    ["vector_2", "vector_3"]
  );
});

function createVector({
  id,
  document_id = "doc_1",
  chunk_id = "chunk_1",
  embedding = [1, 0],
  text = "Reset password policy.",
  metadata = {}
} = {}) {
  return {
    id,
    knowledge_base_id: "knowledge_base_1",
    document_id,
    chunk_id,
    project_id: "project_1",
    text,
    embedding,
    metadata
  };
}
