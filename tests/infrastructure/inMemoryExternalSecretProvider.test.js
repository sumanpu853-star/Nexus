import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryExternalSecretProvider } from "../../src/infrastructure/inMemoryExternalSecretProvider.js";

test("in-memory external secret provider resolves cloned secrets by provider and ref", async () => {
  const provider = createInMemoryExternalSecretProvider([
    {
      provider: "aws-secrets-manager",
      ref: "prod/nexus/github",
      secret: { token: "ghp_secret" }
    }
  ]);
  const secret = await provider.getSecret({
    provider: "aws-secrets-manager",
    ref: "prod/nexus/github"
  });

  secret.token = "mutated";

  assert.deepEqual(
    await provider.getSecret({
      provider: "aws-secrets-manager",
      ref: "prod/nexus/github"
    }),
    { token: "ghp_secret" }
  );
});

test("in-memory external secret provider returns null for missing refs", async () => {
  const provider = createInMemoryExternalSecretProvider();

  assert.equal(
    await provider.getSecret({
      provider: "aws-secrets-manager",
      ref: "missing"
    }),
    null
  );
});

test("in-memory external secret provider rejects missing secret values", async () => {
  const provider = createInMemoryExternalSecretProvider();

  await assert.rejects(
    () => provider.saveSecret({
      provider: "aws-secrets-manager",
      ref: "prod/nexus/github"
    }),
    /External secret value is required/
  );
});
