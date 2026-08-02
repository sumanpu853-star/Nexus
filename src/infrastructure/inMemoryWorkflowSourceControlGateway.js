export function createInMemoryWorkflowSourceControlGateway() {
  const exports = [];

  return Object.freeze({
    async exportFiles({
      destination,
      files,
      message,
      metadata = {}
    } = {}) {
      const normalizedDestination = clonePlainObject(
        destination,
        "Source-control destination"
      );
      const normalizedFiles = normalizeFiles(files);
      const normalizedMessage = normalizeRequiredString(
        message,
        "Source-control commit message"
      );
      const normalizedMetadata = clonePlainObject(
        metadata,
        "Source-control metadata"
      );
      const commitRef = createStableCommitRef({
        destination: normalizedDestination,
        files: normalizedFiles,
        message: normalizedMessage,
        metadata: normalizedMetadata
      });
      const exportRecord = deepFreeze({
        destination: normalizedDestination,
        files: normalizedFiles,
        message: normalizedMessage,
        metadata: normalizedMetadata,
        commit_ref: commitRef
      });

      exports.push(clone(exportRecord));

      return deepFreeze({
        commit_ref: commitRef,
        file_count: normalizedFiles.length
      });
    },

    async listExports() {
      return clone(exports);
    }
  });
}

function normalizeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("Source-control files must be a non-empty array.");
  }

  return files.map((file) => {
    const normalized = clonePlainObject(file, "Source-control file");

    return deepFreeze({
      path: normalizeRequiredString(normalized.path, "Source-control file path"),
      content: normalizeRequiredString(
        normalized.content,
        "Source-control file content"
      )
    });
  });
}

function createStableCommitRef({
  destination,
  files,
  message,
  metadata
}) {
  const payload = JSON.stringify({
    destination,
    files,
    message,
    metadata
  });
  let hash = 2166136261;

  for (const char of payload) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return `git:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function clonePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return clone(value);
}

function clone(value) {
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
