import {
  PROJECT_PERMISSIONS,
  assertProjectPermission,
  assertWorkflowBelongsToProject,
  createWorkflowRecord
} from "../domain/securityPolicy.js";
import {
  assertWorkflowNodesSafe
} from "../domain/executionSafetyPolicy.js";
import {
  applyWorkflowNodeDefinitionDefaults
} from "../domain/nodeDefinitionPolicy.js";
import {
  applyWorkflowErrorBranchDefaults
} from "../domain/workflowErrorBranchPolicy.js";
import {
  applyWorkflowNodeExecutionPolicyDefaults
} from "../domain/workflowNodeExecutionPolicy.js";
import {
  assertWorkflowGraphValid
} from "../domain/workflowGraphPolicy.js";
import {
  WORKFLOW_COMMENT_STATUSES,
  WORKFLOW_VERSION_SOURCES,
  compareWorkflowVersions as compareWorkflowVersionRecords,
  createWorkflowCollaborationPackage,
  createWorkflowCollaborationTemplateRecord,
  createWorkflowCommentRecord,
  createWorkflowVersionRecord,
  createWorkflowVersionRecordFromWorkflow,
  filterWorkflowComments,
  resolveWorkflowCommentRecord
} from "../domain/workflowCollaborationPolicy.js";

export function createWorkflowCollaborationService({
  projectRepository,
  membershipRepository,
  workflowRepository,
  versionRepository,
  commentRepository,
  templateRepository,
  idGenerator,
  nodeDefinitions,
  runnerCapabilities = {},
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(workflowRepository, "workflowRepository", ["findById", "save"]);
  assertRepository(versionRepository, "versionRepository", [
    "findByWorkflowId",
    "save"
  ]);
  assertRepository(commentRepository, "commentRepository", [
    "findById",
    "findByWorkflowId",
    "save"
  ]);
  assertRepository(templateRepository, "templateRepository", [
    "findByProjectId",
    "save"
  ]);

  return Object.freeze({
    async createWorkflowVersion({
      actor,
      project_id,
      workflow_id,
      change_summary = ""
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.UPDATE_WORKFLOW
      });
      const workflow = await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const existing = await findWorkflowVersion({
        versionRepository,
        workflow_id: workflow.id,
        version: workflow.draft_version
      });

      if (existing) {
        throw new TypeError("Workflow version already exists for this draft.");
      }

      const versionRecord = createWorkflowVersionRecordFromWorkflow({
        id: nextId(idGenerator, "workflow_version"),
        workflow,
        change_summary,
        created_by: actorId,
        created_at: nowIso(clock)
      });

      return versionRepository.save(versionRecord);
    },

    async listWorkflowVersions({
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

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return sortVersions(await versionRepository.findByWorkflowId(workflow_id));
    },

    async compareWorkflowVersions({
      actor,
      project_id,
      workflow_id,
      left_version,
      right_version
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return compareWorkflowVersionRecords({
        left: await requireWorkflowVersion({
          versionRepository,
          workflow_id,
          version: left_version
        }),
        right: await requireWorkflowVersion({
          versionRepository,
          workflow_id,
          version: right_version
        })
      });
    },

    async restoreWorkflowVersion({
      actor,
      project_id,
      workflow_id,
      version,
      change_summary = ""
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.UPDATE_WORKFLOW
      });
      const workflow = await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const targetVersion = await requireWorkflowVersion({
        versionRepository,
        workflow_id: workflow.id,
        version
      });
      const existingVersions = await versionRepository.findByWorkflowId(workflow.id);
      const nextVersion = Math.max(
        workflow.draft_version,
        ...existingVersions.map((entry) => entry.version)
      ) + 1;
      const normalizedContent = normalizeWorkflowContent({
        nodes: targetVersion.nodes,
        edges: targetVersion.edges,
        nodeDefinitions,
        runnerCapabilities
      });
      const timestamp = nowIso(clock);
      const restoredWorkflow = createWorkflowRecord({
        ...workflow,
        name: targetVersion.name,
        description: targetVersion.description,
        nodes: normalizedContent.nodes,
        edges: normalizedContent.edges,
        settings: targetVersion.settings,
        draft_version: nextVersion,
        updated_at: timestamp
      });
      const savedWorkflow = await workflowRepository.save(restoredWorkflow);
      const restoreVersion = createWorkflowVersionRecordFromWorkflow({
        id: nextId(idGenerator, "workflow_version"),
        workflow: savedWorkflow,
        source: WORKFLOW_VERSION_SOURCES.RESTORE,
        restored_from_version: targetVersion.version,
        change_summary: change_summary ||
          `Restored workflow version ${targetVersion.version}.`,
        created_by: actorId,
        created_at: timestamp
      });

      return Object.freeze({
        workflow: savedWorkflow,
        version: await versionRepository.save(restoreVersion)
      });
    },

    async addWorkflowComment({
      actor,
      project_id,
      workflow_id,
      version = null,
      node_id = null,
      body,
      metadata = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const targetVersion = version === null
        ? null
        : await requireWorkflowVersion({
          versionRepository,
          workflow_id: workflow.id,
          version
        });

      assertNodeReference({
        node_id,
        nodes: targetVersion ? targetVersion.nodes : workflow.nodes
      });

      const comment = createWorkflowCommentRecord({
        id: nextId(idGenerator, "workflow_comment"),
        project_id: project.id,
        workflow_id: workflow.id,
        version,
        node_id,
        body,
        author_id: actorId,
        metadata,
        created_at: nowIso(clock)
      });

      return commentRepository.save(comment);
    },

    async listWorkflowComments({
      actor,
      project_id,
      workflow_id,
      version = null,
      node_id = null,
      status = null,
      limit = 100
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return filterWorkflowComments({
        comments: await commentRepository.findByWorkflowId(workflow_id),
        version,
        node_id,
        status,
        limit
      });
    },

    async resolveWorkflowComment({
      actor,
      project_id,
      workflow_id,
      comment_id
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.UPDATE_WORKFLOW
      });

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      const comment = await requireWorkflowComment({
        commentRepository,
        comment_id,
        project_id: project.id,
        workflow_id
      });
      const resolved = resolveWorkflowCommentRecord({
        comment,
        resolved_by: actorId,
        resolved_at: nowIso(clock)
      });

      return commentRepository.save(resolved);
    },

    async createWorkflowTemplateFromVersion({
      actor,
      project_id,
      workflow_id,
      version,
      template_id = null,
      name,
      description = "",
      tags = []
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.UPDATE_WORKFLOW
      });

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      const sourceVersion = await requireWorkflowVersion({
        versionRepository,
        workflow_id,
        version
      });
      const template = createWorkflowCollaborationTemplateRecord({
        id: template_id ?? nextId(idGenerator, "workflow_template"),
        project_id: project.id,
        workflow_id,
        source_version: sourceVersion.version,
        name,
        description,
        tags,
        nodes: sourceVersion.nodes,
        edges: sourceVersion.edges,
        settings: sourceVersion.settings,
        created_by: actorId,
        created_at: nowIso(clock)
      });

      return templateRepository.save(template);
    },

    async listWorkflowCollaborationTemplates({
      actor,
      project_id,
      workflow_id = null
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const templates = await templateRepository.findByProjectId(project.id);

      if (workflow_id === null) {
        return sortTemplates(templates);
      }

      await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });

      return sortTemplates(
        templates.filter((template) => template.workflow_id === workflow_id)
      );
    },

    async exportWorkflowCollaborationPackage({
      actor,
      project_id,
      workflow_id,
      include_comments = true,
      include_templates = true
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_WORKFLOW
      });
      const workflow = await requireWorkflowInProject({
        workflowRepository,
        workflow_id,
        project_id: project.id
      });
      const projectTemplates = include_templates
        ? await templateRepository.findByProjectId(project.id)
        : [];

      return createWorkflowCollaborationPackage({
        workflow,
        versions: await versionRepository.findByWorkflowId(workflow.id),
        comments: include_comments
          ? await commentRepository.findByWorkflowId(workflow.id)
          : [],
        templates: projectTemplates.filter((template) =>
          template.workflow_id === workflow.id
        ),
        exported_by: actorId,
        exported_at: nowIso(clock)
      });
    },

    async importWorkflowCollaborationPackage({
      actor,
      project_id,
      package_data,
      name = null,
      include_comments = true,
      include_templates = true
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.CREATE_WORKFLOW
      });
      const workflowPackage = createWorkflowCollaborationPackage(package_data);
      const sourceWorkflow = workflowPackage.workflow;
      const timestamp = nowIso(clock);
      const importedVersions = workflowPackage.versions.length > 0
        ? workflowPackage.versions
        : [
          createWorkflowVersionRecordFromWorkflow({
            id: "imported_source_version",
            workflow: {
              ...sourceWorkflow,
              draft_version: sourceWorkflow.draft_version ?? 1
            },
            source: WORKFLOW_VERSION_SOURCES.IMPORT,
            created_by: actorId,
            created_at: timestamp
          })
        ];
      const nextDraftVersion = Math.max(
        sourceWorkflow.draft_version ?? 1,
        ...importedVersions.map((entry) => entry.version)
      );
      const normalizedContent = normalizeWorkflowContent({
        nodes: sourceWorkflow.nodes ?? [],
        edges: sourceWorkflow.edges ?? [],
        nodeDefinitions,
        runnerCapabilities
      });
      const importedWorkflow = createWorkflowRecord({
        id: nextId(idGenerator, "workflow"),
        name: normalizeNullableString(name, "Imported workflow name") ||
          sourceWorkflow.name,
        description: sourceWorkflow.description ?? "",
        owner_id: actorId,
        project_id: project.id,
        draft_version: nextDraftVersion,
        published_version: null,
        nodes: normalizedContent.nodes,
        edges: normalizedContent.edges,
        settings: sourceWorkflow.settings ?? {},
        created_at: timestamp,
        updated_at: timestamp,
        published_at: null,
        is_active: false
      });
      const savedWorkflow = await workflowRepository.save(importedWorkflow);
      const savedVersions = [];

      for (const sourceVersion of importedVersions) {
        savedVersions.push(
          await versionRepository.save(
            createWorkflowVersionRecord({
              ...sourceVersion,
              id: nextId(idGenerator, "workflow_version"),
              project_id: project.id,
              workflow_id: savedWorkflow.id,
              source: WORKFLOW_VERSION_SOURCES.IMPORT,
              change_summary: sourceVersion.change_summary ||
                `Imported workflow version ${sourceVersion.version}.`,
              created_by: actorId,
              created_at: timestamp,
              restored_from_version: null
            })
          )
        );
      }

      const savedComments = [];

      if (include_comments) {
        for (const sourceComment of workflowPackage.comments) {
          savedComments.push(
            await commentRepository.save(
              createWorkflowCommentRecord({
                ...sourceComment,
                id: nextId(idGenerator, "workflow_comment"),
                project_id: project.id,
                workflow_id: savedWorkflow.id,
                author_id: actorId,
                metadata: {
                  ...sourceComment.metadata,
                  imported_from_comment_id: sourceComment.id,
                  imported_from_author_id: sourceComment.author_id
                },
                created_at: timestamp,
                resolved_by:
                  sourceComment.status === WORKFLOW_COMMENT_STATUSES.RESOLVED
                    ? actorId
                    : null,
                resolved_at:
                  sourceComment.status === WORKFLOW_COMMENT_STATUSES.RESOLVED
                    ? timestamp
                    : null
              })
            )
          );
        }
      }

      const savedTemplates = [];

      if (include_templates) {
        for (const sourceTemplate of workflowPackage.templates) {
          savedTemplates.push(
            await templateRepository.save(
              createWorkflowCollaborationTemplateRecord({
                ...sourceTemplate,
                id: nextId(idGenerator, "workflow_template"),
                project_id: project.id,
                workflow_id: savedWorkflow.id,
                created_by: actorId,
                created_at: timestamp
              })
            )
          );
        }
      }

      return Object.freeze({
        workflow: savedWorkflow,
        versions: Object.freeze(savedVersions),
        comments: Object.freeze(savedComments),
        templates: Object.freeze(savedTemplates)
      });
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

async function requireWorkflowInProject({
  workflowRepository,
  workflow_id,
  project_id
}) {
  const workflow = await workflowRepository.findById(
    normalizeRequiredString(workflow_id, "Workflow id")
  );

  return assertWorkflowBelongsToProject({ workflow, project_id });
}

async function requireWorkflowVersion({
  versionRepository,
  workflow_id,
  version
}) {
  const workflowVersion = await findWorkflowVersion({
    versionRepository,
    workflow_id,
    version
  });

  if (!workflowVersion) {
    throw new TypeError("Workflow version was not found.");
  }

  return workflowVersion;
}

async function findWorkflowVersion({
  versionRepository,
  workflow_id,
  version
}) {
  const normalizedWorkflowId = normalizeRequiredString(workflow_id, "Workflow id");
  const normalizedVersion = normalizePositiveInteger(version, "Workflow version");

  return (
    (await versionRepository.findByWorkflowId(normalizedWorkflowId))
      .find((entry) => entry.version === normalizedVersion) ?? null
  );
}

async function requireWorkflowComment({
  commentRepository,
  comment_id,
  project_id,
  workflow_id
}) {
  const comment = await commentRepository.findById(
    normalizeRequiredString(comment_id, "Workflow comment id")
  );

  if (
    !comment ||
    comment.project_id !== project_id ||
    comment.workflow_id !== workflow_id
  ) {
    throw new TypeError("Workflow comment was not found.");
  }

  return comment;
}

function assertNodeReference({
  node_id,
  nodes
}) {
  const normalizedNodeId = normalizeNullableString(node_id, "Workflow comment node_id");

  if (normalizedNodeId === null) {
    return;
  }

  if (!nodes.some((node) => node.id === normalizedNodeId)) {
    throw new TypeError("Workflow comment node_id does not reference a workflow node.");
  }
}

function normalizeWorkflowContent({
  nodes,
  edges,
  nodeDefinitions,
  runnerCapabilities
}) {
  assertWorkflowGraphValid({ nodes, edges });
  const normalizedEdges = applyWorkflowErrorBranchDefaults({ edges });
  const schemaNodes = applyWorkflowNodeDefinitionDefaults({
    nodes,
    nodeDefinitions
  });
  const normalizedNodes = applyWorkflowNodeExecutionPolicyDefaults({
    nodes: schemaNodes
  });

  assertWorkflowNodesSafe({
    nodes: normalizedNodes,
    runnerCapabilities
  });

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges
  };
}

function sortVersions(versions) {
  return Object.freeze(
    [...versions].sort((left, right) => left.version - right.version)
  );
}

function sortTemplates(templates) {
  return Object.freeze(
    [...templates].sort((left, right) =>
      left.created_at.localeCompare(right.created_at) ||
      left.name.localeCompare(right.name)
    )
  );
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Workflow collaboration operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(
        `createWorkflowCollaborationService requires ${name}.${method}().`
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

function normalizeNullableString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePositiveInteger(value, field) {
  if (typeof value === "string" && value.trim() !== "") {
    return normalizePositiveInteger(Number(value), field);
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createWorkflowCollaborationService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
