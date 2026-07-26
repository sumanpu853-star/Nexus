import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryKnowledgeRepositories
} from "../../src/infrastructure/inMemoryKnowledgeRepositories.js";

test("in-memory knowledge repositories save and list project scoped records", async () => {
  const repositories = createInMemoryKnowledgeRepositories();
  const knowledgeBase = {
    id: "knowledge_base_1",
    project_id: "project_1",
    name: "Support KB"
  };
  const document = {
    id: "knowledge_document_1",
    knowledge_base_id: "knowledge_base_1",
    project_id: "project_1",
    title: "Password Reset"
  };
  const chunk = {
    id: "knowledge_chunk_1",
    knowledge_base_id: "knowledge_base_1",
    document_id: "knowledge_document_1",
    project_id: "project_1",
    text: "Reset password instructions."
  };

  const saved = await repositories.knowledgeBases.save(knowledgeBase);
  saved.name = "Changed";
  await repositories.knowledgeDocuments.save(document);
  await repositories.knowledgeChunks.saveMany([chunk]);

  assert.equal(
    (await repositories.knowledgeBases.findByProjectId("project_1"))[0].name,
    "Support KB"
  );
  assert.equal(
    (await repositories.knowledgeDocuments.findByKnowledgeBaseId("knowledge_base_1"))[0].title,
    "Password Reset"
  );
  assert.equal(
    (await repositories.knowledgeChunks.findByDocumentId("knowledge_document_1"))[0].text,
    "Reset password instructions."
  );
});

test("in-memory knowledge repositories update secondary indexes", async () => {
  const repositories = createInMemoryKnowledgeRepositories();

  await repositories.knowledgeBases.save({
    id: "knowledge_base_1",
    project_id: "project_1",
    name: "Support KB"
  });
  await repositories.knowledgeBases.save({
    id: "knowledge_base_1",
    project_id: "project_2",
    name: "Moved KB"
  });

  assert.deepEqual(await repositories.knowledgeBases.findByProjectId("project_1"), []);
  assert.equal(
    (await repositories.knowledgeBases.findByProjectId("project_2"))[0].name,
    "Moved KB"
  );
});
