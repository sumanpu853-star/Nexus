export function createInMemoryProductionAdapterRepositories(initialState = {}) {
  const configsById = new Map();
  const configIdByAdapterType = new Map();
  const healthChecksById = new Map();
  const healthChecksByAdapterType = new Map();

  for (const config of initialState.configs ?? []) {
    saveConfig(config);
  }

  for (const healthCheck of initialState.healthChecks ?? []) {
    saveHealthCheck(healthCheck);
  }

  return Object.freeze({
    adapterConfigs: Object.freeze({
      async findByAdapterType(adapterType) {
        const id = configIdByAdapterType.get(adapterType);

        return id ? cloneOrNull(configsById.get(id)) : null;
      },

      async findAll() {
        return cloneArray([...configsById.values()]);
      },

      async save(config) {
        saveConfig(config);

        return cloneOrNull(config);
      }
    }),

    healthChecks: Object.freeze({
      async findByAdapterType(adapterType) {
        return cloneArray(healthChecksByAdapterType.get(adapterType) ?? []);
      },

      async findAll() {
        return cloneArray([...healthChecksById.values()]);
      },

      async save(healthCheck) {
        saveHealthCheck(healthCheck);

        return cloneOrNull(healthCheck);
      }
    })
  });

  function saveConfig(config) {
    const existing = configsById.get(config.id);
    const existingForType = configIdByAdapterType.get(config.adapter_type);

    if (existing) {
      configIdByAdapterType.delete(existing.adapter_type);
    }

    if (existingForType && existingForType !== config.id) {
      configsById.delete(existingForType);
    }

    configsById.set(config.id, clone(config));
    configIdByAdapterType.set(config.adapter_type, config.id);
  }

  function saveHealthCheck(healthCheck) {
    const existing = healthChecksById.get(healthCheck.id);

    if (existing) {
      removeFromIndex({
        index: healthChecksByAdapterType,
        key: existing.adapter_type,
        id: healthCheck.id
      });
    }

    healthChecksById.set(healthCheck.id, clone(healthCheck));
    upsertInIndex({
      index: healthChecksByAdapterType,
      key: healthCheck.adapter_type,
      value: healthCheck
    });
  }
}

function upsertInIndex({
  index,
  key,
  value
}) {
  const values = index.get(key) ?? [];
  const withoutDuplicate = values.filter((entry) => entry.id !== value.id);

  index.set(key, [...withoutDuplicate, clone(value)]);
}

function removeFromIndex({
  index,
  key,
  id
}) {
  const values = index.get(key) ?? [];

  index.set(key, values.filter((entry) => entry.id !== id));
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
