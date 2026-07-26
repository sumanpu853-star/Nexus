import {
  PROJECT_PERMISSIONS,
  assertProjectPermission,
  assertWorkflowBelongsToProject
} from "../domain/securityPolicy.js";
import {
  assertCredentialBelongsToProject
} from "../domain/credentialPolicy.js";
import {
  INTEGRATION_CONNECTION_STATUSES,
  INTEGRATION_INVOCATION_STATUSES,
  IntegrationPolicyValidationError,
  assertCredentialRequirementSatisfied,
  assertIntegrationActionAllowed,
  assertIntegrationConnectionBelongsToProject,
  createIntegrationConnectionRecord,
  createIntegrationInvocationRecord,
  createScheduleTriggerRecord,
  createWebhookEndpointRecord,
  findIntegrationDefinition,
  getBuiltInIntegrationDefinitions
} from "../domain/integrationPolicy.js";

export function createIntegrationService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  credentialRepository,
  connectionRepository,
  invocationRepository,
  webhookRepository,
  scheduleRepository,
  integrationGateway,
  integrationDefinitions = getBuiltInIntegrationDefinitions(),
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById"]);
  assertRepository(credentialRepository, "credentialRepository", ["findById"]);
  assertRepository(connectionRepository, "connectionRepository", [
    "findById",
    "findByProjectId",
    "save"
  ]);
  assertRepository(invocationRepository, "invocationRepository", [
    "findByConnectionId",
    "save"
  ]);
  assertRepository(webhookRepository, "webhookRepository", ["findByProjectId", "save"]);
  assertRepository(scheduleRepository, "scheduleRepository", ["findByProjectId", "save"]);
  assertRepository(integrationGateway, "integrationGateway", ["invoke"]);

  return Object.freeze({
    async listIntegrationDefinitions({
      actor,
      project_id
    } = {}) {
      await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_INTEGRATIONS
      });

      return integrationDefinitions.map((definition) => deepFreeze(deepClone(definition)));
    },

    async createConnection({
      actor,
      project_id,
      integration_type,
      name,
      credential_id = null,
      settings = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS
      });
      const definition = requireIntegrationDefinition({
        integration_type,
        integrationDefinitions
      });

      assertCredentialRequirementSatisfied({
        definition,
        credential_id
      });

      if (credential_id) {
        await requireProjectCredential({
          credentialRepository,
          credential_id,
          project_id: project.id
        });
      }

      const timestamp = nowIso(clock);
      const connection = createIntegrationConnectionRecord({
        id: nextId(idGenerator, "integration_connection"),
        project_id: project.id,
        owner_id: actorId,
        integration_type: definition.type,
        name,
        credential_id,
        settings,
        created_at: timestamp,
        updated_at: timestamp
      });

      return connectionRepository.save(connection);
    },

    async listConnections({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_INTEGRATIONS
      });

      return connectionRepository.findByProjectId(project.id);
    },

    async invokeIntegration({
      actor,
      project_id,
      connection_id,
      action,
      input = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.RUN_INTEGRATIONS
      });
      const connection = await requireProjectConnection({
        connectionRepository,
        connection_id,
        project_id: project.id
      });

      if (connection.status !== INTEGRATION_CONNECTION_STATUSES.ACTIVE) {
        throw new IntegrationPolicyValidationError(
          "Integration connection is disabled.",
          {
            code: "integration_connection_disabled",
            details: { connection_id: connection.id }
          }
        );
      }

      const definition = requireIntegrationDefinition({
        integration_type: connection.integration_type,
        integrationDefinitions
      });
      const normalizedAction = assertIntegrationActionAllowed({
        definition,
        action
      });
      const startedAt = nowIso(clock);

      try {
        const output = await integrationGateway.invoke({
          definition,
          connection,
          action: normalizedAction,
          input,
          context: {
            actor_id: actorId,
            project_id: project.id,
            connection_id: connection.id
          }
        });
        const invocation = createIntegrationInvocationRecord({
          id: nextId(idGenerator, "integration_invocation"),
          project_id: project.id,
          connection_id: connection.id,
          integration_type: connection.integration_type,
          action: normalizedAction,
          input,
          output,
          status: INTEGRATION_INVOCATION_STATUSES.SUCCESS,
          started_at: startedAt,
          finished_at: nowIso(clock),
          duration_ms: 0
        });

        return invocationRepository.save(invocation);
      } catch (error) {
        const invocation = createIntegrationInvocationRecord({
          id: nextId(idGenerator, "integration_invocation"),
          project_id: project.id,
          connection_id: connection.id,
          integration_type: connection.integration_type,
          action: normalizedAction,
          input,
          status: INTEGRATION_INVOCATION_STATUSES.FAILED,
          error: {
            code: error.code ?? "integration_invocation_failed",
            message: error.message
          },
          started_at: startedAt,
          finished_at: nowIso(clock),
          duration_ms: 0
        });

        await invocationRepository.save(invocation);
        throw error;
      }
    },

    async listConnectionInvocations({
      actor,
      project_id,
      connection_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_INTEGRATIONS
      });
      const connection = await requireProjectConnection({
        connectionRepository,
        connection_id,
        project_id: project.id
      });

      return invocationRepository.findByConnectionId(connection.id);
    },

    async registerWebhook({
      actor,
      project_id,
      workflow_id,
      connection_id = null,
      path,
      secret_ref = null,
      is_active = true
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS
      });

      await requireProjectWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      if (connection_id) {
        await requireProjectConnection({
          connectionRepository,
          connection_id,
          project_id: project.id
        });
      }

      const timestamp = nowIso(clock);
      const webhook = createWebhookEndpointRecord({
        id: nextId(idGenerator, "webhook_endpoint"),
        project_id: project.id,
        workflow_id,
        connection_id,
        path,
        secret_ref,
        is_active,
        created_at: timestamp,
        updated_at: timestamp
      });

      return webhookRepository.save(webhook);
    },

    async listWebhooks({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_INTEGRATIONS
      });

      return webhookRepository.findByProjectId(project.id);
    },

    async registerSchedule({
      actor,
      project_id,
      workflow_id,
      cron,
      timezone = "UTC",
      is_active = true
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_INTEGRATIONS
      });

      await requireProjectWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      const timestamp = nowIso(clock);
      const schedule = createScheduleTriggerRecord({
        id: nextId(idGenerator, "schedule_trigger"),
        project_id: project.id,
        workflow_id,
        cron,
        timezone,
        is_active,
        created_at: timestamp,
        updated_at: timestamp
      });

      return scheduleRepository.save(schedule);
    },

    async listSchedules({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_INTEGRATIONS
      });

      return scheduleRepository.findByProjectId(project.id);
    }
  });
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

async function requireProjectWorkflow({
  workflowRepository,
  workflow_id,
  project_id
}) {
  if (typeof workflow_id !== "string" || workflow_id.trim() === "") {
    throw new TypeError("Workflow id must be a non-empty string.");
  }

  return assertWorkflowBelongsToProject({
    workflow: await workflowRepository.findById(workflow_id.trim()),
    project_id
  });
}

async function requireProjectConnection({
  connectionRepository,
  connection_id,
  project_id
}) {
  if (typeof connection_id !== "string" || connection_id.trim() === "") {
    throw new TypeError("Integration connection id must be a non-empty string.");
  }

  return assertIntegrationConnectionBelongsToProject({
    connection: await connectionRepository.findById(connection_id.trim()),
    project_id
  });
}

async function requireProjectCredential({
  credentialRepository,
  credential_id,
  project_id
}) {
  if (typeof credential_id !== "string" || credential_id.trim() === "") {
    throw new TypeError("Credential id must be a non-empty string.");
  }

  return assertCredentialBelongsToProject({
    credential: await credentialRepository.findById(credential_id.trim()),
    project_id
  });
}

function requireIntegrationDefinition({
  integration_type,
  integrationDefinitions
}) {
  const definition = findIntegrationDefinition({
    type: integration_type,
    definitions: integrationDefinitions
  });

  if (!definition) {
    throw new TypeError(`Integration type "${integration_type}" is not supported.`);
  }

  return definition;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Integration operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createIntegrationService requires ${name}.${method}().`);
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

  throw new TypeError("createIntegrationService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
