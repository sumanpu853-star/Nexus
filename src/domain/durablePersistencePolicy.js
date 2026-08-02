export const DURABLE_PERSISTENCE_RESOURCES = Object.freeze({
  USERS: "users",
  PROJECTS: "projects",
  MEMBERSHIPS: "memberships",
  WORKFLOWS: "workflows",
  EXECUTIONS: "executions",
  CREDENTIALS: "credentials",
  KNOWLEDGE_BASES: "knowledge_bases",
  AGENTS: "agents",
  INTEGRATIONS: "integrations",
  DEPLOYMENTS: "deployments",
  QUEUE_JOBS: "queue_jobs",
  PRODUCTION_ADAPTERS: "production_adapters"
});

export const PERSISTENCE_MIGRATION_STATUSES = Object.freeze({
  PENDING: "pending",
  APPLIED: "applied",
  FAILED: "failed"
});

export const DURABLE_PERSISTENCE_READINESS_STATUSES = Object.freeze({
  READY: "ready",
  DEGRADED: "degraded",
  BLOCKED: "blocked"
});

export class DurablePersistencePolicyValidationError extends Error {
  constructor(message, {
    code = "durable_persistence_policy_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "DurablePersistencePolicyValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const BUILT_IN_REPOSITORY_PORTS = Object.freeze([
  createDurableRepositoryPortRecord({
    name: "user_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.USERS,
    required_methods: ["findById", "findByEmail", "save"],
    transactional: false
  }),
  createDurableRepositoryPortRecord({
    name: "project_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.PROJECTS,
    required_methods: ["findById", "save"],
    transactional: false
  }),
  createDurableRepositoryPortRecord({
    name: "membership_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.MEMBERSHIPS,
    required_methods: ["findByProjectId", "save"],
    transactional: false
  }),
  createDurableRepositoryPortRecord({
    name: "workflow_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.WORKFLOWS,
    required_methods: ["findById", "findByProjectId", "save"],
    transactional: true
  }),
  createDurableRepositoryPortRecord({
    name: "execution_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.EXECUTIONS,
    required_methods: ["findById", "findByWorkflowId", "save"],
    transactional: true
  }),
  createDurableRepositoryPortRecord({
    name: "credential_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.CREDENTIALS,
    required_methods: ["findById", "findByProjectId", "save"],
    transactional: true
  }),
  createDurableRepositoryPortRecord({
    name: "queue_job_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.QUEUE_JOBS,
    required_methods: [
      "findById",
      "findByIdempotencyKey",
      "findAll",
      "claimNext",
      "save"
    ],
    transactional: true
  }),
  createDurableRepositoryPortRecord({
    name: "production_adapter_repository",
    resource: DURABLE_PERSISTENCE_RESOURCES.PRODUCTION_ADAPTERS,
    required_methods: ["findByAdapterType", "findAll", "save"],
    transactional: false
  })
]);

export function getBuiltInDurableRepositoryPorts() {
  return BUILT_IN_REPOSITORY_PORTS.map((port) =>
    createDurableRepositoryPortRecord(port)
  );
}

export function findDurableRepositoryPort({
  name,
  ports = getBuiltInDurableRepositoryPorts()
} = {}) {
  const normalizedName = normalizeRequiredString(name, "Repository port name");

  return (
    normalizeRepositoryPorts(ports).find((port) => port.name === normalizedName) ??
    null
  );
}

export function createDurableRepositoryPortRecord({
  name,
  resource,
  required_methods,
  transactional = false,
  durability_required = true
} = {}) {
  return deepFreeze({
    name: normalizeIdentifier(name, "Repository port name"),
    resource: normalizeEnum(
      resource,
      DURABLE_PERSISTENCE_RESOURCES,
      "Repository port resource"
    ),
    required_methods: normalizeMethodNames(required_methods),
    transactional: Boolean(transactional),
    durability_required: Boolean(durability_required)
  });
}

export function createPersistenceMigrationRecord({
  id,
  adapter_type = "durable_persistence",
  version,
  name,
  checksum,
  status = PERSISTENCE_MIGRATION_STATUSES.PENDING,
  applied_at = null,
  error = null,
  created_at,
  updated_at = created_at
} = {}) {
  const normalizedStatus = normalizeEnum(
    status,
    PERSISTENCE_MIGRATION_STATUSES,
    "Persistence migration status"
  );
  const normalizedAppliedAt = normalizeNullableTimestamp(
    applied_at,
    "Persistence migration applied_at"
  );
  const normalizedError = normalizeNullableError(
    error,
    "Persistence migration error"
  );

  if (
    normalizedStatus === PERSISTENCE_MIGRATION_STATUSES.APPLIED &&
    !normalizedAppliedAt
  ) {
    throw new DurablePersistencePolicyValidationError(
      "Applied persistence migrations must include applied_at.",
      {
        code: "persistence_migration_applied_at_required",
        details: { version }
      }
    );
  }

  if (
    normalizedStatus === PERSISTENCE_MIGRATION_STATUSES.FAILED &&
    !normalizedError
  ) {
    throw new DurablePersistencePolicyValidationError(
      "Failed persistence migrations must include an error.",
      {
        code: "persistence_migration_error_required",
        details: { version }
      }
    );
  }

  return deepFreeze({
    id: normalizeRequiredString(id, "Persistence migration id"),
    adapter_type: normalizeRequiredString(
      adapter_type,
      "Persistence migration adapter_type"
    ),
    version: normalizeMigrationVersion(version),
    name: normalizeRequiredString(name, "Persistence migration name"),
    checksum: normalizeRequiredString(checksum, "Persistence migration checksum"),
    status: normalizedStatus,
    applied_at: normalizedAppliedAt,
    error: normalizedError,
    created_at: normalizeTimestamp(created_at, "Persistence migration created_at"),
    updated_at: normalizeTimestamp(updated_at, "Persistence migration updated_at")
  });
}

export function createDurablePersistenceReadinessReport({
  ports = getBuiltInDurableRepositoryPorts(),
  migrations = []
} = {}) {
  const normalizedPorts = normalizeRepositoryPorts(ports);
  const normalizedMigrations = normalizeArray(
    migrations,
    "Persistence migrations"
  ).map((migration) => createPersistenceMigrationRecord(migration));
  const migrationStatusCounts = countMigrationStatuses(normalizedMigrations);
  const failedMigrations = normalizedMigrations.filter(
    (migration) => migration.status === PERSISTENCE_MIGRATION_STATUSES.FAILED
  );
  const pendingMigrations = normalizedMigrations.filter(
    (migration) => migration.status === PERSISTENCE_MIGRATION_STATUSES.PENDING
  );
  const status = resolveReadinessStatus({
    failedMigrations,
    pendingMigrations
  });

  return deepFreeze({
    status,
    repository_port_count: normalizedPorts.length,
    transactional_port_count: normalizedPorts.filter((port) => port.transactional)
      .length,
    required_methods_count: normalizedPorts.reduce(
      (total, port) => total + port.required_methods.length,
      0
    ),
    migration_status_counts: migrationStatusCounts,
    pending_migrations: pendingMigrations.map((migration) => migration.version),
    failed_migrations: failedMigrations.map((migration) => migration.version),
    latest_applied_migration:
      normalizedMigrations
        .filter((migration) => migration.status === PERSISTENCE_MIGRATION_STATUSES.APPLIED)
        .sort((left, right) => right.version.localeCompare(left.version))[0]
        ?.version ?? null,
    ports: normalizedPorts,
    migrations: normalizedMigrations
  });
}

function resolveReadinessStatus({
  failedMigrations,
  pendingMigrations
}) {
  if (failedMigrations.length > 0) {
    return DURABLE_PERSISTENCE_READINESS_STATUSES.BLOCKED;
  }

  if (pendingMigrations.length > 0) {
    return DURABLE_PERSISTENCE_READINESS_STATUSES.DEGRADED;
  }

  return DURABLE_PERSISTENCE_READINESS_STATUSES.READY;
}

function countMigrationStatuses(migrations) {
  const counts = {
    [PERSISTENCE_MIGRATION_STATUSES.PENDING]: 0,
    [PERSISTENCE_MIGRATION_STATUSES.APPLIED]: 0,
    [PERSISTENCE_MIGRATION_STATUSES.FAILED]: 0
  };

  for (const migration of migrations) {
    counts[migration.status] += 1;
  }

  return counts;
}

function normalizeRepositoryPorts(ports) {
  return normalizeArray(ports, "Repository ports").map((port) =>
    createDurableRepositoryPortRecord(port)
  );
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new DurablePersistencePolicyValidationError(`${field} is not supported.`, {
      code: "durable_persistence_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DurablePersistencePolicyValidationError(
      `${field} must be a non-empty string.`
    );
  }

  return value.trim();
}

function normalizeIdentifier(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new DurablePersistencePolicyValidationError(
      `${field} must use lowercase letters, numbers, and underscores.`
    );
  }

  return normalized;
}

function normalizeMigrationVersion(value) {
  const normalized = normalizeRequiredString(value, "Persistence migration version");

  if (!/^[0-9]{4,}_[a-z0-9_]+$/.test(normalized)) {
    throw new DurablePersistencePolicyValidationError(
      "Persistence migration version must start with digits and an underscore."
    );
  }

  return normalized;
}

function normalizeMethodNames(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DurablePersistencePolicyValidationError(
      "Repository port required_methods must be a non-empty array."
    );
  }

  return [...new Set(value.map((method) =>
    normalizeRequiredString(method, "Repository port required method")
  ))];
}

function normalizeNullableError(value, field) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return { message: value };
  }

  return normalizePlainObject(value, field);
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DurablePersistencePolicyValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new DurablePersistencePolicyValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new DurablePersistencePolicyValidationError(
      `${field} must be an ISO timestamp.`
    );
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeTimestamp(value, field);
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
