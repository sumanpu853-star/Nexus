export function createInMemoryIntegrationRepositories(initialState = {}) {
  const connectionsById = new Map();
  const connectionsByProjectId = new Map();
  const invocationsByConnectionId = new Map();
  const webhooksByProjectId = new Map();
  const schedulesByProjectId = new Map();

  for (const connection of initialState.connections ?? []) {
    saveConnection(connection);
  }

  for (const invocation of initialState.invocations ?? []) {
    saveInvocation(invocation);
  }

  for (const webhook of initialState.webhooks ?? []) {
    saveWebhook(webhook);
  }

  for (const schedule of initialState.schedules ?? []) {
    saveSchedule(schedule);
  }

  return Object.freeze({
    connections: Object.freeze({
      async findById(id) {
        return cloneOrNull(connectionsById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(connectionsByProjectId.get(projectId) ?? []);
      },

      async save(connection) {
        saveConnection(connection);

        return cloneOrNull(connection);
      }
    }),

    invocations: Object.freeze({
      async findByConnectionId(connectionId) {
        return cloneArray(invocationsByConnectionId.get(connectionId) ?? []);
      },

      async save(invocation) {
        saveInvocation(invocation);

        return cloneOrNull(invocation);
      }
    }),

    webhooks: Object.freeze({
      async findByProjectId(projectId) {
        return cloneArray(webhooksByProjectId.get(projectId) ?? []);
      },

      async save(webhook) {
        saveWebhook(webhook);

        return cloneOrNull(webhook);
      }
    }),

    schedules: Object.freeze({
      async findByProjectId(projectId) {
        return cloneArray(schedulesByProjectId.get(projectId) ?? []);
      },

      async save(schedule) {
        saveSchedule(schedule);

        return cloneOrNull(schedule);
      }
    })
  });

  function saveConnection(connection) {
    const existing = connectionsById.get(connection.id);

    if (existing && existing.project_id !== connection.project_id) {
      removeFromIndex({
        index: connectionsByProjectId,
        key: existing.project_id,
        id: connection.id
      });
    }

    connectionsById.set(connection.id, clone(connection));
    upsertInIndex({
      index: connectionsByProjectId,
      key: connection.project_id,
      value: connection
    });
  }

  function saveInvocation(invocation) {
    upsertInIndex({
      index: invocationsByConnectionId,
      key: invocation.connection_id,
      value: invocation
    });
  }

  function saveWebhook(webhook) {
    upsertInIndex({
      index: webhooksByProjectId,
      key: webhook.project_id,
      value: webhook
    });
  }

  function saveSchedule(schedule) {
    upsertInIndex({
      index: schedulesByProjectId,
      key: schedule.project_id,
      value: schedule
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
