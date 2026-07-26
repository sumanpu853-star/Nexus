import {
  PROJECT_PERMISSIONS,
  assertProjectPermission
} from "../domain/securityPolicy.js";
import {
  VECTOR_WRITE_MODES,
  chunkKnowledgeDocument,
  createKnowledgeBaseRecord,
  createKnowledgeChunkRecord,
  createKnowledgeDocumentRecord,
  createKnowledgeSearchResult,
  normalizeVectorWriteMode,
  rerankKnowledgeSearchResults
} from "../domain/knowledgeBasePolicy.js";

export function createKnowledgeBaseService({
  projectRepository,
  membershipRepository,
  knowledgeBaseRepository,
  knowledgeDocumentRepository,
  knowledgeChunkRepository,
  vectorIndex,
  embeddingProvider,
  reranker = null,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(knowledgeBaseRepository, "knowledgeBaseRepository", [
    "findById",
    "findByProjectId",
    "save"
  ]);
  assertRepository(knowledgeDocumentRepository, "knowledgeDocumentRepository", [
    "findById",
    "findByKnowledgeBaseId",
    "save"
  ]);
  assertRepository(knowledgeChunkRepository, "knowledgeChunkRepository", [
    "findById",
    "findByKnowledgeBaseId",
    "findByDocumentId",
    "saveMany"
  ]);
  assertRepository(vectorIndex, "vectorIndex", ["writeVectors", "search"]);
  assertRepository(embeddingProvider, "embeddingProvider", ["embedDocuments", "embedQuery"]);

  if (reranker !== null) {
    assertRepository(reranker, "reranker", ["rerank"]);
  }

  return Object.freeze({
    async createKnowledgeBase({
      actor,
      project_id,
      name,
      description = "",
      embedding_model,
      chunking = {}
    } = {}) {
      const { actorId, project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES
      });
      const timestamp = nowIso(clock);
      const knowledgeBase = createKnowledgeBaseRecord({
        id: nextId(idGenerator, "knowledge_base"),
        project_id: project.id,
        owner_id: actorId,
        name,
        description,
        embedding_model,
        chunking,
        created_at: timestamp,
        updated_at: timestamp
      });

      return knowledgeBaseRepository.save(knowledgeBase);
    },

    async listKnowledgeBases({
      actor,
      project_id
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES
      });

      return knowledgeBaseRepository.findByProjectId(project.id);
    },

    async ingestKnowledgeDocument({
      actor,
      project_id,
      knowledge_base_id,
      title,
      content,
      source_type,
      source_uri = "",
      metadata = {},
      write_mode = VECTOR_WRITE_MODES.UPSERT
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.MANAGE_KNOWLEDGE_BASES
      });
      const knowledgeBase = await requireKnowledgeBase({
        knowledgeBaseRepository,
        knowledge_base_id,
        project_id: project.id
      });
      const normalizedWriteMode = normalizeVectorWriteMode(write_mode);
      const timestamp = nowIso(clock);
      const documentId = nextId(idGenerator, "knowledge_document");
      const document = createKnowledgeDocumentRecord({
        id: documentId,
        knowledge_base_id: knowledgeBase.id,
        project_id: project.id,
        title,
        source_type,
        source_uri,
        content_hash: createContentHash(content),
        metadata,
        created_at: timestamp,
        updated_at: timestamp
      });
      const chunkDrafts = chunkKnowledgeDocument({
        content,
        chunking: knowledgeBase.chunking,
        metadata
      });
      const chunks = chunkDrafts.map((chunk) => {
        const chunkId = nextId(idGenerator, "knowledge_chunk");

        return createKnowledgeChunkRecord({
          id: chunkId,
          knowledge_base_id: knowledgeBase.id,
          document_id: document.id,
          project_id: project.id,
          ordinal: chunk.ordinal,
          text: chunk.text,
          token_count: chunk.token_count,
          content_hash: createContentHash(chunk.text),
          metadata: {
            ...chunk.metadata,
            title: document.title,
            source_uri: document.source_uri,
            source_type: document.source_type
          },
          embedding_ref: chunkId,
          created_at: timestamp
        });
      });
      const embeddingResponse = await embeddingProvider.embedDocuments({
        texts: chunks.map((chunk) => chunk.text),
        model: knowledgeBase.embedding_model
      });

      assertEmbeddingCount({
        embeddings: embeddingResponse.embeddings,
        expected: chunks.length
      });

      await knowledgeDocumentRepository.save(document);
      await knowledgeChunkRepository.saveMany(chunks);
      await vectorIndex.writeVectors({
        knowledge_base_id: knowledgeBase.id,
        mode: normalizedWriteMode,
        vectors: chunks.map((chunk, index) => ({
          id: chunk.embedding_ref,
          knowledge_base_id: chunk.knowledge_base_id,
          document_id: chunk.document_id,
          chunk_id: chunk.id,
          project_id: chunk.project_id,
          text: chunk.text,
          embedding: embeddingResponse.embeddings[index],
          metadata: chunk.metadata
        }))
      });

      return Object.freeze({
        document,
        chunks: Object.freeze(chunks)
      });
    },

    async searchKnowledgeBase({
      actor,
      project_id,
      knowledge_base_id,
      query,
      limit = 10,
      filters = {},
      rerank = true
    } = {}) {
      const { project } = await authorizeProjectAction({
        actor,
        projectRepository,
        membershipRepository,
        project_id,
        permission: PROJECT_PERMISSIONS.READ_KNOWLEDGE_BASES
      });
      const knowledgeBase = await requireKnowledgeBase({
        knowledgeBaseRepository,
        knowledge_base_id,
        project_id: project.id
      });
      const normalizedLimit = normalizePositiveInteger(limit, "Knowledge search limit");
      const embeddingResponse = await embeddingProvider.embedQuery({
        text: query,
        model: knowledgeBase.embedding_model
      });
      const candidateLimit = rerank
        ? Math.min(normalizedLimit * 3, 50)
        : normalizedLimit;
      const matches = await vectorIndex.search({
        knowledge_base_id: knowledgeBase.id,
        embedding: embeddingResponse.embedding,
        limit: candidateLimit,
        filters
      });
      const results = await createSearchResults({
        matches,
        knowledgeDocumentRepository
      });
      const rankedResults = rerank
        ? await rerankResults({
          query,
          results,
          limit: normalizedLimit,
          reranker
        })
        : results.slice(0, normalizedLimit);

      return Object.freeze({
        query,
        knowledge_base_id: knowledgeBase.id,
        results: Object.freeze(rankedResults)
      });
    }
  });
}

async function createSearchResults({
  matches,
  knowledgeDocumentRepository
}) {
  return Promise.all(
    matches.map(async (match) => {
      const document = await knowledgeDocumentRepository.findById(match.document_id);

      return createKnowledgeSearchResult({
        knowledge_base_id: match.knowledge_base_id,
        document_id: match.document_id,
        chunk_id: match.chunk_id,
        text: match.text,
        score: match.score,
        metadata: match.metadata,
        source: {
          title: document?.title ?? match.metadata.title ?? "",
          uri: document?.source_uri ?? match.metadata.source_uri ?? "",
          type: document?.source_type ?? match.metadata.source_type ?? ""
        }
      });
    })
  );
}

async function rerankResults({
  query,
  results,
  limit,
  reranker
}) {
  if (reranker) {
    return reranker.rerank({
      query,
      results,
      limit
    });
  }

  return rerankKnowledgeSearchResults({
    query,
    results,
    limit
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
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new TypeError("Project id must be a non-empty string.");
  }

  const project = await projectRepository.findById(projectId.trim());

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

async function requireKnowledgeBase({
  knowledgeBaseRepository,
  knowledge_base_id,
  project_id
}) {
  if (typeof knowledge_base_id !== "string" || knowledge_base_id.trim() === "") {
    throw new TypeError("Knowledge base id must be a non-empty string.");
  }

  const knowledgeBase = await knowledgeBaseRepository.findById(knowledge_base_id.trim());

  if (!knowledgeBase || knowledgeBase.project_id !== project_id) {
    throw new TypeError("Knowledge base was not found in this project.");
  }

  return knowledgeBase;
}

function assertEmbeddingCount({
  embeddings,
  expected
}) {
  if (!Array.isArray(embeddings) || embeddings.length !== expected) {
    throw new TypeError("Embedding provider returned the wrong number of embeddings.");
  }
}

function createContentHash(value) {
  const normalized = normalizeRequiredString(value, "Knowledge content");
  let hash = 2166136261;

  for (const char of normalized) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Knowledge base operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createKnowledgeBaseService requires ${name}.${method}().`);
    }
  }
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createKnowledgeBaseService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}
