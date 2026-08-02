import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createJsonFileDurableStore({
  filePath
} = {}) {
  const normalizedFilePath = normalizeRequiredString(
    filePath,
    "JSON durable store filePath"
  );

  return Object.freeze({
    async get(collection, id) {
      const snapshot = await readSnapshot(normalizedFilePath);
      const normalizedCollection = normalizeCollection(collection);
      const normalizedId = normalizeRequiredString(id, "JSON durable store id");

      return cloneOrNull(
        snapshot.collections[normalizedCollection]?.[normalizedId]
      );
    },

    async list(collection) {
      const snapshot = await readSnapshot(normalizedFilePath);
      const normalizedCollection = normalizeCollection(collection);

      return cloneArray(
        Object.values(snapshot.collections[normalizedCollection] ?? {})
      );
    },

    async put(collection, record) {
      const normalizedCollection = normalizeCollection(collection);
      const normalizedRecord = normalizeRecord(record);
      const snapshot = await readSnapshot(normalizedFilePath);
      const records = snapshot.collections[normalizedCollection] ?? {};

      snapshot.collections[normalizedCollection] = {
        ...records,
        [normalizedRecord.id]: normalizedRecord
      };

      await writeSnapshot(normalizedFilePath, snapshot);

      return clone(normalizedRecord);
    },

    async delete(collection, id) {
      const normalizedCollection = normalizeCollection(collection);
      const normalizedId = normalizeRequiredString(id, "JSON durable store id");
      const snapshot = await readSnapshot(normalizedFilePath);
      const records = snapshot.collections[normalizedCollection] ?? {};
      const existed = Object.hasOwn(records, normalizedId);

      delete records[normalizedId];
      snapshot.collections[normalizedCollection] = records;

      await writeSnapshot(normalizedFilePath, snapshot);

      return existed;
    },

    async readSnapshot() {
      return deepFreeze(await readSnapshot(normalizedFilePath));
    }
  });
}

async function readSnapshot(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    return normalizeSnapshot(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return createEmptySnapshot();
    }

    throw error;
  }
}

async function writeSnapshot(filePath, snapshot) {
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const directory = dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(
    temporaryPath,
    `${JSON.stringify(normalizedSnapshot, null, 2)}\n`,
    "utf8"
  );
  await rename(temporaryPath, filePath);
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("JSON durable store snapshot must be an object.");
  }

  const collections = value.collections ?? {};

  if (!collections || typeof collections !== "object" || Array.isArray(collections)) {
    throw new TypeError("JSON durable store collections must be an object.");
  }

  const normalizedCollections = {};

  for (const [collection, records] of Object.entries(collections)) {
    const normalizedCollection = normalizeCollection(collection);

    if (!records || typeof records !== "object" || Array.isArray(records)) {
      throw new TypeError("JSON durable store collection records must be an object.");
    }

    normalizedCollections[normalizedCollection] = {};

    for (const [id, record] of Object.entries(records)) {
      const normalizedRecord = normalizeRecord(record);

      if (normalizedRecord.id !== id) {
        throw new TypeError("JSON durable store record id must match its key.");
      }

      normalizedCollections[normalizedCollection][id] = normalizedRecord;
    }
  }

  return {
    version: 1,
    collections: normalizedCollections
  };
}

function createEmptySnapshot() {
  return {
    version: 1,
    collections: {}
  };
}

function normalizeCollection(value) {
  const normalized = normalizeRequiredString(value, "JSON durable store collection");

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new TypeError(
      "JSON durable store collection must use lowercase letters, numbers, and underscores."
    );
  }

  return normalized;
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("JSON durable store record must be an object.");
  }

  if (typeof value.id !== "string" || value.id.trim() === "") {
    throw new TypeError("JSON durable store record id must be a non-empty string.");
  }

  return clone({
    ...value,
    id: value.id.trim()
  });
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
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
