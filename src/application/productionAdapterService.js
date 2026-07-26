import {
  PRODUCTION_ADAPTER_STATUSES,
  ProductionAdapterPolicyValidationError,
  createProductionAdapterConfigRecord,
  createProductionAdapterDefinitionRecord,
  createProductionAdapterHealthCheckRecord,
  createProductionReadinessReport,
  findProductionAdapterDefinition,
  getBuiltInProductionAdapterDefinitions
} from "../domain/productionAdapterPolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createProductionAdapterService({
  adapterConfigRepository,
  healthCheckRepository,
  adapterHealthGateway,
  adapterDefinitions = getBuiltInProductionAdapterDefinitions(),
  adminActorIds = [],
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(adapterConfigRepository, "adapterConfigRepository", [
    "findByAdapterType",
    "findAll",
    "save"
  ]);
  assertRepository(healthCheckRepository, "healthCheckRepository", [
    "findByAdapterType",
    "findAll",
    "save"
  ]);

  if (!adapterHealthGateway || typeof adapterHealthGateway.check !== "function") {
    throw new TypeError(
      "createProductionAdapterService requires adapterHealthGateway.check()."
    );
  }

  const definitions = adapterDefinitions.map((definition) =>
    createProductionAdapterDefinitionRecord(definition)
  );
  const admins = new Set(
    normalizeStringArray(adminActorIds, "Production adapter adminActorIds")
  );

  return Object.freeze({
    async listAdapterDefinitions({
      actor
    } = {}) {
      assertAuthenticated(actor);

      return definitions.map((definition) =>
        createProductionAdapterDefinitionRecord(definition)
      );
    },

    async upsertAdapterConfig({
      actor,
      adapter_type,
      provider,
      status = PRODUCTION_ADAPTER_STATUSES.CONFIGURED,
      endpoint = null,
      settings = {},
      secret_ref = null,
      capabilities
    } = {}) {
      requireManagePermission({ actor, admins });

      const definition = requireDefinition({
        definitions,
        adapter_type
      });
      const existing = await adapterConfigRepository.findByAdapterType(
        definition.type
      );
      const timestamp = nowIso(clock);
      const config = createProductionAdapterConfigRecord({
        id: existing?.id ?? nextId(idGenerator, "production_adapter_config"),
        adapter_type: definition.type,
        category: definition.category,
        provider,
        status,
        endpoint,
        settings,
        secret_ref,
        capabilities: capabilities ?? definition.capabilities,
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp
      });

      return adapterConfigRepository.save(config);
    },

    async listAdapterConfigs({
      actor
    } = {}) {
      assertAuthenticated(actor);

      return adapterConfigRepository.findAll();
    },

    async checkAdapterHealth({
      actor,
      adapter_type
    } = {}) {
      requireManagePermission({ actor, admins });

      const definition = requireDefinition({
        definitions,
        adapter_type
      });
      const config = await adapterConfigRepository.findByAdapterType(
        definition.type
      );

      if (!config || config.status !== PRODUCTION_ADAPTER_STATUSES.CONFIGURED) {
        throw new ProductionAdapterPolicyValidationError(
          "Production adapter must be configured before health checks.",
          {
            code: "production_adapter_config_required",
            details: { adapter_type: definition.type }
          }
        );
      }

      const result = await adapterHealthGateway.check({
        definition,
        config
      });
      const healthCheck = createProductionAdapterHealthCheckRecord({
        id: nextId(idGenerator, "production_adapter_health_check"),
        adapter_type: definition.type,
        status: result.status,
        checked_at: nowIso(clock),
        latency_ms: result.latency_ms ?? null,
        message: result.message ?? "",
        details: result.details ?? {}
      });

      return healthCheckRepository.save(healthCheck);
    },

    async getProductionReadiness({
      actor
    } = {}) {
      assertAuthenticated(actor);

      const [configs, healthChecks] = await Promise.all([
        adapterConfigRepository.findAll(),
        healthCheckRepository.findAll()
      ]);

      return createProductionReadinessReport({
        definitions,
        configs,
        healthChecks
      });
    }
  });
}

function requireDefinition({
  definitions,
  adapter_type
}) {
  const definition = findProductionAdapterDefinition({
    adapter_type,
    definitions
  });

  if (!definition) {
    throw new ProductionAdapterPolicyValidationError(
      "Production adapter type is not supported.",
      {
        code: "production_adapter_type_unsupported",
        details: { adapter_type }
      }
    );
  }

  return definition;
}

function requireManagePermission({
  actor,
  admins
}) {
  const actorId = assertAuthenticated(actor);

  if (admins.size === 0) {
    throw new AuthorizationError(
      "Production adapter management requires configured admin actors.",
      "production_adapter_admin_required"
    );
  }

  if (!admins.has(actorId)) {
    throw new AuthorizationError(
      "User does not have production adapter management permission.",
      "production_adapter_manage_required"
    );
  }

  return actorId;
}

function assertAuthenticated(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError(
      "Production adapter operations require an authenticated actor."
    );
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(
        `createProductionAdapterService requires ${name}.${method}().`
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

  throw new TypeError("createProductionAdapterService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
