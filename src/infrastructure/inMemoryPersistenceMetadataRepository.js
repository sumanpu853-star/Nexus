import {
  createPersistenceMigrationRecord
} from "../domain/durablePersistencePolicy.js";

export function createInMemoryPersistenceMetadataRepository(initialState = {}) {
  const migrationsById = new Map();
  const migrationIdByVersion = new Map();

  for (const migration of initialState.migrations ?? []) {
    saveMigration(migration);
  }

  return Object.freeze({
    async findByVersion(version) {
      const id = migrationIdByVersion.get(version);

      return id ? cloneOrNull(migrationsById.get(id)) : null;
    },

    async findAll() {
      return cloneArray([...migrationsById.values()]).sort((left, right) =>
        left.version.localeCompare(right.version)
      );
    },

    async save(migration) {
      saveMigration(migration);

      return cloneOrNull(migration);
    }
  });

  function saveMigration(migration) {
    const normalizedMigration = createPersistenceMigrationRecord(migration);
    const existing = migrationsById.get(normalizedMigration.id);
    const existingForVersion = migrationIdByVersion.get(
      normalizedMigration.version
    );

    if (existingForVersion && existingForVersion !== normalizedMigration.id) {
      throw new TypeError("Persistence migration version already exists.");
    }

    if (existing) {
      migrationIdByVersion.delete(existing.version);
    }

    migrationsById.set(normalizedMigration.id, clone(normalizedMigration));
    migrationIdByVersion.set(normalizedMigration.version, normalizedMigration.id);
  }
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
