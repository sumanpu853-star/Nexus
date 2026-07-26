import {
  PROJECT_PERMISSIONS,
  PROJECT_ROLES,
  assertProjectPermission,
  assertWorkflowBelongsToProject,
  createProject,
  createProjectMembership,
  createWorkflowRecord
} from "../domain/securityPolicy.js";
import { assertWorkflowNodesSafe } from "../domain/executionSafetyPolicy.js";

export function createProjectWorkflowSecurityService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  idGenerator,
  runnerCapabilities = {},
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById", "save"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId", "save"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById", "findByProjectId", "save"]);

  return Object.freeze({
    async createProjectForUser({ actor, name } = {}) {
      const actorId = resolveActorId(actor);
      const timestamp = nowIso(clock);
      const project = createProject({
        id: nextId(idGenerator, "project"),
        name,
        owner_id: actorId,
        created_at: timestamp,
        updated_at: timestamp
      });
      const membership = createProjectMembership({
        project_id: project.id,
        user_id: actorId,
        role: PROJECT_ROLES.OWNER,
        created_at: timestamp
      });

      await projectRepository.save(project);
      await membershipRepository.save(membership);

      return { project, membership };
    },

    async addProjectMember({ actor, project_id, user_id, role } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertProjectPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships,
        permission: PROJECT_PERMISSIONS.MANAGE_MEMBERS
      });

      const membership = createProjectMembership({
        project_id: project.id,
        user_id,
        role,
        created_at: nowIso(clock)
      });

      return membershipRepository.save(membership);
    },

    async createWorkflow({
      actor,
      project_id,
      name,
      description = "",
      nodes = [],
      edges = [],
      settings = {}
    } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertProjectPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships,
        permission: PROJECT_PERMISSIONS.CREATE_WORKFLOW
      });
      assertWorkflowNodesSafe({
        nodes,
        runnerCapabilities
      });

      const timestamp = nowIso(clock);
      const workflow = createWorkflowRecord({
        id: nextId(idGenerator, "workflow"),
        name,
        description,
        owner_id: actorId,
        project_id: project.id,
        nodes,
        edges,
        settings,
        created_at: timestamp,
        updated_at: timestamp
      });

      return workflowRepository.save(workflow);
    },

    async getWorkflow({ actor, project_id, workflow_id } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertProjectPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });

      const workflow = await workflowRepository.findById(workflow_id);

      return assertWorkflowBelongsToProject({ workflow, project_id: project.id });
    },

    async listProjectWorkflows({ actor, project_id } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertProjectPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });

      return workflowRepository.findByProjectId(project.id);
    }
  });
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Project workflow operations require an authenticated actor.");
  }

  return actor.id.trim();
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

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createProjectWorkflowSecurityService requires ${name}.${method}().`);
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

  throw new TypeError("createProjectWorkflowSecurityService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
