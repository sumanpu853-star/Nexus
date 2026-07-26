export function createInMemoryKnowledgeRepositories(initialState = {}) {
  const knowledgeBasesById = new Map();
  const knowledgeBasesByProjectId = new Map();
  const documentsById = new Map();
  const documentsByKnowledgeBaseId = new Map();
  const chunksById = new Map();
  const chunksByKnowledgeBaseId = new Map();
  const chunksByDocumentId = new Map();

  for (const knowledgeBase of initialState.knowledgeBases ?? []) {
    saveKnowledgeBase(knowledgeBase);
  }

  for (const document of initialState.documents ?? []) {
    saveDocument(document);
  }

  for (const chunk of initialState.chunks ?? []) {
    saveChunk(chunk);
  }

  return Object.freeze({
    knowledgeBases: Object.freeze({
      async findById(id) {
        return cloneOrNull(knowledgeBasesById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(knowledgeBasesByProjectId.get(projectId) ?? []);
      },

      async save(knowledgeBase) {
        saveKnowledgeBase(knowledgeBase);

        return cloneOrNull(knowledgeBase);
      }
    }),

    knowledgeDocuments: Object.freeze({
      async findById(id) {
        return cloneOrNull(documentsById.get(id));
      },

      async findByKnowledgeBaseId(knowledgeBaseId) {
        return cloneArray(documentsByKnowledgeBaseId.get(knowledgeBaseId) ?? []);
      },

      async save(document) {
        saveDocument(document);

        return cloneOrNull(document);
      }
    }),

    knowledgeChunks: Object.freeze({
      async findById(id) {
        return cloneOrNull(chunksById.get(id));
      },

      async findByKnowledgeBaseId(knowledgeBaseId) {
        return cloneArray(chunksByKnowledgeBaseId.get(knowledgeBaseId) ?? []);
      },

      async findByDocumentId(documentId) {
        return cloneArray(chunksByDocumentId.get(documentId) ?? []);
      },

      async saveMany(chunks) {
        if (!Array.isArray(chunks)) {
          throw new TypeError("knowledgeChunks.saveMany requires an array.");
        }

        for (const chunk of chunks) {
          saveChunk(chunk);
        }

        return cloneArray(chunks);
      }
    })
  });

  function saveKnowledgeBase(knowledgeBase) {
    const existing = knowledgeBasesById.get(knowledgeBase.id);

    if (existing && existing.project_id !== knowledgeBase.project_id) {
      removeFromIndex({
        index: knowledgeBasesByProjectId,
        key: existing.project_id,
        id: knowledgeBase.id
      });
    }

    knowledgeBasesById.set(knowledgeBase.id, clone(knowledgeBase));
    upsertInIndex({
      index: knowledgeBasesByProjectId,
      key: knowledgeBase.project_id,
      value: knowledgeBase
    });
  }

  function saveDocument(document) {
    const existing = documentsById.get(document.id);

    if (existing && existing.knowledge_base_id !== document.knowledge_base_id) {
      removeFromIndex({
        index: documentsByKnowledgeBaseId,
        key: existing.knowledge_base_id,
        id: document.id
      });
    }

    documentsById.set(document.id, clone(document));
    upsertInIndex({
      index: documentsByKnowledgeBaseId,
      key: document.knowledge_base_id,
      value: document
    });
  }

  function saveChunk(chunk) {
    const existing = chunksById.get(chunk.id);

    if (existing && existing.knowledge_base_id !== chunk.knowledge_base_id) {
      removeFromIndex({
        index: chunksByKnowledgeBaseId,
        key: existing.knowledge_base_id,
        id: chunk.id
      });
    }

    if (existing && existing.document_id !== chunk.document_id) {
      removeFromIndex({
        index: chunksByDocumentId,
        key: existing.document_id,
        id: chunk.id
      });
    }

    chunksById.set(chunk.id, clone(chunk));
    upsertInIndex({
      index: chunksByKnowledgeBaseId,
      key: chunk.knowledge_base_id,
      value: chunk
    });
    upsertInIndex({
      index: chunksByDocumentId,
      key: chunk.document_id,
      value: chunk
    });
  }
}

function upsertInIndex({
  index,
  key,
  value
}) {
  const values = index.get(key) ?? [];
  const withoutDuplicate = values.filter((entry) => entry.id !== value.id);

  index.set(key, [...withoutDuplicate, clone(value)]);
}

function removeFromIndex({
  index,
  key,
  id
}) {
  const values = index.get(key) ?? [];

  index.set(key, values.filter((entry) => entry.id !== id));
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
