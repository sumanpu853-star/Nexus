import assert from "node:assert/strict";
import test from "node:test";
import {
  PERSISTENCE_MIGRATION_STATUSES,
  createPersistenceMigrationRecord
} from "../../src/domain/durablePersistencePolicy.js";
import {
  createInMemoryPersistenceMetadataRepository
} from "../../src/infrastructure/inMemoryPersistenceMetadataRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("in-memory persistence metadata repository saves and sorts migrations", async () => {
  const repository = createInMemoryPersistenceMetadataRepository();
  const second = createMigration({
    id: "persistence_migration_2",
    version: "0002_add_queue_leases"
  });
  const first = createMigration({
    id: "persistence_migration_1",
    version: "0001_create_queue_jobs"
  });

  await repository.save(second);
  await repository.save(first);

  const found = await repository.findByVersion("0001_create_queue_jobs");
  const all = await repository.findAll();

  found.name = "mutated";

  assert.equal(found.name, "mutated");
  assert.deepEqual(
    all.map((migration) => migration.version),
    ["0001_create_queue_jobs", "0002_add_queue_leases"]
  );
  assert.equal(
    (await repository.findByVersion("0001_create_queue_jobs")).name,
    "Migration 0001_create_queue_jobs"
  );
});

test("in-memory persistence metadata repository keeps one migration per version", async () => {
  const repository = createInMemoryPersistenceMetadataRepository();

  await repository.save(
    createMigration({
      id: "persistence_migration_1",
      version: "0001_create_queue_jobs"
    })
  );

  await assert.rejects(
    () =>
      repository.save(
        createMigration({
          id: "persistence_migration_2",
          version: "0001_create_queue_jobs"
        })
      ),
    /version already exists/
  );
});

function createMigration({
  id,
  version
}) {
  return createPersistenceMigrationRecord({
    id,
    version,
    name: `Migration ${version}`,
    checksum: `sha256:${version}`,
    status: PERSISTENCE_MIGRATION_STATUSES.PENDING,
    created_at: timestamp
  });
}
