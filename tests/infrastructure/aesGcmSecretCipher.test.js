import assert from "node:assert/strict";
import test from "node:test";
import { createAesGcmSecretCipher } from "../../src/infrastructure/aesGcmSecretCipher.js";

const secretKey = "0123456789abcdef0123456789abcdef";

test("aes gcm secret cipher encrypts and decrypts JSON secrets", async () => {
  const cipher = createAesGcmSecretCipher({
    secretKey,
    randomBytesProvider: () => Buffer.alloc(12, 1)
  });
  const encrypted = await cipher.encrypt({
    token: "ghp_secret",
    scopes: ["repo"]
  });

  assert.match(encrypted, /^v1\./);
  assert.equal(encrypted.includes("ghp_secret"), false);
  assert.deepEqual(await cipher.decrypt(encrypted), {
    token: "ghp_secret",
    scopes: ["repo"]
  });
});

test("aes gcm secret cipher rejects tampered ciphertext", async () => {
  const cipher = createAesGcmSecretCipher({
    secretKey,
    randomBytesProvider: () => Buffer.alloc(12, 1)
  });
  const encrypted = await cipher.encrypt({ token: "ghp_secret" });
  const tampered = `${encrypted.slice(0, -1)}x`;

  await assert.rejects(() => cipher.decrypt(tampered));
});

test("aes gcm secret cipher requires strong local key material", () => {
  assert.throws(
    () => createAesGcmSecretCipher({ secretKey: "short" }),
    /at least 32 characters/
  );
});
