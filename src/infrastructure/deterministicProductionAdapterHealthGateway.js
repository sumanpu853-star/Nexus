import {
  PRODUCTION_ADAPTER_HEALTH_STATUSES
} from "../domain/productionAdapterPolicy.js";

export function createDeterministicProductionAdapterHealthGateway({
  overrides = {}
} = {}) {
  const overrideMap = new Map(Object.entries(overrides));

  return Object.freeze({
    async check({
      definition,
      config
    } = {}) {
      const adapterType = normalizeRequiredString(
        definition?.type ?? config?.adapter_type,
        "Production adapter type"
      );
      const provider = normalizeRequiredString(
        config?.provider,
        "Production adapter provider"
      );
      const override = overrideMap.get(adapterType);
      const result = typeof override === "function"
        ? await override({ definition, config })
        : override;

      return normalizeHealthResult(
        result ?? {
          status: PRODUCTION_ADAPTER_HEALTH_STATUSES.PASS,
          latency_ms: stableLatency(`${adapterType}:${provider}`),
          message: `${provider} configured`,
          details: {
            adapter_type: adapterType,
            provider,
            deterministic: true
          }
        }
      );
    }
  });
}

function normalizeHealthResult(result) {
  const normalized = normalizePlainObject(result, "Production adapter health result");
  const status = normalized.status;

  if (!Object.values(PRODUCTION_ADAPTER_HEALTH_STATUSES).includes(status)) {
    throw new TypeError("Production adapter health status is not supported.");
  }

  return Object.freeze({
    status,
    latency_ms: normalizeNullableNonNegativeInteger(
      normalized.latency_ms ?? null,
      "Production adapter health latency_ms"
    ),
    message: normalizeOptionalString(
      normalized.message ?? "",
      "Production adapter health message"
    ),
    details: normalizePlainObject(
      normalized.details ?? {},
      "Production adapter health details"
    )
  });
}

function stableLatency(value) {
  let hash = 2166136261;

  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return 5 + ((hash >>> 0) % 45);
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeNullableNonNegativeInteger(value, field) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer.`);
  }

  return value;
}
