import {
  PROJECT_PERMISSIONS,
  assertProjectPermission,
  assertWorkflowBelongsToProject
} from "../domain/securityPolicy.js";
import {
  WORKFLOW_EXPORT_FORMATS,
  WORKFLOW_SOURCE_CONTROL_DESTINATIONS,
  createWorkflowExportCommitMessage,
  createWorkflowExportFiles,
  createWorkflowSourceControlExportRecord
} from "../domain/workflowSourceControlPolicy.js";

export function createWorkflowSourceControlService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  exportRepository,
  sourceControlGateway,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById"]);
  assertRepository(exportRepository, "exportRepository", [
    "findByWorkflowId",
    "save"
  ]);
  assertRepository(sourceControlGateway, "sourceControlGateway", ["exportFiles"]);

  return Object.freeze({
    async exportWorkflowVersion({
      actor,
      project_id,
      workflow_id,
      destination = {
        type: WORKFLOW_SOURCE_CONTROL_DESTINATIONS.GIT,
        repository: "",
        branch: "main"
      },
      format = WORKFLOW_EXPORT_FORMATS.JSON
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = assertWorkflowBelongsToProject({
        workflow: await workflowRepository.findById(workflow_id),
        project_id: project.id
      });
      const timestamp = nowIso(clock);
      const workflowVersion = workflow.published_version ?? workflow.draft_version;
      const files = createWorkflowExportFiles({
        workflow,
        exported_by: actorId,
        exported_at: timestamp
      });
      const commitMessage = createWorkflowExportCommitMessage({
        workflow,
        version: workflowVersion
      });
      const gatewayResult = await sourceControlGateway.exportFiles({
        destination,
        files,
        message: commitMessage,
        metadata: {
          project_id: project.id,
          workflow_id: workflow.id,
          workflow_version: workflowVersion,
          exported_by: actorId,
          exported_at: timestamp
        }
      });
      const exportRecord = createWorkflowSourceControlExportRecord({
        id: nextId(idGenerator, "workflow_export"),
        project_id: project.id,
        workflow_id: workflow.id,
        workflow_version: workflowVersion,
        destination,
        format,
        files,
        commit_ref: gatewayResult.commit_ref ?? null,
        exported_by: actorId,
        exported_at: timestamp
      });

      return exportRepository.save(exportRecord);
    },

    async listWorkflowExports({
      actor,
      project_id,
      workflow_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });

      assertWorkflowBelongsToProject({
        workflow: await workflowRepository.findById(workflow_id),
        project_id: project.id
      });

      return exportRepository.findByWorkflowId(workflow_id);
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
  const normalizedProjectId = normalizeRequiredString(projectId, "Project id");
  const project = await projectRepository.findById(normalizedProjectId);

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Workflow source-control operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(
        `createWorkflowSourceControlService requires ${name}.${method}().`
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

  throw new TypeError("createWorkflowSourceControlService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
