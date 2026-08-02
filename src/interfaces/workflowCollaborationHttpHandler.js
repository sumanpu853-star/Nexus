import {
  WorkflowCollaborationValidationError
} from "../domain/workflowCollaborationPolicy.js";
import {
  WorkflowTemplateValidationError
} from "../domain/workflowTemplatePolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createWorkflowCollaborationHttpHandler({
  workflowCollaborationService
} = {}) {
  assertService(workflowCollaborationService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "POST" &&
          segments.length === 2 &&
          segments[0] === "workflows" &&
          segments[1] === "import-package"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            import_result:
              await workflowCollaborationService.importWorkflowCollaborationPackage({
                actor: request.actor,
                project_id: body.project_id,
                package_data: body.package_data,
                name: body.name ?? null,
                include_comments: normalizeBooleanFlag(
                  body.include_comments,
                  true
                ),
                include_templates: normalizeBooleanFlag(
                  body.include_templates,
                  true
                )
              })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "workflow-collaboration" &&
          segments[1] === "templates"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            templates:
              await workflowCollaborationService.listWorkflowCollaborationTemplates({
                actor: request.actor,
                project_id: query.project_id,
                workflow_id: query.workflow_id ?? null
              })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "versions"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            versions: await workflowCollaborationService.listWorkflowVersions({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "versions"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            version: await workflowCollaborationService.createWorkflowVersion({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: segments[1],
              change_summary: body.change_summary ?? ""
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 4 &&
          segments[0] === "workflows" &&
          segments[2] === "versions" &&
          segments[3] === "compare"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            comparison: await workflowCollaborationService.compareWorkflowVersions({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1],
              left_version: query.left_version,
              right_version: query.right_version
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 5 &&
          segments[0] === "workflows" &&
          segments[2] === "versions" &&
          segments[4] === "restore"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            restore_result:
              await workflowCollaborationService.restoreWorkflowVersion({
                actor: request.actor,
                project_id: body.project_id,
                workflow_id: segments[1],
                version: segments[3],
                change_summary: body.change_summary ?? ""
              })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "comments"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            comments: await workflowCollaborationService.listWorkflowComments({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1],
              version: query.version ?? null,
              node_id: query.node_id ?? null,
              status: query.status ?? null,
              limit: query.limit === undefined ? 100 : Number(query.limit)
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "comments"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            comment: await workflowCollaborationService.addWorkflowComment({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: segments[1],
              version: body.version ?? null,
              node_id: body.node_id ?? null,
              body: body.body,
              metadata: body.metadata ?? {}
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 5 &&
          segments[0] === "workflows" &&
          segments[2] === "comments" &&
          segments[4] === "resolve"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            comment: await workflowCollaborationService.resolveWorkflowComment({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: segments[1],
              comment_id: segments[3]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "templates"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            template:
              await workflowCollaborationService.createWorkflowTemplateFromVersion({
                actor: request.actor,
                project_id: body.project_id,
                workflow_id: segments[1],
                version: body.version,
                template_id: body.template_id ?? null,
                name: body.name,
                description: body.description ?? "",
                tags: body.tags ?? []
              })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "export-package"
        ) {
          const query = normalizeBody(request.query);

          return jsonResponse(200, {
            package_data:
              await workflowCollaborationService.exportWorkflowCollaborationPackage({
                actor: request.actor,
                project_id: query.project_id,
                workflow_id: segments[1],
                include_comments: normalizeBooleanFlag(
                  query.include_comments,
                  true
                ),
                include_templates: normalizeBooleanFlag(
                  query.include_templates,
                  true
                )
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

function assertService(service) {
  for (const method of [
    "createWorkflowVersion",
    "listWorkflowVersions",
    "compareWorkflowVersions",
    "restoreWorkflowVersion",
    "addWorkflowComment",
    "listWorkflowComments",
    "resolveWorkflowComment",
    "createWorkflowTemplateFromVersion",
    "listWorkflowCollaborationTemplates",
    "exportWorkflowCollaborationPackage",
    "importWorkflowCollaborationPackage"
  ]) {
    if (!service || typeof service[method] !== "function") {
      throw new TypeError(
        `createWorkflowCollaborationHttpHandler requires workflowCollaborationService.${method}().`
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

function normalizeBooleanFlag(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  throw new TypeError("Boolean flags must be boolean values.");
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

  if (
    error instanceof TypeError ||
    error instanceof WorkflowCollaborationValidationError ||
    error instanceof WorkflowTemplateValidationError
  ) {
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
