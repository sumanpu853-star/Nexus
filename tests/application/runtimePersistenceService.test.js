import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimePersistenceService } from "../../src/application/runtimePersistenceService.js";
import {
  DURABLE_PERSISTENCE_READINESS_STATUSES,
  PERSISTENCE_MIGRATION_STATUSES
} from "../../src/domain/durablePersistencePolicy.js";
import {
  createInMemoryPersistenceMetadataRepository
} from "../../src/infrastructure/inMemoryPersistenceMetadataRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("runtime persistence service records migrations and readiness", async () => {
  const service = createRuntimePersistenceFixture();
  const ports = await service.listRepositoryPorts({
    actor: { id: "viewer_1" }
  });
  const migration = await service.recordMigration({
    actor: { id: "owner_1" },
    version: "0001_create_runtime_tables",
    name: "Create runtime tables",
    checksum: "sha256:abc",
    status: PERSISTENCE_MIGRATION_STATUSES.APPLIED,
    applied_at: timestamp
  });
  const readiness = await service.getDurablePersistenceReadiness({
    actor: { id: "viewer_1" }
  });

  assert.equal(ports.some((port) => port.name === "queue_job_repository"), true);
  assert.equal(migration.id, "persistence_migration_1");
  assert.equal(readiness.status, DURABLE_PERSISTENCE_READINESS_STATUSES.READY);
  assert.equal(readiness.latest_applied_migration, "0001_create_runtime_tables");
});

test("runtime persistence service preserves migration ids and gates writes", async () => {
  const service = createRuntimePersistenceFixture();

  const pending = await service.recordMigration({
    actor: { id: "owner_1" },
    version: "0001_create_runtime_tables",
    name: "Create runtime tables",
    checksum: "sha256:abc"
  });
  const applied = await service.recordMigration({
    actor: { id: "owner_1" },
    version: "0001_create_runtime_tables",
    name: "Create runtime tables",
    checksum: "sha256:abc",
    status: PERSISTENCE_MIGRATION_STATUSES.APPLIED,
    applied_at: timestamp
  });

  assert.equal(applied.id, pending.id);
  assert.equal(applied.status, PERSISTENCE_MIGRATION_STATUSES.APPLIED);
  await assert.rejects(
    () =>
      service.recordMigration({
        actor: { id: "viewer_1" },
        version: "0002_forbidden",
        name: "Forbidden",
        checksum: "sha256:def"
      }),
    /runtime persistence management permission/
  );
});

function createRuntimePersistenceFixture() {
  return createRuntimePersistenceService({
    migrationRepository: createInMemoryPersistenceMetadataRepository(),
    adminActorIds: ["owner_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
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
