import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_ADAPTER_CATEGORIES,
  PRODUCTION_ADAPTER_HEALTH_STATUSES,
  PRODUCTION_ADAPTER_TYPES,
  createProductionAdapterConfigRecord,
  createProductionAdapterHealthCheckRecord
} from "../../src/domain/productionAdapterPolicy.js";
import {
  createInMemoryProductionAdapterRepositories
} from "../../src/infrastructure/inMemoryProductionAdapterRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("in-memory production adapter config repository saves one config per adapter type", async () => {
  const repositories = createInMemoryProductionAdapterRepositories();
  const first = createConfig({
    id: "production_adapter_config_1",
    provider: "postgres"
  });
  const second = createConfig({
    id: "production_adapter_config_2",
    provider: "neon"
  });

  await repositories.adapterConfigs.save(first);
  await repositories.adapterConfigs.save(second);

  const found = await repositories.adapterConfigs.findByAdapterType(
    PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  );
  const all = await repositories.adapterConfigs.findAll();

  found.provider = "mutated";

  assert.equal(found.provider, "mutated");
  assert.equal(
    (
      await repositories.adapterConfigs.findByAdapterType(
        PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
      )
    ).provider,
    "neon"
  );
  assert.equal(all.length, 1);
});

test("in-memory production adapter health repository keeps history by adapter type", async () => {
  const repositories = createInMemoryProductionAdapterRepositories();
  const first = createProductionAdapterHealthCheckRecord({
    id: "production_adapter_health_check_1",
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    status: PRODUCTION_ADAPTER_HEALTH_STATUSES.WARN,
    checked_at: timestamp
  });
  const second = createProductionAdapterHealthCheckRecord({
    id: "production_adapter_health_check_2",
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    status: PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS,
    checked_at: "2026-07-26T01:00:00.000Z"
  });

  await repositories.healthChecks.save(first);
  await repositories.healthChecks.save(second);

  const history = await repositories.healthChecks.findByAdapterType(
    PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  );
  const all = await repositories.healthChecks.findAll();

  history[0].status = PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL;

  assert.deepEqual(
    history.map((healthCheck) => healthCheck.status),
    [
      PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL,
      PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS
    ]
  );
  assert.deepEqual(
    (
      await repositories.healthChecks.findByAdapterType(
        PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
      )
    ).map((healthCheck) => healthCheck.status),
    [
      PRODUCTION_ADAPTER_HEALTH_STATUSES.WARN,
      PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS
    ]
  );
  assert.equal(all.length, 2);
});

function createConfig({
  id,
  provider
}) {
  return createProductionAdapterConfigRecord({
    id,
    adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
    provider,
    created_at: timestamp
  });
}
