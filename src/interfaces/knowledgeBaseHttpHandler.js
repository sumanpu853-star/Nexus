import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  KnowledgeBaseValidationError
} from "../domain/knowledgeBasePolicy.js";

export function createKnowledgeBaseHttpHandler({
  knowledgeBaseService
} = {}) {
  assertKnowledgeBaseService(knowledgeBaseService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "knowledge-bases"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            knowledge_bases: await knowledgeBaseService.listKnowledgeBases({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 1 &&
          segments[0] === "knowledge-bases"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            knowledge_base: await knowledgeBaseService.createKnowledgeBase({
              actor: request.actor,
              project_id: body.project_id,
              name: body.name,
              description: body.description,
              embedding_model: body.embedding_model,
              chunking: body.chunking
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "knowledge-bases" &&
          segments[2] === "documents"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, await knowledgeBaseService.ingestKnowledgeDocument({
            actor: request.actor,
            project_id: body.project_id,
            knowledge_base_id: segments[1],
            title: body.title,
            content: body.content,
            source_type: body.source_type,
            source_uri: body.source_uri,
            metadata: body.metadata,
            write_mode: body.write_mode
          }));
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "knowledge-bases" &&
          segments[2] === "search"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            search: await knowledgeBaseService.searchKnowledgeBase({
              actor: request.actor,
              project_id: body.project_id,
              knowledge_base_id: segments[1],
              query: body.query,
              limit: body.limit,
              filters: body.filters,
              rerank: body.rerank
            })
          });
        }

        return jsonResponse(404, {
          error: {
            code: "not_found",
            message: "Route not found."
          }
        });
      } catch (error) {
        return jsonResponse(resolveErrorStatus(error), {
          error: {
            code: error.code ?? "bad_request",
            message: error.message
          }
        });
      }
    }
  });
}

function assertKnowledgeBaseService(knowledgeBaseService) {
  for (const method of [
    "createKnowledgeBase",
    "listKnowledgeBases",
    "ingestKnowledgeDocument",
    "searchKnowledgeBase"
  ]) {
    if (!knowledgeBaseService || typeof knowledgeBaseService[method] !== "function") {
      throw new TypeError(`createKnowledgeBaseHttpHandler requires knowledgeBaseService.${method}().`);
    }
  }
}

function normalizeBody(body) {
  if (body === undefined || body === null) {
    return {};
  }

  if (!isPlainObject(body)) {
    throw new TypeError("Request body must be an object.");
  }

  return body;
}

function normalizeQuery(query) {
  if (query === undefined || query === null) {
    return {};
  }

  if (!isPlainObject(query)) {
    throw new TypeError("Request query must be an object.");
  }

  return query;
}

function normalizeMethod(method) {
  return typeof method === "string" && method.trim() !== ""
    ? method.trim().toUpperCase()
    : "GET";
}

function normalizePathSegments(path) {
  const normalizedPath = typeof path === "string" && path.trim() !== ""
    ? path.trim()
    : "/";

  return normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

function resolveErrorStatus(error) {
  if (error instanceof AuthorizationError) {
    return 403;
  }

  if (error instanceof TypeError || error instanceof KnowledgeBaseValidationError) {
    return 400;
  }

  return 500;
}

function jsonResponse(status, body) {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": "application/json; charset=utf-8"
    }),
    body: deepFreeze(body)
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
