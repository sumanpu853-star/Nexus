import assert from "node:assert/strict";
import test from "node:test";
import { createNodeCryptoPasswordHasher } from "../../src/infrastructure/nodeCryptoPasswordHasher.js";

test("node crypto password hasher verifies matching passwords only", async () => {
  const hasher = createNodeCryptoPasswordHasher({
    iterations: 1000,
    randomBytesProvider: () => Buffer.alloc(16, 1)
  });
  const hash = await hasher.hash("correct horse battery");

  assert.match(hash, /^pbkdf2:sha256:1000:/);
  assert.equal(hash.includes("correct horse battery"), false);
  assert.equal(await hasher.verify("correct horse battery", hash), true);
  assert.equal(await hasher.verify("wrong horse battery", hash), false);
});

test("node crypto password hasher rejects malformed hashes", async () => {
  const hasher = createNodeCryptoPasswordHasher({ iterations: 1000 });

  assert.equal(await hasher.verify("password", "not-a-real-hash"), false);
});
