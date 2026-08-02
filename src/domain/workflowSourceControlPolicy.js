export const WORKFLOW_EXPORT_FORMATS = Object.freeze({
  JSON: "json"
});

export const WORKFLOW_SOURCE_CONTROL_DESTINATIONS = Object.freeze({
  GIT: "git",
  ARCHIVE: "archive"
});

export function createWorkflowSourceControlExportRecord({
  id,
  project_id,
  workflow_id,
  workflow_version,
  destination,
  format = WORKFLOW_EXPORT_FORMATS.JSON,
  files = [],
  commit_ref = null,
  exported_by,
  exported_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Workflow export id"),
    project_id: normalizeRequiredString(project_id, "Workflow export project_id"),
    workflow_id: normalizeRequiredString(workflow_id, "Workflow export workflow_id"),
    workflow_version: normalizePositiveInteger(
      workflow_version,
      "Workflow export workflow_version"
    ),
    destination: normalizeDestination(destination),
    format: normalizeEnum(format, WORKFLOW_EXPORT_FORMATS, "Workflow export format"),
    files: normalizeFiles(files),
    commit_ref: normalizeNullableString(commit_ref, "Workflow export commit_ref"),
    exported_by: normalizeRequiredString(exported_by, "Workflow export exported_by"),
    exported_at: normalizeTimestamp(exported_at, "Workflow export exported_at")
  });
}

export function createWorkflowExportFiles({
  workflow,
  exported_by,
  exported_at
} = {}) {
  const normalizedWorkflow = normalizePlainObject(workflow, "Workflow export workflow");
  const workflowId = normalizeRequiredString(
    normalizedWorkflow.id,
    "Workflow export workflow id"
  );
  const version = normalizePositiveInteger(
    normalizedWorkflow.published_version ?? normalizedWorkflow.draft_version,
    "Workflow export workflow version"
  );
  const basePath = `workflows/${workflowId}`;
  const workflowPayload = canonicalize({
    ...normalizedWorkflow,
    exported_at,
    exported_by,
    exported_version: version
  });
  const manifestPayload = canonicalize({
    workflow_id: workflowId,
    project_id: normalizedWorkflow.project_id,
    version,
    exported_by,
    exported_at,
    files: [`${basePath}/workflow.v${version}.json`]
  });

  return deepFreeze([
    {
      path: `${basePath}/workflow.v${version}.json`,
      content: `${workflowPayload}\n`
    },
    {
      path: `${basePath}/manifest.json`,
      content: `${manifestPayload}\n`
    }
  ]);
}

export function createWorkflowExportCommitMessage({
  workflow,
  version
} = {}) {
  const normalizedWorkflow = normalizePlainObject(workflow, "Workflow export workflow");

  return `Export workflow ${normalizedWorkflow.id} v${normalizePositiveInteger(
    version,
    "Workflow export version"
  )}`;
}

function normalizeDestination(destination) {
  const normalized = normalizePlainObject(destination, "Workflow export destination");
  const type = normalizeEnum(
    normalized.type,
    WORKFLOW_SOURCE_CONTROL_DESTINATIONS,
    "Workflow export destination type"
  );

  return deepFreeze({
    ...normalized,
    type,
    repository: normalizeOptionalString(
      normalized.repository ?? "",
      "Workflow export destination repository"
    ),
    branch: normalizeOptionalString(
      normalized.branch ?? "",
      "Workflow export destination branch"
    )
  });
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) {
    throw new TypeError("Workflow export files must be an array.");
  }

  return files.map((file) => {
    const normalized = normalizePlainObject(file, "Workflow export file");

    return deepFreeze({
      path: normalizeExportPath(normalized.path),
      content: normalizeRequiredString(normalized.content, "Workflow export content")
    });
  });
}

function normalizeExportPath(path) {
  const normalized = normalizeRequiredString(path, "Workflow export path")
    .replace(/\\/g, "/");

  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("..\\")
  ) {
    throw new TypeError("Workflow export path must stay inside the export root.");
  }

  return normalized;
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value), null, 2);
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

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new TypeError(`${field} is not supported.`);
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
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
