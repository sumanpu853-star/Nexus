import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationService } from "../../src/application/authenticationService.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("registerUser hashes credentials and returns a public user", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createAuthenticationService({
    userRepository: repositories.users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: fakeSessionTokenIssuer(),
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  const result = await service.registerUser({
    email: " Owner@Example.com ",
    password: "correct horse battery",
    name: " Owner "
  });
  const storedUser = await repositories.users.findByEmail("owner@example.com");

  assert.deepEqual(result.user, {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    created_at: timestamp
  });
  assert.equal(result.user.password_hash, undefined);
  assert.equal(storedUser.password_hash, "hashed:correct horse battery");
});

test("registerUser prevents duplicate emails", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createAuthenticationService({
    userRepository: repositories.users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: fakeSessionTokenIssuer(),
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  await service.registerUser({
    email: "owner@example.com",
    password: "correct horse battery"
  });

  await assert.rejects(
    () =>
      service.registerUser({
        email: "OWNER@example.com",
        password: "another correct password"
      }),
    /email already exists/
  );
});

test("loginUser returns a session for valid credentials", async () => {
  const repositories = createInMemorySecurityRepositories();
  const tokenIssuer = fakeSessionTokenIssuer();
  const service = createAuthenticationService({
    userRepository: repositories.users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: tokenIssuer,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  await service.registerUser({
    email: "owner@example.com",
    password: "correct horse battery"
  });
  const result = await service.loginUser({
    email: "owner@example.com",
    password: "correct horse battery"
  });

  assert.equal(result.user.email, "owner@example.com");
  assert.deepEqual(result.session, {
    token_type: "Bearer",
    token: "token:user_1",
    expires_at: "2026-07-26T01:00:00.000Z"
  });
});

test("loginUser rejects invalid credentials", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createAuthenticationService({
    userRepository: repositories.users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: fakeSessionTokenIssuer(),
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  await service.registerUser({
    email: "owner@example.com",
    password: "correct horse battery"
  });

  await assert.rejects(
    () =>
      service.loginUser({
        email: "owner@example.com",
        password: "wrong horse battery"
      }),
    /Invalid email or password/
  );
});

test("authenticateSession resolves the session user", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createAuthenticationService({
    userRepository: repositories.users,
    passwordHasher: fakePasswordHasher(),
    sessionTokenIssuer: fakeSessionTokenIssuer(),
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  await service.registerUser({
    email: "owner@example.com",
    password: "correct horse battery"
  });
  const result = await service.authenticateSession({ token: "token:user_1" });

  assert.equal(result.user.id, "user_1");
  assert.deepEqual(result.session, {
    expires_at: "2026-07-26T01:00:00.000Z"
  });
});

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
