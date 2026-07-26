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
import {
  createProductionAdapterHttpHandler
} from "../../src/interfaces/productionAdapterHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("production adapter http handler configures, health-checks, and reports readiness", async () => {
  const handler = createProductionAdapterHandlerFixture();
  const definitions = await handler.handle({
    actor: { id: "owner_1" },
    method: "GET",
    path: "/production-adapters"
  });
  const config = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: `/production-adapter-configs/${PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE}`,
    body: {
      provider: "postgres",
      endpoint: "https://db.example.com",
      settings: {
        schema: "public"
      },
      secret_ref: "secret/postgres"
    }
  });
  const healthCheck = await handler.handle({
    actor: { id: "owner_1" },
    method: "POST",
    path: `/production-adapter-configs/${PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE}/health-checks`
  });
  const configs = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/production-adapter-configs"
  });
  const readiness = await handler.handle({
    actor: { id: "viewer_1" },
    method: "GET",
    path: "/production-readiness"
  });

  assert.equal(definitions.status, 200);
  assert.equal(definitions.body.definitions.length, 1);
  assert.equal(config.status, 200);
  assert.equal(config.body.config.provider, "postgres");
  assert.equal(healthCheck.status, 201);
  assert.equal(healthCheck.body.health_check.status, PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS);
  assert.equal(configs.body.configs.length, 1);
  assert.equal(readiness.body.readiness.status, PRODUCTION_READINESS_STATUSES.READY);
});

test("production adapter http handler maps validation and auth failures", async () => {
  const handler = createProductionAdapterHandlerFixture();
  const invalid = await handler.handle({
    actor: { id: "owner_1" },
    method: "PUT",
    path: `/production-adapter-configs/${PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE}`,
    body: {
      provider: "postgres",
      settings: {
        password: "raw-secret"
      }
    }
  });
  const forbidden = await handler.handle({
    actor: { id: "viewer_1" },
    method: "PUT",
    path: `/production-adapter-configs/${PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE}`,
    body: {
      provider: "postgres"
    }
  });

  assert.equal(invalid.status, 400);
  assert.equal(forbidden.status, 403);
});

function createProductionAdapterHandlerFixture() {
  const repositories = createInMemoryProductionAdapterRepositories();
  const definition = createProductionAdapterDefinitionRecord({
    type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
    label: "Durable persistence",
    required: true,
    capabilities: ["workflows", "executions"]
  });
  const service = createProductionAdapterService({
    adapterConfigRepository: repositories.adapterConfigs,
    healthCheckRepository: repositories.healthChecks,
    adapterHealthGateway: createDeterministicProductionAdapterHealthGateway(),
    adapterDefinitions: [definition],
    adminActorIds: ["owner_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  return createProductionAdapterHttpHandler({
    productionAdapterService: service
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
