import {
  AuthenticationError,
  assertPasswordPolicy,
  createUserAccount,
  normalizeEmail
} from "../domain/securityPolicy.js";

export function createAuthenticationService({
  userRepository,
  passwordHasher,
  sessionTokenIssuer,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertUserRepository(userRepository);
  assertPasswordHasher(passwordHasher);
  assertSessionTokenIssuer(sessionTokenIssuer);

  return Object.freeze({
    async registerUser({ email, password, name = "" } = {}) {
      assertPasswordPolicy(password);

      const normalizedEmail = normalizeEmail(email);
      const existingUser = await userRepository.findByEmail(normalizedEmail);

      if (existingUser) {
        throw new AuthenticationError("A user with that email already exists.", "email_taken");
      }

      const createdAt = nowIso(clock);
      const user = createUserAccount({
        id: nextId(idGenerator, "user"),
        email: normalizedEmail,
        name,
        password_hash: await passwordHasher.hash(password),
        created_at: createdAt
      });
      const savedUser = await userRepository.save(user);

      return {
        user: toPublicUser(savedUser)
      };
    },

    async loginUser({ email, password } = {}) {
      const normalizedEmail = normalizeEmail(email);
      const user = await userRepository.findByEmail(normalizedEmail);
      const passwordMatches =
        typeof password === "string" &&
        user &&
        (await passwordHasher.verify(password, user.password_hash));

      if (!passwordMatches) {
        throw new AuthenticationError("Invalid email or password.", "invalid_credentials");
      }

      return {
        user: toPublicUser(user),
        session: await sessionTokenIssuer.issue({
          user_id: user.id,
          email: user.email
        })
      };
    },

    async authenticateSession({ token } = {}) {
      const claims = await sessionTokenIssuer.verify(token);
      const user = await userRepository.findById(claims.user_id);

      if (!user) {
        throw new AuthenticationError("Session user was not found.", "invalid_session");
      }

      return {
        user: toPublicUser(user),
        session: {
          expires_at: claims.expires_at
        }
      };
    }
  });
}

export function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return Object.freeze({
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at
  });
}

function assertUserRepository(repository) {
  assertMethod(repository, "findByEmail", "userRepository");
  assertMethod(repository, "findById", "userRepository");
  assertMethod(repository, "save", "userRepository");
}

function assertPasswordHasher(hasher) {
  assertMethod(hasher, "hash", "passwordHasher");
  assertMethod(hasher, "verify", "passwordHasher");
}

function assertSessionTokenIssuer(issuer) {
  assertMethod(issuer, "issue", "sessionTokenIssuer");
  assertMethod(issuer, "verify", "sessionTokenIssuer");
}

function assertMethod(target, method, name) {
  if (!target || typeof target[method] !== "function") {
    throw new TypeError(`createAuthenticationService requires ${name}.${method}().`);
  }
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createAuthenticationService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
