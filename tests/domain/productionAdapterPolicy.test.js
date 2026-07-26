import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_ADAPTER_CATEGORIES,
  PRODUCTION_ADAPTER_HEALTH_STATUSES,
  PRODUCTION_ADAPTER_STATUSES,
  PRODUCTION_ADAPTER_TYPES,
  PRODUCTION_READINESS_STATUSES,
  createProductionAdapterConfigRecord,
  createProductionAdapterDefinitionRecord,
  createProductionAdapterHealthCheckRecord,
  createProductionReadinessReport,
  findProductionAdapterDefinition,
  getBuiltInProductionAdapterDefinitions
} from "../../src/domain/productionAdapterPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("production adapter policy exposes required built-in adapter definitions", () => {
  const definitions = getBuiltInProductionAdapterDefinitions();
  const llmProvider = findProductionAdapterDefinition({
    adapter_type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
    definitions
  });

  assert.equal(definitions.length, 9);
  assert.equal(definitions.every((definition) => definition.required), true);
  assert.equal(llmProvider.category, PRODUCTION_ADAPTER_CATEGORIES.LLM_PROVIDER);
  assert.equal(llmProvider.capabilities.includes("agent_runs"), true);
  assert.equal(Object.isFrozen(definitions[0]), true);
});

test("production adapter config records normalize safe settings and secret refs", () => {
  const config = createProductionAdapterConfigRecord({
    id: "production_adapter_config_1",
    adapter_type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
    category: PRODUCTION_ADAPTER_CATEGORIES.LLM_PROVIDER,
    provider: "openai",
    endpoint: "https://api.example.com",
    settings: {
      default_model: "gpt-5"
    },
    secret_ref: "secret/openai",
    capabilities: ["agent_runs", "tool_calls"],
    created_at: timestamp
  });

  assert.equal(config.endpoint, "https://api.example.com/");
  assert.equal(config.status, PRODUCTION_ADAPTER_STATUSES.CONFIGURED);
  assert.deepEqual(config.capabilities, ["agent_runs", "tool_calls"]);
  assert.throws(
    () =>
      createProductionAdapterConfigRecord({
        id: "production_adapter_config_2",
        adapter_type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
        category: PRODUCTION_ADAPTER_CATEGORIES.LLM_PROVIDER,
        provider: "openai",
        settings: {
          api_key: "raw-secret"
        },
        created_at: timestamp
      }),
    /raw secret values/
  );
});

test("production readiness is blocked until required adapters are configured", () => {
  const definitions = createReadinessDefinitions();
  const report = createProductionReadinessReport({
    definitions,
    configs: [],
    healthChecks: []
  });

  assert.equal(report.status, PRODUCTION_READINESS_STATUSES.BLOCKED);
  assert.deepEqual(report.missing_required, [
    PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
    PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER
  ]);
});

test("production readiness reports ready and degraded required adapter health", () => {
  const definitions = createReadinessDefinitions();
  const configs = definitions.map((definition, index) =>
    createProductionAdapterConfigRecord({
      id: `production_adapter_config_${index + 1}`,
      adapter_type: definition.type,
      category: definition.category,
      provider: `${definition.type}_provider`,
      created_at: timestamp
    })
  );
  const readyReport = createProductionReadinessReport({
    definitions,
    configs,
    healthChecks: configs.map((config, index) =>
      createProductionAdapterHealthCheckRecord({
        id: `production_adapter_health_check_${index + 1}`,
        adapter_type: config.adapter_type,
        status: PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS,
        checked_at: timestamp
      })
    )
  });
  const degradedReport = createProductionReadinessReport({
    definitions,
    configs,
    healthChecks: [
      createProductionAdapterHealthCheckRecord({
        id: "production_adapter_health_check_1",
        adapter_type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
        status: PRODUCTION_ADAPTER_HEALTH_STATUSES.WARN,
        checked_at: timestamp,
        message: "Replica lag is elevated"
      }),
      createProductionAdapterHealthCheckRecord({
        id: "production_adapter_health_check_2",
        adapter_type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
        status: PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS,
        checked_at: timestamp
      })
    ]
  });

  assert.equal(readyReport.status, PRODUCTION_READINESS_STATUSES.READY);
  assert.equal(readyReport.required_configured, 2);
  assert.equal(degradedReport.status, PRODUCTION_READINESS_STATUSES.DEGRADED);
  assert.deepEqual(degradedReport.warning_required, [
    PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE
  ]);
});

function createReadinessDefinitions() {
  return [
    createProductionAdapterDefinitionRecord({
      type: PRODUCTION_ADAPTER_TYPES.DURABLE_PERSISTENCE,
      category: PRODUCTION_ADAPTER_CATEGORIES.PERSISTENCE,
      label: "Durable persistence",
      required: true,
      capabilities: ["workflows"]
    }),
    createProductionAdapterDefinitionRecord({
      type: PRODUCTION_ADAPTER_TYPES.LLM_PROVIDER,
      category: PRODUCTION_ADAPTER_CATEGORIES.LLM_PROVIDER,
      label: "LLM provider",
      required: true,
      capabilities: ["agent_runs"]
    })
  ];
}
