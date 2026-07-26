export function createNodeCatalogHttpHandler({
  nodeCatalogService
} = {}) {
  if (!nodeCatalogService || typeof nodeCatalogService.listNodeDefinitions !== "function") {
    throw new TypeError("createNodeCatalogHttpHandler requires nodeCatalogService.listNodeDefinitions().");
  }

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const path = normalizePath(request.path);

      if (method === "GET" && path === "/nodes") {
        return jsonResponse(200, {
          nodes: await nodeCatalogService.listNodeDefinitions()
        });
      }

      return jsonResponse(404, {
        error: {
          code: "not_found",
          message: "Route not found."
        }
      });
    }
  });
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
