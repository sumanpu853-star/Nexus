import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_ADAPTER_CATEGORIES,
  PRODUCTION_ADAPTER_HEALTH_STATUSES,
  PRODUCTION_ADAPTER_TYPES,
  createProductionAdapterConfigRecord,
  createProductionAdapterDefinitionRecord
} from "../../src/domain/productionAdapterPolicy.js";
import {
  createDeterministicProductionAdapterHealthGateway
} from "../../src/infrastructure/deterministicProductionAdapterHealthGateway.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("deterministic production adapter health gateway returns stable passing checks", async () => {
  const gateway = createDeterministicProductionAdapterHealthGateway();
  const first = await gateway.check(createHealthInput());
  const second = await gateway.check(createHealthInput());

  assert.equal(first.status, PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS);
  assert.equal(first.latency_ms, second.latency_ms);
  assert.equal(first.details.deterministic, true);
});

test("deterministic production adapter health gateway supports object and function overrides", async () => {
  const gateway = createDeterministicProductionAdapterHealthGateway({
    overrides: {
      [PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE]: async ({ config }) => ({
        status: PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL,
        latency_ms: 90,
        message: `${config.provider} failed`,
        details: { reason: "timeout" }
      })
    }
  });
  const result = await gateway.check(createHealthInput());

  assert.equal(result.status, PRODUCTION_ADAPTER_HEALTH_STATUSES.FAIL);
  assert.equal(result.message, "postgres failed");
  assert.deepEqual(result.details, { reason: "timeout" });
});

function createHealthInput() {
  return {
    definition: createProductionAdapterDefinitionRecord({
      type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
      category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
      label: "Durable persistence",
      required: true,
      capabilities: ["workflows"]
    }),
    config: createProductionAdapterConfigRecord({
      id: "production_adapter_config_1",
      adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
      category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
      provider: "postgres",
      created_at: timestamp
    })
  };
}
