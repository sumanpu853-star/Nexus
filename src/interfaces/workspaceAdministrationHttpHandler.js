import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createWorkspaceAdministrationHttpHandler({
  workspaceAdministrationService
} = {}) {
  assertService(workspaceAdministrationService, "workspaceAdministrationService", [
    "createWorkspace",
    "addWorkspaceMember",
    "linkProjectToWorkspace",
    "listWorkspaceProjects",
    "listWorkspaceMembers"
  ]);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (method === "POST" && segments.length === 1 && segments[0] === "workspaces") {
          const body = normalizeBody(request.body);

          return jsonResponse(201, await workspaceAdministrationService.createWorkspace({
            actor: request.actor,
            name: body.name
          }));
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workspaces" &&
          segments[2] === "members"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            membership: await workspaceAdministrationService.addWorkspaceMember({
              actor: request.actor,
              workspace_id: segments[1],
              user_id: body.user_id,
              role: body.role
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workspaces" &&
          segments[2] === "members"
        ) {
          return jsonResponse(200, {
            memberships: await workspaceAdministrationService.listWorkspaceMembers({
              actor: request.actor,
              workspace_id: segments[1]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workspaces" &&
          segments[2] === "projects"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            link: await workspaceAdministrationService.linkProjectToWorkspace({
              actor: request.actor,
              workspace_id: segments[1],
              project_id: body.project_id
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workspaces" &&
          segments[2] === "projects"
        ) {
          return jsonResponse(200, {
            projects: await workspaceAdministrationService.listWorkspaceProjects({
              actor: request.actor,
              workspace_id: segments[1]
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
        `createWorkspaceAdministrationHttpHandler requires ${name}.${method}().`
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
