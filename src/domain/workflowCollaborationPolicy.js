import {
  createWorkflowTemplate
} from "./workflowTemplatePolicy.js";

export const WORKFLOW_VERSION_SOURCES = Object.freeze({
  SNAPSHOT: "snapshot",
  RESTORE: "restore",
  IMPORT: "import"
});

export const WORKFLOW_COMMENT_STATUSES = Object.freeze({
  OPEN: "open",
  RESOLVED: "resolved"
});

export const WORKFLOW_COLLABORATION_PACKAGE_FORMAT =
  "nexus.workflow.collaboration.v1";

export class WorkflowCollaborationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkflowCollaborationValidationError";
    this.code = "workflow_collaboration_invalid";
  }
}

export function createWorkflowVersionRecord({
  id,
  project_id,
  workflow_id,
  version,
  name,
  description = "",
  nodes = [],
  edges = [],
  settings = {},
  change_summary = "",
  source = WORKFLOW_VERSION_SOURCES.SNAPSHOT,
  restored_from_version = null,
  created_by,
  created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Workflow version id"),
    project_id: normalizeRequiredString(project_id, "Workflow version project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Workflow version workflow_id"),
    version: normalizePositiveInteger(version, "Workflow version version"),
    name: normalizeRequiredString(name, "Workflow version name"),
    description: normalizeOptionalString(
      description,
      "Workflow version description"
    ),
    nodes: normalizeArray(nodes, "Workflow version nodes"),
    edges: normalizeArray(edges, "Workflow version edges"),
    settings: normalizePlainObject(settings, "Workflow version settings"),
    change_summary: normalizeOptionalString(
      change_summary,
      "Workflow version change_summary"
    ),
    source: normalizeEnum(
      source,
      WORKFLOW_VERSION_SOURCES,
      "Workflow version source"
    ),
    restored_from_version: normalizeNullablePositiveInteger(
      restored_from_version,
      "Workflow version restored_from_version"
    ),
    created_by: normalizeRequiredString(created_by, "Workflow version created_by"),
    created_at: normalizeTimestamp(created_at, "Workflow version created_at")
  });
}

export function createWorkflowVersionRecordFromWorkflow({
  id,
  workflow,
  change_summary = "",
  source = WORKFLOW_VERSION_SOURCES.SNAPSHOT,
  restored_from_version = null,
  created_by,
  created_at
} = {}) {
  const normalizedWorkflow = normalizePlainObject(
    workflow,
    "Workflow version workflow"
  );

  return createWorkflowVersionRecord({
    id,
    project_id: normalizedWorkflow.project_id,
    workflow_id: normalizedWorkflow.id,
    version: normalizedWorkflow.draft_version,
    name: normalizedWorkflow.name,
    description: normalizedWorkflow.description ?? "",
    nodes: normalizedWorkflow.nodes ?? [],
    edges: normalizedWorkflow.edges ?? [],
    settings: normalizedWorkflow.settings ?? {},
    change_summary,
    source,
    restored_from_version,
    created_by,
    created_at
  });
}

export function compareWorkflowVersions({
  left,
  right
} = {}) {
  const leftVersion = createWorkflowVersionRecord(left);
  const rightVersion = createWorkflowVersionRecord(right);

  if (
    leftVersion.project_id !== rightVersion.project_id ||
    leftVersion.workflow_id !== rightVersion.workflow_id
  ) {
    throw new WorkflowCollaborationValidationError(
      "Workflow versions must belong to the same workflow."
    );
  }

  const changes = [
    ...compareScalar("name", leftVersion.name, rightVersion.name),
    ...compareScalar(
      "description",
      leftVersion.description,
      rightVersion.description
    ),
    ...compareCollection({
      collection: "nodes",
      left: leftVersion.nodes,
      right: rightVersion.nodes,
      keySelector: (node) => node.id
    }),
    ...compareCollection({
      collection: "edges",
      left: leftVersion.edges,
      right: rightVersion.edges,
      keySelector: resolveEdgeKey
    }),
    ...compareObject("settings", leftVersion.settings, rightVersion.settings)
  ];

  return deepFreeze({
    project_id: leftVersion.project_id,
    workflow_id: leftVersion.workflow_id,
    left_version: leftVersion.version,
    right_version: rightVersion.version,
    summary: createDiffSummary(changes),
    changes
  });
}

export function createWorkflowCommentRecord({
  id,
  project_id,
  workflow_id,
  version = null,
  node_id = null,
  body,
  author_id,
  status = WORKFLOW_COMMENT_STATUSES.OPEN,
  metadata = {},
  created_at,
  resolved_by = null,
  resolved_at = null
} = {}) {
  const normalizedStatus = normalizeEnum(
    status,
    WORKFLOW_COMMENT_STATUSES,
    "Workflow comment status"
  );
  const resolvedBy = normalizeNullableString(
    resolved_by,
    "Workflow comment resolved_by"
  );
  const resolvedAt = normalizeNullableTimestamp(
    resolved_at,
    "Workflow comment resolved_at"
  );

  if (normalizedStatus === WORKFLOW_COMMENT_STATUSES.RESOLVED) {
    if (!resolvedBy || !resolvedAt) {
      throw new WorkflowCollaborationValidationError(
        "Resolved workflow comments require resolved_by and resolved_at."
      );
    }
  } else if (resolvedBy || resolvedAt) {
    throw new WorkflowCollaborationValidationError(
      "Open workflow comments cannot include resolution fields."
    );
  }

  return deepFreeze({
    id: normalizeRequiredString(id, "Workflow comment id"),
    project_id: normalizeRequiredString(project_id, "Workflow comment project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Workflow comment workflow_id"),
    version: normalizeNullablePositiveInteger(version, "Workflow comment version"),
    node_id: normalizeNullableString(node_id, "Workflow comment node_id"),
    body: normalizeRequiredString(body, "Workflow comment body"),
    author_id: normalizeRequiredString(author_id, "Workflow comment author_id"),
    status: normalizedStatus,
    metadata: normalizePlainObject(metadata, "Workflow comment metadata"),
    created_at: normalizeTimestamp(created_at, "Workflow comment created_at"),
    resolved_by: resolvedBy,
    resolved_at: resolvedAt
  });
}

export function resolveWorkflowCommentRecord({
  comment,
  resolved_by,
  resolved_at
} = {}) {
  const normalizedComment = createWorkflowCommentRecord(comment);

  return createWorkflowCommentRecord({
    ...normalizedComment,
    status: WORKFLOW_COMMENT_STATUSES.RESOLVED,
    resolved_by,
    resolved_at
  });
}

export function filterWorkflowComments({
  comments,
  version = null,
  node_id = null,
  status = null,
  limit = 100
} = {}) {
  const normalizedComments = normalizeArray(comments, "Workflow comments")
    .map((comment) => createWorkflowCommentRecord(comment));
  const normalizedVersion = normalizeNullablePositiveInteger(
    version,
    "Workflow comment filter version"
  );
  const normalizedNodeId = normalizeNullableString(
    node_id,
    "Workflow comment filter node_id"
  );
  const normalizedStatus = status === null
    ? null
    : normalizeEnum(status, WORKFLOW_COMMENT_STATUSES, "Workflow comment filter status");
  const normalizedLimit = normalizeLimit(limit, "Workflow comment filter limit");

  return deepFreeze(
    normalizedComments
      .filter((comment) =>
        (normalizedVersion === null || comment.version === normalizedVersion) &&
        (normalizedNodeId === null || comment.node_id === normalizedNodeId) &&
        (normalizedStatus === null || comment.status === normalizedStatus)
      )
      .sort((left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at)
      )
      .slice(0, normalizedLimit)
  );
}

export function createWorkflowCollaborationTemplateRecord({
  id,
  project_id,
  workflow_id,
  source_version,
  name,
  description = "",
  tags = [],
  nodes = [],
  edges = [],
  settings = {},
  created_by,
  created_at
} = {}) {
  const template = createWorkflowTemplate({
    id,
    name,
    description,
    tags,
    nodes,
    edges,
    settings
  });

  return deepFreeze({
    ...template,
    project_id: normalizeRequiredString(
      project_id,
      "Workflow collaboration template project_id"
    ),
    workflow_id: normalizeRequiredString(
      workflow_id,
      "Workflow collaboration template workflow_id"
    ),
    source_version: normalizePositiveInteger(
      source_version,
      "Workflow collaboration template source_version"
    ),
    created_by: normalizeRequiredString(
      created_by,
      "Workflow collaboration template created_by"
    ),
    created_at: normalizeTimestamp(
      created_at,
      "Workflow collaboration template created_at"
    )
  });
}

export function createWorkflowCollaborationPackage({
  format = WORKFLOW_COLLABORATION_PACKAGE_FORMAT,
  workflow,
  versions = [],
  comments = [],
  templates = [],
  exported_by,
  exported_at
} = {}) {
  const normalizedWorkflow = normalizePlainObject(
    workflow,
    "Workflow collaboration package workflow"
  );
  const normalizedFormat = normalizeRequiredString(
    format,
    "Workflow collaboration package format"
  );

  if (normalizedFormat !== WORKFLOW_COLLABORATION_PACKAGE_FORMAT) {
    throw new WorkflowCollaborationValidationError(
      "Workflow collaboration package format is not supported."
    );
  }

  return deepFreeze({
    format: normalizedFormat,
    workflow: normalizedWorkflow,
    versions: normalizeArray(versions, "Workflow collaboration package versions")
      .map((version) => createWorkflowVersionRecord(version))
      .sort((left, right) => left.version - right.version),
    comments: normalizeArray(comments, "Workflow collaboration package comments")
      .map((comment) => createWorkflowCommentRecord(comment))
      .sort((left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at)
      ),
    templates: normalizeArray(templates, "Workflow collaboration package templates")
      .map((template) => createWorkflowCollaborationTemplateRecord(template))
      .sort((left, right) =>
        left.source_version - right.source_version ||
        left.name.localeCompare(right.name)
      ),
    exported_by: normalizeRequiredString(
      exported_by,
      "Workflow collaboration package exported_by"
    ),
    exported_at: normalizeTimestamp(
      exported_at,
      "Workflow collaboration package exported_at"
    )
  });
}

function compareScalar(path, before, after) {
  return before === after
    ? []
    : [
      deepFreeze({
        type: "changed",
        path,
        before,
        after
      })
    ];
}

function compareObject(path, before, after) {
  return canonicalize(before) === canonicalize(after)
    ? []
    : [
      deepFreeze({
        type: "changed",
        path,
        before: deepClone(before),
        after: deepClone(after)
      })
    ];
}

function compareCollection({
  collection,
  left,
  right,
  keySelector
}) {
  const leftByKey = new Map(left.map((entry) => [keySelector(entry), entry]));
  const rightByKey = new Map(right.map((entry) => [keySelector(entry), entry]));
  const keys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])].sort();
  const changes = [];

  for (const key of keys) {
    const before = leftByKey.get(key);
    const after = rightByKey.get(key);

    if (!before) {
      changes.push(
        deepFreeze({
          type: "added",
          collection,
          key,
          path: `${collection}.${key}`,
          after: deepClone(after)
        })
      );
      continue;
    }

    if (!after) {
      changes.push(
        deepFreeze({
          type: "removed",
          collection,
          key,
          path: `${collection}.${key}`,
          before: deepClone(before)
        })
      );
      continue;
    }

    if (canonicalize(before) !== canonicalize(after)) {
      changes.push(
        deepFreeze({
          type: "changed",
          collection,
          key,
          path: `${collection}.${key}`,
          before: deepClone(before),
          after: deepClone(after)
        })
      );
    }
  }

  return changes;
}

function createDiffSummary(changes) {
  return deepFreeze({
    added_nodes: countChanges(changes, "nodes", "added"),
    removed_nodes: countChanges(changes, "nodes", "removed"),
    changed_nodes: countChanges(changes, "nodes", "changed"),
    added_edges: countChanges(changes, "edges", "added"),
    removed_edges: countChanges(changes, "edges", "removed"),
    changed_edges: countChanges(changes, "edges", "changed"),
    metadata_changed: changes.filter((change) =>
      ["name", "description"].includes(change.path)
    ).length,
    settings_changed: changes.some((change) => change.path === "settings")
  });
}

function countChanges(changes, collection, type) {
  return changes.filter((change) =>
    change.collection === collection && change.type === type
  ).length;
}

function resolveEdgeKey(edge) {
  if (typeof edge.id === "string" && edge.id.trim() !== "") {
    return edge.id.trim();
  }

  return [
    normalizeRequiredString(edge.source, "Workflow edge source"),
    normalizeRequiredString(edge.target, "Workflow edge target"),
    typeof edge.type === "string" && edge.type.trim() !== ""
      ? edge.type.trim()
      : "success"
  ].join("->");
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WorkflowCollaborationValidationError(
      `${field} must be a non-empty string.`
    );
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new WorkflowCollaborationValidationError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new WorkflowCollaborationValidationError(
      `${field} must be an ISO timestamp.`
    );
  }

  return normalized;
}

function normalizeNullableTimestamp(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeTimestamp(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new WorkflowCollaborationValidationError(
      `${field} must be a positive integer.`
    );
  }

  return value;
}

function normalizeNullablePositiveInteger(value, field) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizePositiveInteger(value, field);
}

function normalizeLimit(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new WorkflowCollaborationValidationError(
      `${field} must be an integer between 1 and 500.`
    );
  }

  return value;
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new WorkflowCollaborationValidationError(`${field} is not supported.`);
  }

  return value;
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowCollaborationValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowCollaborationValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function normalizePlainObject(value, field) {
  if (!isPlainObject(value)) {
    throw new WorkflowCollaborationValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObject(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObject(value[key])])
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
