export function createInMemoryAgentRepositories(initialState = {}) {
  const agentsById = new Map();
  const agentsByProjectId = new Map();
  const promptVersionsByAgentId = new Map();
  const agentRunsByAgentId = new Map();
  const memoriesByIdentity = new Map();

  for (const agent of initialState.agents ?? []) {
    saveAgent(agent);
  }

  for (const promptVersion of initialState.promptVersions ?? []) {
    savePromptVersion(promptVersion);
  }

  for (const run of initialState.runs ?? []) {
    saveAgentRun(run);
  }

  for (const memory of initialState.memories ?? []) {
    saveAgentMemory(memory);
  }

  return Object.freeze({
    agents: Object.freeze({
      async findById(id) {
        return cloneOrNull(agentsById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(agentsByProjectId.get(projectId) ?? []);
      },

      async save(agent) {
        saveAgent(agent);

        return cloneOrNull(agent);
      }
    }),

    promptVersions: Object.freeze({
      async findByAgentId(agentId) {
        return cloneArray(promptVersionsByAgentId.get(agentId) ?? []);
      },

      async save(promptVersion) {
        savePromptVersion(promptVersion);

        return cloneOrNull(promptVersion);
      }
    }),

    agentRuns: Object.freeze({
      async findByAgentId(agentId) {
        return cloneArray(agentRunsByAgentId.get(agentId) ?? []);
      },

      async save(run) {
        saveAgentRun(run);

        return cloneOrNull(run);
      }
    }),

    agentMemories: Object.freeze({
      async findByIdentity({
        project_id,
        agent_id,
        scope,
        key
      } = {}) {
        return cloneOrNull(memoriesByIdentity.get(createMemoryIdentity({
          project_id,
          agent_id,
          scope,
          key
        })));
      },

      async save(memory) {
        saveAgentMemory(memory);

        return cloneOrNull(memory);
      }
    })
  });

  function saveAgent(agent) {
    const existing = agentsById.get(agent.id);

    if (existing && existing.project_id !== agent.project_id) {
      removeFromIndex({
        index: agentsByProjectId,
        key: existing.project_id,
        id: agent.id
      });
    }

    agentsById.set(agent.id, clone(agent));
    upsertInIndex({
      index: agentsByProjectId,
      key: agent.project_id,
      value: agent
    });
  }

  function savePromptVersion(promptVersion) {
    upsertInIndex({
      index: promptVersionsByAgentId,
      key: promptVersion.agent_id,
      value: promptVersion
    });
  }

  function saveAgentRun(run) {
    upsertInIndex({
      index: agentRunsByAgentId,
      key: run.agent_id,
      value: run
    });
  }

  function saveAgentMemory(memory) {
    memoriesByIdentity.set(
      createMemoryIdentity(memory),
      clone(memory)
    );
  }
}

function createMemoryIdentity({
  project_id,
  agent_id,
  scope,
  key
}) {
  return [project_id, agent_id, scope, key].join(":");
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
