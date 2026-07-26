import {
  PROJECT_PERMISSIONS,
  assertProjectPermission,
  assertWorkflowBelongsToProject,
  createWorkflowRecord
} from "../domain/securityPolicy.js";
import {
  DEPLOYMENT_STATUSES,
  DeploymentPolicyValidationError,
  assertDeploymentBelongsToProject,
  createDeploymentEnvironmentRecord,
  createDeploymentRecord,
  createDeploymentWebhookUrl,
  normalizeDeploymentEnvironment
} from "../domain/deploymentPolicy.js";

export function createDeploymentService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  environmentRepository,
  deploymentRepository,
  idGenerator,
  webhookBaseUrl = "https://nexus.local",
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById", "save"]);
  assertRepository(environmentRepository, "environmentRepository", [
    "findByProjectId",
    "findByProjectEnvironment",
    "save"
  ]);
  assertRepository(deploymentRepository, "deploymentRepository", [
    "findById",
    "findByProjectId",
    "findActiveByWorkflowEnvironment",
    "save"
  ]);

  return Object.freeze({
    async upsertEnvironment({
      actor,
      project_id,
      environment,
      variables = {}
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS
      });
      const normalizedEnvironment = normalizeDeploymentEnvironment(environment);
      const existing = await environmentRepository.findByProjectEnvironment({
        project_id: project.id,
        environment: normalizedEnvironment
      });
      const timestamp = nowIso(clock);
      const deploymentEnvironment = createDeploymentEnvironmentRecord({
        id: existing?.id ?? nextId(idGenerator, "deployment_environment"),
        project_id: project.id,
        environment: normalizedEnvironment,
        variables,
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp
      });

      return environmentRepository.save(deploymentEnvironment);
    },

    async listEnvironments({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_DEPLOYMENTS
      });

      return environmentRepository.findByProjectId(project.id);
    },

    async publishWorkflow({
      actor,
      project_id,
      workflow_id,
      environment,
      version = null
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS
      });
      const workflow = await requireProjectWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const deploymentEnvironment = await requireDeploymentEnvironment({
        environmentRepository,
        project_id: project.id,
        environment
      });
      const workflowVersion = resolveWorkflowVersion({
        workflow,
        version
      });
      const timestamp = nowIso(clock);
      const previousActive = await deploymentRepository.findActiveByWorkflowEnvironment({
        project_id: project.id,
        workflow_id: workflow.id,
        environment: deploymentEnvironment.environment
      });

      if (previousActive) {
        await deploymentRepository.save(
          createDeploymentRecord({
            ...previousActive,
            status: DEPLOYMENT_STATUSES.DISABLED,
            disabled_at: timestamp
          })
        );
      }

      const deployment = createDeploymentRecord({
        id: nextId(idGenerator, "deployment"),
        project_id: project.id,
        workflow_id: workflow.id,
        workflow_version: workflowVersion,
        environment: deploymentEnvironment.environment,
        status: DEPLOYMENT_STATUSES.ACTIVE,
        webhook_url: createDeploymentWebhookUrl({
          base_url: webhookBaseUrl,
          project_id: project.id,
          environment: deploymentEnvironment.environment,
          workflow_id: workflow.id
        }),
        variable_snapshot: deploymentEnvironment.variables,
        created_by: actorId,
        created_at: timestamp,
        published_at: timestamp
      });
      const updatedWorkflow = createWorkflowRecord({
        ...workflow,
        published_version: workflowVersion,
        published_at: timestamp,
        is_active: true,
        updated_at: timestamp
      });

      await workflowRepository.save(updatedWorkflow);

      return deploymentRepository.save(deployment);
    },

    async listDeployments({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_DEPLOYMENTS
      });

      return deploymentRepository.findByProjectId(project.id);
    },

    async getActiveDeployment({
      actor,
      project_id,
      workflow_id,
      environment
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_DEPLOYMENTS
      });
      const workflow = await requireProjectWorkflow({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const normalizedEnvironment = normalizeDeploymentEnvironment(environment);

      return deploymentRepository.findActiveByWorkflowEnvironment({
        project_id: project.id,
        workflow_id: workflow.id,
        environment: normalizedEnvironment
      });
    },

    async disableDeployment({
      actor,
      project_id,
      deployment_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_DEPLOYMENTS
      });
      const deployment = assertDeploymentBelongsToProject({
        deployment: await requireDeployment(deploymentRepository, deployment_id),
        project_id: project.id
      });
      const disabled = createDeploymentRecord({
        ...deployment,
        status: DEPLOYMENT_STATUSES.DISABLED,
        disabled_at: nowIso(clock)
      });

      return deploymentRepository.save(disabled);
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

async function requireDeploymentEnvironment({
  environmentRepository,
  project_id,
  environment
}) {
  const normalizedEnvironment = normalizeDeploymentEnvironment(environment);
  const deploymentEnvironment = await environmentRepository.findByProjectEnvironment({
    project_id,
    environment: normalizedEnvironment
  });

  if (!deploymentEnvironment) {
    throw new DeploymentPolicyValidationError(
      "Deployment environment must be configured before publishing.",
      {
        code: "deployment_environment_required",
        details: { project_id, environment: normalizedEnvironment }
      }
    );
  }

  return deploymentEnvironment;
}

async function requireDeployment(deploymentRepository, deploymentId) {
  if (typeof deploymentId !== "string" || deploymentId.trim() === "") {
    throw new TypeError("Deployment id must be a non-empty string.");
  }

  const deployment = await deploymentRepository.findById(deploymentId.trim());

  if (!deployment) {
    throw new TypeError("Deployment was not found.");
  }

  return deployment;
}

function resolveWorkflowVersion({
  workflow,
  version
}) {
  if (version === null || version === undefined) {
    return workflow.draft_version;
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new DeploymentPolicyValidationError(
      "Deployment workflow version must be a positive integer.",
      {
        code: "deployment_workflow_version_invalid",
        details: { version }
      }
    );
  }

  if (version > workflow.draft_version) {
    throw new DeploymentPolicyValidationError(
      "Deployment workflow version cannot exceed the workflow draft version.",
      {
        code: "deployment_workflow_version_unavailable",
        details: {
          version,
          draft_version: workflow.draft_version
        }
      }
    );
  }

  return version;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Deployment operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createDeploymentService requires ${name}.${method}().`);
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

  throw new TypeError("createDeploymentService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
