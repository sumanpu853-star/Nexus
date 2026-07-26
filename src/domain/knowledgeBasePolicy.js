export const KNOWLEDGE_SOURCE_TYPES = Object.freeze({
  TEXT: "text",
  URL: "url",
  FILE: "file"
});

export const KNOWLEDGE_DOCUMENT_STATUSES = Object.freeze({
  READY: "ready",
  FAILED: "failed"
});

export const VECTOR_WRITE_MODES = Object.freeze({
  APPEND: "append",
  UPSERT: "upsert",
  REPLACE: "replace"
});

export const DEFAULT_KNOWLEDGE_CHUNKING = deepFreeze({
  strategy: "recursive_character",
  max_chars: 800,
  overlap_chars: 120
});

export class KnowledgeBaseValidationError extends Error {
  constructor(message, {
    code = "knowledge_base_invalid",
    details = {}
  } = {}) {
    super(message);
    this.name = "KnowledgeBaseValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function createKnowledgeBaseRecord({
  id,
  project_id,
  owner_id,
  name,
  description = "",
  embedding_model = "nexus-deterministic-v1",
  chunking = {},
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Knowledge base id"),
    project_id: normalizeRequiredString(project_id, "Knowledge base project_id"),
    owner_id: normalizeRequiredString(owner_id, "Knowledge base owner_id"),
    name: normalizeRequiredString(name, "Knowledge base name"),
    description: normalizeOptionalString(description, "Knowledge base description"),
    embedding_model: normalizeRequiredString(
      embedding_model,
      "Knowledge base embedding_model"
    ),
    chunking: normalizeKnowledgeChunking(chunking),
    created_at: normalizeTimestamp(created_at, "Knowledge base created_at"),
    updated_at: normalizeTimestamp(updated_at, "Knowledge base updated_at")
  });
}

export function createKnowledgeDocumentRecord({
  id,
  knowledge_base_id,
  project_id,
  title,
  source_type = KNOWLEDGE_SOURCE_TYPES.TEXT,
  source_uri = "",
  content_hash,
  status = KNOWLEDGE_DOCUMENT_STATUSES.READY,
  metadata = {},
  created_at,
  updated_at = created_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Knowledge document id"),
    knowledge_base_id: normalizeRequiredString(
      knowledge_base_id,
      "Knowledge document knowledge_base_id"
    ),
    project_id: normalizeRequiredString(project_id, "Knowledge document project_id"),
    title: normalizeRequiredString(title, "Knowledge document title"),
    source_type: normalizeEnum(
      source_type,
      KNOWLEDGE_SOURCE_TYPES,
      "Knowledge document source_type"
    ),
    source_uri: normalizeOptionalString(source_uri, "Knowledge document source_uri"),
    content_hash: normalizeRequiredString(
      content_hash,
      "Knowledge document content_hash"
    ),
    status: normalizeEnum(
      status,
      KNOWLEDGE_DOCUMENT_STATUSES,
      "Knowledge document status"
    ),
    metadata: normalizePlainObject(metadata, "Knowledge document metadata"),
    created_at: normalizeTimestamp(created_at, "Knowledge document created_at"),
    updated_at: normalizeTimestamp(updated_at, "Knowledge document updated_at")
  });
}

export function createKnowledgeChunkRecord({
  id,
  knowledge_base_id,
  document_id,
  project_id,
  ordinal,
  text,
  token_count,
  content_hash,
  metadata = {},
  embedding_ref = null,
  created_at
} = {}) {
  const normalizedText = normalizeRequiredString(text, "Knowledge chunk text");

  return deepFreeze({
    id: normalizeRequiredString(id, "Knowledge chunk id"),
    knowledge_base_id: normalizeRequiredString(
      knowledge_base_id,
      "Knowledge chunk knowledge_base_id"
    ),
    document_id: normalizeRequiredString(document_id, "Knowledge chunk document_id"),
    project_id: normalizeRequiredString(project_id, "Knowledge chunk project_id"),
    ordinal: normalizeNonNegativeInteger(ordinal, "Knowledge chunk ordinal"),
    text: normalizedText,
    token_count: token_count === undefined
      ? estimateTokenCount(normalizedText)
      : normalizePositiveInteger(token_count, "Knowledge chunk token_count"),
    content_hash: normalizeRequiredString(
      content_hash,
      "Knowledge chunk content_hash"
    ),
    metadata: normalizePlainObject(metadata, "Knowledge chunk metadata"),
    embedding_ref: normalizeNullableString(
      embedding_ref,
      "Knowledge chunk embedding_ref"
    ),
    created_at: normalizeTimestamp(created_at, "Knowledge chunk created_at")
  });
}

export function chunkKnowledgeDocument({
  content,
  chunking = {},
  metadata = {}
} = {}) {
  const normalizedContent = normalizeRequiredString(content, "Knowledge document content")
    .replace(/\s+/g, " ");
  const policy = normalizeKnowledgeChunking(chunking);
  const normalizedMetadata = normalizePlainObject(metadata, "Knowledge chunk metadata");
  const chunks = [];
  let start = 0;

  while (start < normalizedContent.length) {
    const preferredEnd = Math.min(start + policy.max_chars, normalizedContent.length);
    const end = resolveChunkEnd({
      content: normalizedContent,
      start,
      preferredEnd,
      maxChars: policy.max_chars
    });
    const text = normalizedContent.slice(start, end).trim();

    if (text !== "") {
      chunks.push(deepFreeze({
        ordinal: chunks.length,
        text,
        token_count: estimateTokenCount(text),
        metadata: deepClone(normalizedMetadata)
      }));
    }

    if (end >= normalizedContent.length) {
      break;
    }

    start = Math.max(end - policy.overlap_chars, start + 1);
  }

  if (chunks.length === 0) {
    throw new KnowledgeBaseValidationError("Knowledge document content produced no chunks.");
  }

  return deepFreeze(chunks);
}

export function createKnowledgeSearchResult({
  knowledge_base_id,
  document_id,
  chunk_id,
  text,
  score,
  metadata = {},
  source = {},
  rerank_score = null
} = {}) {
  return deepFreeze({
    knowledge_base_id: normalizeRequiredString(
      knowledge_base_id,
      "Knowledge search result knowledge_base_id"
    ),
    document_id: normalizeRequiredString(
      document_id,
      "Knowledge search result document_id"
    ),
    chunk_id: normalizeRequiredString(chunk_id, "Knowledge search result chunk_id"),
    text: normalizeRequiredString(text, "Knowledge search result text"),
    score: normalizeScore(score, "Knowledge search result score"),
    metadata: normalizePlainObject(metadata, "Knowledge search result metadata"),
    source: normalizeSource(source),
    rerank_score: rerank_score === null
      ? null
      : normalizeScore(rerank_score, "Knowledge search result rerank_score")
  });
}

export function rerankKnowledgeSearchResults({
  query,
  results,
  limit = 10
} = {}) {
  const normalizedQuery = normalizeRequiredString(query, "Knowledge search query");
  const normalizedLimit = normalizePositiveInteger(limit, "Knowledge search limit");
  const queryTerms = tokenize(normalizedQuery);
  const normalizedResults = normalizeArray(results, "Knowledge search results")
    .map((result) => createKnowledgeSearchResult(result));

  return deepFreeze(
    normalizedResults
      .map((result) => createKnowledgeSearchResult({
        ...result,
        rerank_score: calculateRerankScore({ queryTerms, result })
      }))
      .sort((left, right) =>
        right.rerank_score - left.rerank_score ||
        right.score - left.score ||
        left.chunk_id.localeCompare(right.chunk_id)
      )
      .slice(0, normalizedLimit)
  );
}

export function normalizeVectorWriteMode(mode) {
  return normalizeEnum(mode, VECTOR_WRITE_MODES, "Vector write mode");
}

export function normalizeKnowledgeChunking(chunking = {}) {
  const provided = chunking === undefined || chunking === null ? {} : chunking;
  const normalized = {
    ...DEFAULT_KNOWLEDGE_CHUNKING,
    ...normalizePlainObject(provided, "Knowledge chunking")
  };

  normalized.strategy = normalizeRequiredString(
    normalized.strategy,
    "Knowledge chunking strategy"
  );
  normalized.max_chars = normalizePositiveInteger(
    normalized.max_chars,
    "Knowledge chunking max_chars"
  );
  normalized.overlap_chars = normalizeNonNegativeInteger(
    normalized.overlap_chars,
    "Knowledge chunking overlap_chars"
  );

  if (normalized.max_chars < 100 || normalized.max_chars > 8000) {
    throw new KnowledgeBaseValidationError(
      "Knowledge chunking max_chars must be between 100 and 8000.",
      {
        code: "knowledge_chunking_max_chars_out_of_range",
        details: { max_chars: normalized.max_chars }
      }
    );
  }

  if (normalized.overlap_chars >= normalized.max_chars) {
    throw new KnowledgeBaseValidationError(
      "Knowledge chunking overlap_chars must be less than max_chars.",
      {
        code: "knowledge_chunking_overlap_invalid",
        details: {
          max_chars: normalized.max_chars,
          overlap_chars: normalized.overlap_chars
        }
      }
    );
  }

  return deepFreeze(normalized);
}

function resolveChunkEnd({
  content,
  start,
  preferredEnd,
  maxChars
}) {
  if (preferredEnd >= content.length) {
    return content.length;
  }

  const minimumUsefulEnd = start + Math.floor(maxChars * 0.5);
  const whitespaceIndex = content.lastIndexOf(" ", preferredEnd);

  if (whitespaceIndex > minimumUsefulEnd) {
    return whitespaceIndex;
  }

  return preferredEnd;
}

function calculateRerankScore({
  queryTerms,
  result
}) {
  const resultTerms = new Set(tokenize(result.text));
  const matches = queryTerms.filter((term) => resultTerms.has(term)).length;
  const lexicalScore = queryTerms.length === 0 ? 0 : matches / queryTerms.length;

  return roundScore((result.score * 0.7) + (lexicalScore * 0.3));
}

function estimateTokenCount(text) {
  return Math.max(1, tokenize(text).length);
}

function tokenize(value) {
  return normalizeRequiredString(value, "Text")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function normalizeSource(source) {
  const normalized = normalizePlainObject(source, "Knowledge search result source");

  return deepFreeze({
    title: normalizeOptionalString(normalized.title ?? "", "Knowledge search result source title"),
    uri: normalizeOptionalString(normalized.uri ?? "", "Knowledge search result source uri"),
    type: normalizeOptionalString(normalized.type ?? "", "Knowledge search result source type")
  });
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new KnowledgeBaseValidationError(`${field} is not supported.`, {
      code: "knowledge_base_unsupported_value",
      details: { field, value, supported: values }
    });
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new KnowledgeBaseValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new KnowledgeBaseValidationError(`${field} must be a string.`);
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
    throw new KnowledgeBaseValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new KnowledgeBaseValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeScore(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new KnowledgeBaseValidationError(`${field} must be a non-negative number.`);
  }

  return roundScore(value);
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new KnowledgeBaseValidationError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KnowledgeBaseValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new KnowledgeBaseValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function roundScore(value) {
  return Number(value.toFixed(6));
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
