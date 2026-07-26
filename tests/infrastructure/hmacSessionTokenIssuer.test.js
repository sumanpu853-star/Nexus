import assert from "node:assert/strict";
import test from "node:test";
import { createHmacSessionTokenIssuer } from "../../src/infrastructure/hmacSessionTokenIssuer.js";

const secret = "0123456789abcdef0123456789abcdef";

test("hmac session token issuer creates verifiable bearer sessions", async () => {
  const issuer = createHmacSessionTokenIssuer({
    secret,
    ttlMs: 60 * 60 * 1000,
    clock: () => new Date("2026-07-26T00:00:00.000Z")
  });
  const session = await issuer.issue({
    user_id: "user_1",
    email: "owner@example.com"
  });

  assert.equal(session.token_type, "Bearer");
  assert.equal(session.expires_at, "2026-07-26T01:00:00.000Z");
  assert.equal(session.token.split(".").length, 3);
  assert.deepEqual(await issuer.verify(session.token), {
    user_id: "user_1",
    email: "owner@example.com",
    expires_at: "2026-07-26T01:00:00.000Z"
  });
});

test("hmac session token issuer rejects tampered tokens", async () => {
  const issuer = createHmacSessionTokenIssuer({
    secret,
    clock: () => new Date("2026-07-26T00:00:00.000Z")
  });
  const session = await issuer.issue({ user_id: "user_1" });
  const tampered = `${session.token.slice(0, -1)}x`;

  await assert.rejects(() => issuer.verify(tampered), /invalid/);
});

test("hmac session token issuer rejects expired tokens", async () => {
  let now = new Date("2026-07-26T00:00:00.000Z");
  const issuer = createHmacSessionTokenIssuer({
    secret,
    ttlMs: 1000,
    clock: () => now
  });
  const session = await issuer.issue({ user_id: "user_1" });
  now = new Date("2026-07-26T00:00:02.000Z");

  await assert.rejects(() => issuer.verify(session.token), /expired/);
});
