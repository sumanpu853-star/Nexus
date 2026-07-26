export function createBuilderHttpHandler({
  nodeCatalogService,
  workflowTemplateService
} = {}) {
  assertServiceMethod(nodeCatalogService, "nodeCatalogService", "listNodeFormDefinitions");
  assertServiceMethod(workflowTemplateService, "workflowTemplateService", "listWorkflowTemplates");
  assertServiceMethod(workflowTemplateService, "workflowTemplateService", "createWorkflowDraft");

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const path = normalizePath(request.path);

      try {
        if (method === "GET" && path === "/builder/node-forms") {
          return jsonResponse(200, {
            forms: await nodeCatalogService.listNodeFormDefinitions()
          });
        }

        if (method === "GET" && path === "/workflow-templates") {
          return jsonResponse(200, {
            templates: await workflowTemplateService.listWorkflowTemplates()
          });
        }

        if (method === "POST" && path === "/workflow-templates/draft") {
          return jsonResponse(
            200,
            await workflowTemplateService.createWorkflowDraft(normalizeBody(request.body))
          );
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

function assertServiceMethod(service, serviceName, method) {
  if (!service || typeof service[method] !== "function") {
    throw new TypeError(`createBuilderHttpHandler requires ${serviceName}.${method}().`);
  }
}

function normalizeBody(body) {
  if (body === undefined || body === null) {
    return {};
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TypeError("Request body must be an object.");
  }

  return body;
}

function resolveErrorStatus(error) {
  if (error instanceof TypeError || typeof error.code === "string") {
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

function normalizeMethod(method) {
  return typeof method === "string" && method.trim() !== ""
    ? method.trim().toUpperCase()
    : "GET";
}

function normalizePath(path) {
  return typeof path === "string" && path.trim() !== ""
    ? path.trim()
    : "/";
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
