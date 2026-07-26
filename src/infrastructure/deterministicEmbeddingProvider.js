export function createDeterministicEmbeddingProvider({
  dimensions = 16,
  model = "nexus-deterministic-v1"
} = {}) {
  const normalizedDimensions = normalizeDimensions(dimensions);
  const defaultModel = normalizeRequiredString(model, "Embedding model");

  return Object.freeze({
    async embedDocuments({
      texts,
      model: requestedModel = defaultModel
    } = {}) {
      if (!Array.isArray(texts)) {
        throw new TypeError("embedDocuments requires texts to be an array.");
      }

      return Object.freeze({
        model: normalizeRequiredString(requestedModel, "Embedding model"),
        dimensions: normalizedDimensions,
        embeddings: Object.freeze(
          texts.map((text) => deepFreeze(embedText({
            text,
            dimensions: normalizedDimensions
          })))
        )
      });
    },

    async embedQuery({
      text,
      model: requestedModel = defaultModel
    } = {}) {
      return Object.freeze({
        model: normalizeRequiredString(requestedModel, "Embedding model"),
        dimensions: normalizedDimensions,
        embedding: deepFreeze(embedText({
          text,
          dimensions: normalizedDimensions
        }))
      });
    }
  });
}

function embedText({
  text,
  dimensions
}) {
  const tokens = tokenize(text);
  const vector = Array.from({ length: dimensions }, () => 0);

  for (const token of tokens) {
    const index = positiveHash(token) % dimensions;
    const weight = 1 + Math.min(token.length, 12) / 12;

    vector[index] += weight;
  }

  return normalizeVector(vector);
}

function tokenize(value) {
  return normalizeRequiredString(value, "Embedding text")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function positiveHash(value) {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + (value * value), 0)
  );

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function normalizeDimensions(value) {
  if (!Number.isInteger(value) || value < 4 || value > 4096) {
    throw new TypeError("Embedding dimensions must be an integer between 4 and 4096.");
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
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
