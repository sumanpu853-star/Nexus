import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimePersistenceService } from "../../src/application/runtimePersistenceService.js";
import {
  PERSISTENCE_MIGRATION_STATUSES
} from "../../src/domain/durablePersistencePolicy.js";
import {
  createInMemoryPersistenceMetadataRepository
} from "../../src/infrastructure/inMemoryPersistenceMetadataRepository.js";
import {
  createRuntimePersistenceHttpHandler
} from "../../src/interfaces/runtimePersistenceHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("runtime persistence http handler exposes ports, migrations, and readiness", async () => {
  const handler = createRuntimePersistenceHandlerFixture();
  const ports = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/runtime-persistence/ports"
  });
  const migration = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: "/runtime-persistence/migrations/0001_create_runtime_tables",
    body: {
      name: "Create runtime tables",
      checksum: "sha256:abc",
      status: PERSISTENCE_MIGRATION_STATUSES.APPLIED,
      applied_at: timestamp
    }
  });
  const migrations = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/runtime-persistence/migrations"
  });
  const readiness = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/runtime-persistence/readiness"
  });

  assert.equal(ports.status, 200);
  assert.equal(ports.body.ports.some((port) => port.name === "queue_job_repository"), true);
  assert.equal(migration.status, 200);
  assert.equal(migrations.body.migrations.length, 1);
  assert.equal(readiness.body.readiness.status, "ready");
});

test("runtime persistence http handler maps validation and auth failures", async () => {
  const handler = createRuntimePersistenceHandlerFixture();
  const invalid = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: "/runtime-persistence/migrations/bad",
    body: {
      name: "Bad migration",
      checksum: "sha256:bad"
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "PUT",
    path: "/runtime-persistence/migrations/0001_create_runtime_tables",
    body: {
      name: "Create runtime tables",
      checksum: "sha256:abc"
    }
  });

  assert.equal(invalid.status, 400);
  assert.equal(forbidden.status, 403);
});

function createRuntimePersistenceHandlerFixture() {
  const service = createRuntimePersistenceService({
    migrationRepository: createInMemoryPersistenceMetadataRepository(),
    adminActorIds: ["owner_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  return createRuntimePersistenceHttpHandler({
    runtimePersistenceService: service
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
