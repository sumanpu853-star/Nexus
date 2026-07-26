import assert from "node:assert/strict";
import test from "node:test";
import { createProductionAdapterService } from "../../src/application/productionAdapterService.js";
import {
  PRODUCTION_ADAPTER_CATEGORIES,
  PRODUCTION_ADAPTER_HEALTH_STATUSES,
  PRODUCTION_ADAPTER_TYPES,
  PRODUCTION_READINESS_STATUSES,
  createProductionAdapterDefinitionRecord
} from "../../src/domain/productionAdapterPolicy.js";
import {
  createDeterministicProductionAdapterHealthGateway
} from "../../src/infrastructure/deterministicProductionAdapterHealthGateway.js";
import {
  createInMemoryProductionAdapterRepositories
} from "../../src/infrastructure/inMemoryProductionAdapterRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("production adapter service manages configs and readiness through admin actors", async () => {
  const { service } = createProductionAdapterFixture();
  const definitions = await service.listAdapterDefinitions({
    actor: { id: "owner_1" }
  });
  const config = await service.upsertAdapterConfig({
    actor: { id: "owner_1" },
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    provider: "postgres",
    endpoint: "https://db.example.com",
    settings: {
      schema: "public"
    },
    secret_ref: "secret/postgres"
  });
  const updated = await service.upsertAdapterConfig({
    actor: { id: "owner_1" },
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    provider: "neon",
    endpoint: "https://db.example.com",
    settings: {
      schema: "nexus"
    },
    secret_ref: "secret/neon"
  });
  const healthCheck = await service.checkAdapterHealth({
    actor: { id: "owner_1" },
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  });
  const readiness = await service.getProductionReadiness({
    actor: { id: "viewer_1" }
  });

  assert.equal(definitions.length, 1);
  assert.equal(config.id, updated.id);
  assert.equal(updated.provider, "neon");
  assert.equal(healthCheck.status, PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS);
  assert.equal(readiness.status, PRODUCTION_READINESS_STATUSES.READY);
  assert.equal(readiness.required_configured, 1);
});

test("production adapter service blocks non-admin writes and unchecked health", async () => {
  const { service } = createProductionAdapterFixture();

  await assert.rejects(
    () =>
      service.upsertAdapterConfig({
        actor: { id: "viewer_1" },
        adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
        provider: "postgres"
      }),
    /production adapter management permission/
  );
  await assert.rejects(
    () =>
      service.checkAdapterHealth({
        actor: { id: "owner_1" },
        adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
      }),
    /configured before health checks/
  );
});

test("production adapter service reports failing health as blocked", async () => {
  const { service } = createProductionAdapterFixture({
    adapterHealthGateway: createDeterministicProductionAdapterHealthGateway({
      overrides: {
        [PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE]: {
          status: PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL,
          latency_ms: 75,
          message: "Database unavailable",
          details: { reason: "timeout" }
        }
      }
    })
  });

  await service.upsertAdapterConfig({
    actor: { id: "owner_1" },
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    provider: "postgres"
  });
  await service.checkAdapterHealth({
    actor: { id: "owner_1" },
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  });

  const readiness = await service.getProductionReadiness({
    actor: { id: "owner_1" }
  });

  assert.equal(readiness.status, PRODUCTION_READINESS_STATUSES.BLOCKED);
  assert.deepEqual(readiness.failing_required, [
    PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  ]);
});

function createProductionAdapterFixture({
  adapterHealthGateway = createDeterministicProductionAdapterHealthGateway()
} = {}) {
  const repositories = createInMemoryProductionAdapterRepositories();
  const definition = createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
    label: "Durable persistence",
    required: true,
    capabilities: ["workflows", "executions"]
  });

  return {
    repositories,
    service: createProductionAdapterService({
      adapterConfigRepository: repositories.adapterConfigs,
      healthCheckRepository: repositories.healthChecks,
      adapterHealthGateway,
      adapterDefinitions: [definition],
      adminActorIds: ["owner_1"],
      idGenerator: sequenceIds(),
      clock: () => new Date(timestamp)
    })
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
