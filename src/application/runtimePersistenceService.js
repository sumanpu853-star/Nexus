import {
  createDurablePersistenceReadinessReport,
  createDurableRepositoryPortRecord,
  createPersistenceMigrationRecord,
  getBuiltInDurableRepositoryPorts
} from "../domain/durablePersistencePolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createRuntimePersistenceService({
  migrationRepository,
  repositoryPorts = getBuiltInDurableRepositoryPorts(),
  adminActorIds = [],
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(migrationRepository, "migrationRepository", [
    "findByVersion",
    "findAll",
    "save"
  ]);

  const ports = repositoryPorts.map((port) =>
    createDurableRepositoryPortRecord(port)
  );
  const admins = new Set(normalizeStringArray(adminActorIds, "adminActorIds"));

  return Object.freeze({
    async listRepositoryPorts({
      actor
    } = {}) {
      assertAuthenticated(actor);

      return ports.map((port) => createDurableRepositoryPortRecord(port));
    },

    async recordMigration({
      actor,
      version,
      name,
      checksum,
      status,
      applied_at = null,
      error = null
    } = {}) {
      requireAdminPermission({ actor, admins });

      const existing = await migrationRepository.findByVersion(version);
      const timestamp = nowIso(clock);
      const migration = createPersistenceMigrationRecord({
        id: existing?.id ?? nextId(idGenerator, "persistence_migration"),
        version,
        name,
        checksum,
        status,
        applied_at,
        error,
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp
      });

      return migrationRepository.save(migration);
    },

    async listMigrations({
      actor
    } = {}) {
      assertAuthenticated(actor);

      return migrationRepository.findAll();
    },

    async getDurablePersistenceReadiness({
      actor
    } = {}) {
      assertAuthenticated(actor);

      return createDurablePersistenceReadinessReport({
        ports,
        migrations: await migrationRepository.findAll()
      });
    }
  });
}

function requireAdminPermission({
  actor,
  admins
}) {
  const actorId = assertAuthenticated(actor);

  if (admins.size === 0) {
    throw new AuthorizationError(
      "Runtime persistence management requires configured admin actors.",
      "runtime_persistence_admin_required"
    );
  }

  if (!admins.has(actorId)) {
    throw new AuthorizationError(
      "User does not have runtime persistence management permission.",
      "runtime_persistence_manage_required"
    );
  }

  return actorId;
}

function assertAuthenticated(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError(
      "Runtime persistence operations require an authenticated actor."
    );
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(
        `createRuntimePersistenceService requires ${name}.${method}().`
      );
    }
  }
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new TypeError(`${field} must contain non-empty strings.`);
    }

    return entry.trim();
  });
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createRuntimePersistenceService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
