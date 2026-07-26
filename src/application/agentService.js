import {
  PROJECT_PERMISSIONS,
  assertProjectPermission
} from "../domain/securityPolicy.js";
import {
  AGENT_MEMORY_SCOPES,
  AGENT_MESSAGE_ROLES,
  AGENT_RUN_STATUSES,
  AGENT_TOOL_CALL_STATUSES,
  AgentPolicyValidationError,
  appendAgentMemoryMessages,
  assertAgentBelongsToProject,
  assertAgentToolAllowed,
  createAgentMemoryMessage,
  createAgentMemoryRecord,
  createAgentPromptVersionRecord,
  createAgentRecord,
  createAgentRunRecord,
  createAgentToolCallRecord
} from "../domain/agentPolicy.js";

export function createAgentService({
  projectRepository,
  membershipRepository,
  agentRepository,
  promptVersionRepository,
  agentRunRepository,
  agentMemoryRepository,
  modelProvider,
  toolRegistry,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(agentRepository, "agentRepository", ["findById", "findByProjectId", "save"]);
  assertRepository(promptVersionRepository, "promptVersionRepository", [
    "findByAgentId",
    "save"
  ]);
  assertRepository(agentRunRepository, "agentRunRepository", ["findByAgentId", "save"]);
  assertRepository(agentMemoryRepository, "agentMemoryRepository", [
    "findByIdentity",
    "save"
  ]);
  assertRepository(modelProvider, "modelProvider", ["generateResponse"]);
  assertRepository(toolRegistry, "toolRegistry", ["invokeTool"]);

  return Object.freeze({
    async createAgent({
      actor,
      project_id,
      name,
      description = "",
      instructions,
      model = {},
      memory = {},
      tools = []
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_AGENTS
      });
      const timestamp = nowIso(clock);
      const agent = createAgentRecord({
        id: nextId(idGenerator, "agent"),
        project_id: project.id,
        owner_id: actorId,
        name,
        description,
        instructions,
        model,
        memory,
        tools,
        prompt_version: 1,
        created_at: timestamp,
        updated_at: timestamp
      });
      const promptVersion = createPromptVersion({
        agent,
        actorId,
        idGenerator,
        timestamp
      });

      await agentRepository.save(agent);
      await promptVersionRepository.save(promptVersion);

      return Object.freeze({ agent, prompt_version: promptVersion });
    },

    async listAgents({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_AGENTS
      });

      return agentRepository.findByProjectId(project.id);
    },

    async getAgent({
      actor,
      project_id,
      agent_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_AGENTS
      });

      return requireAgent({
        agentRepository,
        agent_id,
        project_id: project.id
      });
    },

    async updateAgentPrompt({
      actor,
      project_id,
      agent_id,
      instructions,
      model,
      memory,
      tools
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_AGENTS
      });
      const existing = await requireAgent({
        agentRepository,
        agent_id,
        project_id: project.id
      });
      const timestamp = nowIso(clock);
      const agent = createAgentRecord({
        ...existing,
        instructions: instructions ?? existing.instructions,
        model: model ?? existing.model,
        memory: memory ?? existing.memory,
        tools: tools ?? existing.tools,
        prompt_version: existing.prompt_version + 1,
        updated_at: timestamp
      });
      const promptVersion = createPromptVersion({
        agent,
        actorId,
        idGenerator,
        timestamp
      });

      await agentRepository.save(agent);
      await promptVersionRepository.save(promptVersion);

      return Object.freeze({ agent, prompt_version: promptVersion });
    },

    async listAgentPromptVersions({
      actor,
      project_id,
      agent_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_AGENTS
      });
      const agent = await requireAgent({
        agentRepository,
        agent_id,
        project_id: project.id
      });

      return promptVersionRepository.findByAgentId(agent.id);
    },

    async runAgent({
      actor,
      project_id,
      agent_id,
      input = {},
      session_id = "default"
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_AGENTS
      });
      const agent = await requireAgent({
        agentRepository,
        agent_id,
        project_id: project.id
      });
      const timestamp = nowIso(clock);
      const runId = nextId(idGenerator, "agent_run");
      const memory = await resolveAgentMemory({
        agent,
        actorId,
        session_id,
        project_id: project.id,
        agentMemoryRepository,
        idGenerator,
        timestamp
      });
      const modelResponse = normalizeModelResponse(
        await modelProvider.generateResponse({
          agent,
          instructions: agent.instructions,
          model: agent.model,
          input,
          memory: memory?.messages ?? [],
          tools: agent.tools.filter((tool) => tool.enabled)
        })
      );
      const toolCalls = await runRequestedToolCalls({
        requestedToolCalls: modelResponse.requested_tool_calls,
        runId,
        agent,
        project,
        actorId,
        toolRegistry,
        idGenerator,
        clock
      });
      const failedToolCall = toolCalls.find((toolCall) =>
        [
          AGENT_TOOL_CALL_STATUSES.BLOCKED,
          AGENT_TOOL_CALL_STATUSES.FAILED
        ].includes(toolCall.status)
      );
      const status = failedToolCall
        ? AGENT_RUN_STATUSES.FAILED
        : AGENT_RUN_STATUSES.COMPLETED;
      const output = {
        message: modelResponse.message,
        tool_results: toolCalls.map((toolCall) => ({
          tool_call_id: toolCall.id,
          tool_name: toolCall.tool_name,
          status: toolCall.status,
          output: toolCall.output,
          error: toolCall.error
        }))
      };
      const run = createAgentRunRecord({
        id: runId,
        agent_id: agent.id,
        project_id: project.id,
        started_by: actorId,
        status,
        input,
        output,
        model: agent.model,
        memory: agent.memory,
        tool_calls: toolCalls,
        usage: modelResponse.usage,
        error: failedToolCall?.error ?? null,
        started_at: timestamp,
        finished_at: nowIso(clock),
        duration_ms: 0
      });

      await agentRunRepository.save(run);

      if (memory && status === AGENT_RUN_STATUSES.COMPLETED) {
        await agentMemoryRepository.save(
          appendAgentMemoryMessages({
            memory,
            updated_at: nowIso(clock),
            messages: [
              createAgentMemoryMessage({
                role: AGENT_MESSAGE_ROLES.USER,
                content: extractPrompt(input),
                timestamp,
                metadata: { run_id: run.id }
              }),
              createAgentMemoryMessage({
                role: AGENT_MESSAGE_ROLES.ASSISTANT,
                content: modelResponse.message,
                timestamp: nowIso(clock),
                metadata: { run_id: run.id }
              })
            ]
          })
        );
      }

      return run;
    },

    async listAgentRuns({
      actor,
      project_id,
      agent_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_AGENTS
      });
      const agent = await requireAgent({
        agentRepository,
        agent_id,
        project_id: project.id
      });

      return agentRunRepository.findByAgentId(agent.id);
    }
  });
}

function createPromptVersion({
  agent,
  actorId,
  idGenerator,
  timestamp
}) {
  return createAgentPromptVersionRecord({
    id: nextId(idGenerator, "agent_prompt_version"),
    agent_id: agent.id,
    project_id: agent.project_id,
    version: agent.prompt_version,
    instructions: agent.instructions,
    model: agent.model,
    memory: agent.memory,
    tools: agent.tools,
    created_by: actorId,
    created_at: timestamp
  });
}

async function runRequestedToolCalls({
  requestedToolCalls,
  runId,
  agent,
  project,
  actorId,
  toolRegistry,
  idGenerator,
  clock
}) {
  const toolCalls = [];

  for (const requested of requestedToolCalls) {
    const startedAt = nowIso(clock);
    const toolCallId = nextId(idGenerator, "agent_tool_call");
    const toolName = normalizeRequiredString(requested.tool_name, "Requested tool name");
    const input = normalizePlainObject(requested.input ?? {}, "Requested tool input");

    try {
      assertAgentToolAllowed({
        agent,
        tool_name: toolName
      });
      const output = normalizePlainObject(
        await toolRegistry.invokeTool({
          tool_name: toolName,
          input,
          context: {
            actor_id: actorId,
            agent_id: agent.id,
            project_id: project.id,
            run_id: runId
          }
        }),
        "Agent tool output"
      );

      toolCalls.push(createAgentToolCallRecord({
        id: toolCallId,
        run_id: runId,
        agent_id: agent.id,
        project_id: project.id,
        tool_name: toolName,
        status: AGENT_TOOL_CALL_STATUSES.COMPLETED,
        input,
        output,
        started_at: startedAt,
        finished_at: nowIso(clock),
        duration_ms: 0
      }));
    } catch (error) {
      toolCalls.push(createAgentToolCallRecord({
        id: toolCallId,
        run_id: runId,
        agent_id: agent.id,
        project_id: project.id,
        tool_name: toolName,
        status: error instanceof AgentPolicyValidationError
          ? AGENT_TOOL_CALL_STATUSES.BLOCKED
          : AGENT_TOOL_CALL_STATUSES.FAILED,
        input,
        error: {
          code: error.code ?? "agent_tool_failed",
          message: error.message
        },
        started_at: startedAt,
        finished_at: nowIso(clock),
        duration_ms: 0
      }));
    }
  }

  return Object.freeze(toolCalls);
}

async function resolveAgentMemory({
  agent,
  actorId,
  session_id,
  project_id,
  agentMemoryRepository,
  idGenerator,
  timestamp
}) {
  if (agent.memory.scope === AGENT_MEMORY_SCOPES.NONE) {
    return null;
  }

  const key = createMemoryIdentity({
    agent,
    actorId,
    session_id
  });
  const existing = await agentMemoryRepository.findByIdentity({
    project_id,
    agent_id: agent.id,
    scope: agent.memory.scope,
    key
  });

  if (existing) {
    return existing;
  }

  return createAgentMemoryRecord({
    id: nextId(idGenerator, "agent_memory"),
    project_id,
    agent_id: agent.id,
    scope: agent.memory.scope,
    key,
    messages: [],
    created_at: timestamp,
    updated_at: timestamp
  });
}

function createMemoryIdentity({
  agent,
  actorId,
  session_id
}) {
  const configuredKey = agent.memory.key || "default";

  switch (agent.memory.scope) {
    case AGENT_MEMORY_SCOPES.SESSION:
      return `session:${session_id || "default"}:${configuredKey}`;
    case AGENT_MEMORY_SCOPES.USER:
      return `user:${actorId}:${configuredKey}`;
    case AGENT_MEMORY_SCOPES.SEMANTIC:
      return `semantic:${configuredKey}`;
    default:
      return configuredKey;
  }
}

async function authorizeProjectAction({
  actor,
  projectRepository,
  membershipRepository,
  project_id,
  permission
}) {
  const actorId = resolveActorId(actor);
  const project = await requireProject(projectRepository, project_id);
  const memberships = await membershipRepository.findByProjectId(project.id);

  assertProjectPermission({
    actor_id: actorId,
    project_id: project.id,
    memberships,
    permission
  });

  return { actorId, project };
}

async function requireProject(projectRepository, projectId) {
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new TypeError("Project id must be a non-empty string.");
  }

  const project = await projectRepository.findById(projectId.trim());

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

async function requireAgent({
  agentRepository,
  agent_id,
  project_id
}) {
  if (typeof agent_id !== "string" || agent_id.trim() === "") {
    throw new TypeError("Agent id must be a non-empty string.");
  }

  return assertAgentBelongsToProject({
    agent: await agentRepository.findById(agent_id.trim()),
    project_id
  });
}

function normalizeModelResponse(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new TypeError("Model provider response must be an object.");
  }

  return Object.freeze({
    message: normalizeRequiredString(response.message, "Model response message"),
    requested_tool_calls: normalizeRequestedToolCalls(
      response.requested_tool_calls ?? []
    ),
    usage: normalizePlainObject(response.usage ?? {}, "Model response usage")
  });
}

function normalizeRequestedToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    throw new TypeError("Model requested_tool_calls must be an array.");
  }

  return Object.freeze(toolCalls.map((toolCall) => {
    if (!toolCall || typeof toolCall !== "object" || Array.isArray(toolCall)) {
      throw new TypeError("Model requested tool calls must be objects.");
    }

    return Object.freeze({
      tool_name: normalizeRequiredString(
        toolCall.tool_name ?? toolCall.name,
        "Requested tool name"
      ),
      input: normalizePlainObject(toolCall.input ?? {}, "Requested tool input")
    });
  }));
}

function extractPrompt(input) {
  if (input && typeof input.prompt === "string" && input.prompt.trim() !== "") {
    return input.prompt.trim();
  }

  return JSON.stringify(input ?? {});
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Agent operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createAgentService requires ${name}.${method}().`);
    }
  }
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createAgentService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}
