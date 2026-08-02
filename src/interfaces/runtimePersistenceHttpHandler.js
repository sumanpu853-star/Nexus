import {
  DurablePersistencePolicyValidationError
} from "../domain/durablePersistencePolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createRuntimePersistenceHttpHandler({
  runtimePersistenceService
} = {}) {
  assertRuntimePersistenceService(runtimePersistenceService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "runtime-persistence" &&
          segments[1] === "ports"
        ) {
          return jsonResponse(200, {
            ports: await runtimePersistenceService.listRepositoryPorts({
              actor: request.actor
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "runtime-persistence" &&
          segments[1] === "migrations"
        ) {
          return jsonResponse(200, {
            migrations: await runtimePersistenceService.listMigrations({
              actor: request.actor
            })
          });
        }

        if (
          method === "PUT" &&
          segments.length === 3 &&
          segments[0] === "runtime-persistence" &&
          segments[1] === "migrations"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            migration: await runtimePersistenceService.recordMigration({
              actor: request.actor,
              version: segments[2],
              name: body.name,
              checksum: body.checksum,
              status: body.status,
              applied_at: body.applied_at,
              error: body.error
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "runtime-persistence" &&
          segments[1] === "readiness"
        ) {
          return jsonResponse(200, {
            readiness: await runtimePersistenceService.getDurablePersistenceReadiness({
              actor: request.actor
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

function assertRuntimePersistenceService(runtimePersistenceService) {
  for (const method of [
    "listRepositoryPorts",
    "recordMigration",
    "listMigrations",
    "getDurablePersistenceReadiness"
  ]) {
    if (
      !runtimePersistenceService ||
      typeof runtimePersistenceService[method] !== "function"
    ) {
      throw new TypeError(
        `createRuntimePersistenceHttpHandler requires runtimePersistenceService.${method}().`
      );
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

  if (error instanceof TypeError || error instanceof DurablePersistencePolicyValidationError) {
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
