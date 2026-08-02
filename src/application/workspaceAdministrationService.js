import {
  createWorkspaceMembershipRecord,
  createWorkspaceProjectLinkRecord,
  createWorkspaceRecord,
  assertWorkspacePermission,
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLES
} from "../domain/workspacePolicy.js";

export function createWorkspaceAdministrationService({
  workspaceRepository,
  workspaceMembershipRepository,
  workspaceProjectLinkRepository,
  projectRepository,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(workspaceRepository, "workspaceRepository", [
    "findById",
    "save"
  ]);
  assertRepository(workspaceMembershipRepository, "workspaceMembershipRepository", [
    "findByWorkspaceId",
    "save"
  ]);
  assertRepository(workspaceProjectLinkRepository, "workspaceProjectLinkRepository", [
    "findByWorkspaceId",
    "findByProjectId",
    "save"
  ]);
  assertRepository(projectRepository, "projectRepository", ["findById"]);

  return Object.freeze({
    async createWorkspace({
      actor,
      name
    } = {}) {
      const actorId = resolveActorId(actor);
      const timestamp = nowIso(clock);
      const workspace = createWorkspaceRecord({
        id: nextId(idGenerator, "workspace"),
        name,
        owner_id: actorId,
        created_at: timestamp,
        updated_at: timestamp
      });
      const membership = createWorkspaceMembershipRecord({
        workspace_id: workspace.id,
        user_id: actorId,
        role: WORKSPACE_ROLES.OWNER,
        created_at: timestamp
      });

      await workspaceRepository.save(workspace);
      await workspaceMembershipRepository.save(membership);

      return Object.freeze({ workspace, membership });
    },

    async addWorkspaceMember({
      actor,
      workspace_id,
      user_id,
      role
    } = {}) {
      const { workspace } = await authorizeWorkspaceAction({
        actor,
        workspaceRepository,
        workspaceMembershipRepository,
        workspace_id,
        permission: WORKSPACE_PERMISSIONS.MANAGE_MEMBERS
      });
      const membership = createWorkspaceMembershipRecord({
        workspace_id: workspace.id,
        user_id,
        role,
        created_at: nowIso(clock)
      });

      return workspaceMembershipRepository.save(membership);
    },

    async linkProjectToWorkspace({
      actor,
      workspace_id,
      project_id
    } = {}) {
      const { actorId, workspace } = await authorizeWorkspaceAction({
        actor,
        workspaceRepository,
        workspaceMembershipRepository,
        workspace_id,
        permission: WORKSPACE_PERMISSIONS.MANAGE_PROJECTS
      });
      const project = await requireProject(projectRepository, project_id);
      const existingLink = await workspaceProjectLinkRepository.findByProjectId(project.id);

      if (existingLink && existingLink.workspace_id !== workspace.id) {
        throw new TypeError("Project is already linked to another workspace.");
      }

      const link = createWorkspaceProjectLinkRecord({
        workspace_id: workspace.id,
        project_id: project.id,
        linked_by: actorId,
        created_at: nowIso(clock)
      });

      return workspaceProjectLinkRepository.save(link);
    },

    async listWorkspaceProjects({
      actor,
      workspace_id
    } = {}) {
      const { workspace } = await authorizeWorkspaceAction({
        actor,
        workspaceRepository,
        workspaceMembershipRepository,
        workspace_id,
        permission: WORKSPACE_PERMISSIONS.READ_WORKSPACE
      });
      const links = await workspaceProjectLinkRepository.findByWorkspaceId(workspace.id);
      const projects = [];

      for (const link of links) {
        const project = await projectRepository.findById(link.project_id);

        if (project) {
          projects.push(project);
        }
      }

      return Object.freeze(projects);
    },

    async listWorkspaceMembers({
      actor,
      workspace_id
    } = {}) {
      const { workspace } = await authorizeWorkspaceAction({
        actor,
        workspaceRepository,
        workspaceMembershipRepository,
        workspace_id,
        permission: WORKSPACE_PERMISSIONS.READ_WORKSPACE
      });

      return workspaceMembershipRepository.findByWorkspaceId(workspace.id);
    }
  });
}

async function authorizeWorkspaceAction({
  actor,
  workspaceRepository,
  workspaceMembershipRepository,
  workspace_id,
  permission
}) {
  const actorId = resolveActorId(actor);
  const workspace = await requireWorkspace(workspaceRepository, workspace_id);
  const memberships = await workspaceMembershipRepository.findByWorkspaceId(workspace.id);

  assertWorkspacePermission({
    actor_id: actorId,
    workspace_id: workspace.id,
    memberships,
    permission
  });

  return { actorId, workspace, memberships };
}

async function requireWorkspace(workspaceRepository, workspaceId) {
  const normalizedWorkspaceId = normalizeRequiredString(workspaceId, "Workspace id");
  const workspace = await workspaceRepository.findById(normalizedWorkspaceId);

  if (!workspace) {
    throw new TypeError("Workspace was not found.");
  }

  return workspace;
}

async function requireProject(projectRepository, projectId) {
  const normalizedProjectId = normalizeRequiredString(projectId, "Project id");
  const project = await projectRepository.findById(normalizedProjectId);

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Workspace operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(
        `createWorkspaceAdministrationService requires ${name}.${method}().`
      );
    }
  }
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createWorkspaceAdministrationService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
