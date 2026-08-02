import assert from "node:assert/strict";
import test from "node:test";
import {
  DURABLE_PERSISTENCE_READINESS_STATUSES,
  DURABLE_PERSISTENCE_RESOURCES,
  PERSISTENCE_MIGRATION_STATUSES,
  createDurablePersistenceReadinessReport,
  createDurableRepositoryPortRecord,
  createPersistenceMigrationRecord,
  findDurableRepositoryPort,
  getBuiltInDurableRepositoryPorts
} from "../../src/domain/durablePersistencePolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("durable persistence policy exposes required repository ports", () => {
  const ports = getBuiltInDurableRepositoryPorts();
  const queuePort = findDurableRepositoryPort({
    name: "queue_job_repository",
    ports
  });

  assert.equal(ports.length, 8);
  assert.equal(queuePort.resource, DURABLE_PERSISTENCE_RESOURCES.QUEUE_JOBS);
  assert.deepEqual(queuePort.required_methods, [
    "findById",
    "findByIdempotencyKey",
    "findAll",
    "claimNext",
    "save"
  ]);
  assert.equal(Object.isFrozen(queuePort), true);
});

test("durable persistence policy validates migration lifecycle records", () => {
  const migration = createPersistenceMigrationRecord({
    id: "persistence_migration_1",
    version: "0001_create_runtime_tables",
    name: "Create runtime tables",
    checksum: "sha256:abc",
    status: PERSISTENCE_MIGRATION_STATUSES.APPLIED,
    applied_at: timestamp,
    created_at: timestamp
  });

  assert.equal(migration.status, PERSISTENCE_MIGRATION_STATUSES.APPLIED);
  assert.throws(
    () =>
      createPersistenceMigrationRecord({
        id: "persistence_migration_2",
        version: "1",
        name: "Bad migration",
        checksum: "sha256:def",
        created_at: timestamp
      }),
    /digits and an underscore/
  );
  assert.throws(
    () =>
      createPersistenceMigrationRecord({
        id: "persistence_migration_3",
        version: "0002_missing_applied_at",
        name: "Missing applied timestamp",
        checksum: "sha256:ghi",
        status: PERSISTENCE_MIGRATION_STATUSES.APPLIED,
        created_at: timestamp
      }),
    /applied_at/
  );
});

test("durable persistence readiness tracks pending and failed migrations", () => {
  const ports = [
    createDurableRepositoryPortRecord({
      name: "queue_job_repository",
      resource: DURABLE_PERSISTENCE_RESOURCES.QUEUE_JOBS,
      required_methods: ["findById", "save"],
      transactional: true
    })
  ];
  const pending = createPersistenceMigrationRecord({
    id: "persistence_migration_1",
    version: "0001_create_queue_jobs",
    name: "Create queue jobs",
    checksum: "sha256:abc",
    created_at: timestamp
  });
  const failed = createPersistenceMigrationRecord({
    id: "persistence_migration_2",
    version: "0002_add_worker_leases",
    name: "Add worker leases",
    checksum: "sha256:def",
    status: PERSISTENCE_MIGRATION_STATUSES.FAILED,
    error: "Lock timeout",
    created_at: timestamp
  });

  const degraded = createDurablePersistenceReadinessReport({
    ports,
    migrations: [pending]
  });
  const blocked = createDurablePersistenceReadinessReport({
    ports,
    migrations: [pending, failed]
  });

  assert.equal(degraded.status, DURABLE_PERSISTENCE_READINESS_STATUSES.DEGRADED);
  assert.deepEqual(degraded.pending_migrations, ["0001_create_queue_jobs"]);
  assert.equal(blocked.status, DURABLE_PERSISTENCE_READINESS_STATUSES.BLOCKED);
  assert.deepEqual(blocked.failed_migrations, ["0002_add_worker_leases"]);
});
