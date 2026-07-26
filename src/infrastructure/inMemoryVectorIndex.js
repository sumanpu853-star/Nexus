import {
  VECTOR_WRITE_MODES,
  normalizeVectorWriteMode
} from "../domain/knowledgeBasePolicy.js";

export function createInMemoryVectorIndex(initialVectors = []) {
  const vectorsByKnowledgeBaseId = new Map();

  for (const vector of initialVectors) {
    const normalized = normalizeVectorRecord(vector);

    upsertVector(normalized);
  }

  return Object.freeze({
    writeVectors,
    search
  });

  async function writeVectors({
    knowledge_base_id,
    vectors,
    mode = VECTOR_WRITE_MODES.UPSERT
  } = {}) {
    const knowledgeBaseId = normalizeRequiredString(
      knowledge_base_id,
      "Vector knowledge_base_id"
    );
    const normalizedMode = normalizeVectorWriteMode(mode);

    if (!Array.isArray(vectors)) {
      throw new TypeError("writeVectors requires vectors to be an array.");
    }

    const normalizedVectors = vectors.map((vector) =>
      normalizeVectorRecord({
        ...vector,
        knowledge_base_id: vector.knowledge_base_id ?? knowledgeBaseId
      })
    );

    for (const vector of normalizedVectors) {
      if (vector.knowledge_base_id !== knowledgeBaseId) {
        throw new TypeError("Vector knowledge_base_id must match the write target.");
      }
    }

    if (normalizedMode === VECTOR_WRITE_MODES.APPEND) {
      assertNoDuplicateAppend({ knowledgeBaseId, vectors: normalizedVectors });
    }

    if (normalizedMode === VECTOR_WRITE_MODES.REPLACE) {
      replaceDocumentVectors({ knowledgeBaseId, vectors: normalizedVectors });
    } else {
      for (const vector of normalizedVectors) {
        upsertVector(vector);
      }
    }

    return deepFreeze(normalizedVectors.map((vector) => deepClone(vector)));
  }

  async function search({
    knowledge_base_id,
    embedding,
    limit = 10,
    filters = {}
  } = {}) {
    const knowledgeBaseId = normalizeRequiredString(
      knowledge_base_id,
      "Vector search knowledge_base_id"
    );
    const normalizedEmbedding = normalizeEmbedding(embedding, "Vector search embedding");
    const normalizedLimit = normalizePositiveInteger(limit, "Vector search limit");
    const normalizedFilters = normalizePlainObject(filters, "Vector search filters");
    const candidates = vectorsByKnowledgeBaseId.get(knowledgeBaseId) ?? [];

    return deepFreeze(
      candidates
        .filter((vector) => vectorMatchesFilters(vector, normalizedFilters))
        .map((vector) => ({
          ...deepClone(vector),
          score: Math.max(0, cosineSimilarity(normalizedEmbedding, vector.embedding))
        }))
        .sort((left, right) =>
          right.score - left.score ||
          left.id.localeCompare(right.id)
        )
        .slice(0, normalizedLimit)
        .map((vector) => deepFreeze({
          ...vector,
          score: Number(vector.score.toFixed(6))
        }))
    );
  }

  function upsertVector(vector) {
    const existing = vectorsByKnowledgeBaseId.get(vector.knowledge_base_id) ?? [];
    const withoutDuplicate = existing.filter((entry) => entry.id !== vector.id);

    vectorsByKnowledgeBaseId.set(vector.knowledge_base_id, [
      ...withoutDuplicate,
      deepClone(vector)
    ]);
  }

  function replaceDocumentVectors({
    knowledgeBaseId,
    vectors
  }) {
    const documentIds = new Set(vectors.map((vector) => vector.document_id));
    const existing = vectorsByKnowledgeBaseId.get(knowledgeBaseId) ?? [];

    vectorsByKnowledgeBaseId.set(
      knowledgeBaseId,
      existing.filter((vector) => !documentIds.has(vector.document_id))
    );

    for (const vector of vectors) {
      upsertVector(vector);
    }
  }

  function assertNoDuplicateAppend({
    knowledgeBaseId,
    vectors
  }) {
    const existingIds = new Set(
      (vectorsByKnowledgeBaseId.get(knowledgeBaseId) ?? []).map((vector) => vector.id)
    );
    const incomingIds = new Set();

    for (const vector of vectors) {
      if (existingIds.has(vector.id) || incomingIds.has(vector.id)) {
        throw new TypeError(`Vector "${vector.id}" already exists.`);
      }

      incomingIds.add(vector.id);
    }
  }
}

function normalizeVectorRecord(vector) {
  if (!vector || typeof vector !== "object" || Array.isArray(vector)) {
    throw new TypeError("Vector records must be objects.");
  }

  return deepFreeze({
    id: normalizeRequiredString(vector.id, "Vector id"),
    knowledge_base_id: normalizeRequiredString(
      vector.knowledge_base_id,
      "Vector knowledge_base_id"
    ),
    document_id: normalizeRequiredString(vector.document_id, "Vector document_id"),
    chunk_id: normalizeRequiredString(vector.chunk_id, "Vector chunk_id"),
    project_id: normalizeRequiredString(vector.project_id, "Vector project_id"),
    text: normalizeRequiredString(vector.text, "Vector text"),
    embedding: normalizeEmbedding(vector.embedding, "Vector embedding"),
    metadata: normalizePlainObject(vector.metadata ?? {}, "Vector metadata")
  });
}

function cosineSimilarity(left, right) {
  if (left.length !== right.length) {
    throw new TypeError("Vector dimensions must match.");
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function vectorMatchesFilters(vector, filters) {
  return Object.entries(filters).every(([key, value]) => vector.metadata[key] === value);
}

function normalizeEmbedding(value, field) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
  ) {
    throw new TypeError(`${field} must be a non-empty number array.`);
  }

  return Object.freeze([...value]);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
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

  return deepClone(value);
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
