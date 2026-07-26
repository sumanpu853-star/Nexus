import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeterministicEmbeddingProvider
} from "../../src/infrastructure/deterministicEmbeddingProvider.js";

test("deterministic embedding provider returns stable normalized vectors", async () => {
  const provider = createDeterministicEmbeddingProvider({ dimensions: 8 });
  const documents = await provider.embedDocuments({
    texts: ["Reset password from account security", "Export billing invoices"]
  });
  const query = await provider.embedQuery({
    text: "Reset password from account security"
  });
  const magnitude = Math.sqrt(
    documents.embeddings[0].reduce((sum, value) => sum + (value * value), 0)
  );

  assert.equal(documents.model, "nexus-deterministic-v1");
  assert.equal(documents.dimensions, 8);
  assert.deepEqual(documents.embeddings[0], query.embedding);
  assert.equal(Math.abs(magnitude - 1) < 0.000001, true);
});

test("deterministic embedding provider validates dimensions and text", async () => {
  assert.throws(
    () => createDeterministicEmbeddingProvider({ dimensions: 2 }),
    /between 4 and 4096/
  );

  const provider = createDeterministicEmbeddingProvider();

  await assert.rejects(
    () => provider.embedQuery({ text: "" }),
    /non-empty string/
  );
});
