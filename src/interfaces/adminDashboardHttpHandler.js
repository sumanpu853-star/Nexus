import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createAdminDashboardHttpHandler({
  adminDashboardService,
  auditLogService
} = {}) {
  assertService(adminDashboardService, "adminDashboardService", [
    "getAdminDashboard"
  ]);
  assertService(auditLogService, "auditLogService", [
    "recordAuditEvent",
    "listAuditEvents"
  ]);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "admin-dashboard"
        ) {
          return jsonResponse(200, {
            dashboard: await adminDashboardService.getAdminDashboard({
              actor: request.actor
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "audit-events"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            events: await auditLogService.listAuditEvents({
              actor: request.actor,
              project_id: query.project_id ?? null,
              workspace_id: query.workspace_id ?? null,
              actor_id: query.actor_id ?? null,
              action: query.action ?? null,
              status: query.status ?? null,
              limit: query.limit ?? 50
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 1 &&
          segments[0] === "audit-events"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            event: await auditLogService.recordAuditEvent({
              actor: request.actor,
              action: body.action,
              status: body.status,
              project_id: body.project_id ?? null,
              workspace_id: body.workspace_id ?? null,
              resource_type: body.resource_type,
              resource_id: body.resource_id,
              metadata: body.metadata ?? {}
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

function assertService(service, name, methods) {
  for (const method of methods) {
    if (!service || typeof service[method] !== "function") {
      throw new TypeError(
        `createAdminDashboardHttpHandler requires ${name}.${method}().`
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

  if (error instanceof TypeError) {
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
