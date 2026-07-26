import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationService } from "../../src/application/authenticationService.js";
import { createAuthenticationHttpHandler } from "../../src/interfaces/authenticationHttpHandler.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("authentication http handler registers, logs in, and authenticates sessions", async () => {
  const handler = createAuthenticationHttpHandler({
    authenticationService: createAuthService()
  });

  const registered = await handler.handle({
    method: "POST",
    path: "/auth/register",
    body: {
      email: " Owner@Example.com ",
      password: "correct horse battery",
      name: " Owner "
    }
  });
  const loggedIn = await handler.handle({
    method: "POST",
    path: "/auth/login",
    body: {
      email: "owner@example.com",
      password: "correct horse battery"
    }
  });
  const session = await handler.handle({
    method: "GET",
    path: "/auth/session",
    headers: {
      Authorization: "Bearer token:user_1"
    }
  });

  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.email, "owner@example.com");
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.body.session.token, "token:user_1");
  assert.equal(session.status, 200);
  assert.equal(session.body.user.id, "user_1");
});

test("authentication http handler maps auth failures to json errors", async () => {
  const handler = createAuthenticationHttpHandler({
    authenticationService: createAuthService()
  });

  const missingToken = await handler.handle({
    method: "GET",
    path: "/auth/session",
    headers: {}
  });
  const missingRoute = await handler.handle({
    method: "GET",
    path: "/missing"
  });

  assert.equal(missingToken.status, 401);
  assert.equal(missingToken.body.error.code, "missing_bearer_token");
  assert.equal(missingRoute.status, 404);
  assert.equal(missingRoute.body.error.code, "not_found");
});

function createAuthService() {
  return createAuthenticationService({
    userRepository: createInMemorySecurityRepositories().users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: fakeSessionTokenIssuer(),
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
}

function fakePasswordHasher() {
  return {
    async hash(password) {
      return `hashed:${password}`;
    },

    async verify(password, hash) {
      return hash === `hashed:${password}`;
    }
  };
}

function fakeSessionTokenIssuer() {
  return {
    async issue({ user_id }) {
      return {
        token_type: "Bearer",
        token: `token:${user_id}`,
        expires_at: "2026-07-26T01:00:00.000Z"
      };
    },

    async verify(token) {
      const [, userId] = token.split(":");

      return {
        user_id: userId,
        expires_at: "2026-07-26T01:00:00.000Z"
      };
    }
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
