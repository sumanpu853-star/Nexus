import {
  ProductionAdapterPolicyValidationError
} from "../domain/productionAdapterPolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createProductionAdapterHttpHandler({
  productionAdapterService
} = {}) {
  assertProductionAdapterService(productionAdapterService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "production-adapters"
        ) {
          return jsonResponse(200, {
            definitions: await productionAdapterService.listAdapterDefinitions({
              actor: request.actor
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "production-adapter-configs"
        ) {
          return jsonResponse(200, {
            configs: await productionAdapterService.listAdapterConfigs({
              actor: request.actor
            })
          });
        }

        if (
          method === "PUT" &&
          segments.length === 2 &&
          segments[0] === "production-adapter-configs"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            config: await productionAdapterService.upsertAdapterConfig({
              actor: request.actor,
              adapter_type: segments[1],
              provider: body.provider,
              status: body.status,
              endpoint: body.endpoint,
              settings: body.settings,
              secret_ref: body.secret_ref,
              capabilities: body.capabilities
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "production-adapter-configs" &&
          segments[2] === "health-checks"
        ) {
          return jsonResponse(201, {
            health_check: await productionAdapterService.checkAdapterHealth({
              actor: request.actor,
              adapter_type: segments[1]
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "production-readiness"
        ) {
          return jsonResponse(200, {
            readiness: await productionAdapterService.getProductionReadiness({
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

function assertProductionAdapterService(productionAdapterService) {
  for (const method of [
    "listAdapterDefinitions",
    "upsertAdapterConfig",
    "listAdapterConfigs",
    "checkAdapterHealth",
    "getProductionReadiness"
  ]) {
    if (
      !productionAdapterService ||
      typeof productionAdapterService[method] !== "function"
    ) {
      throw new TypeError(
        `createProductionAdapterHttpHandler requires productionAdapterService.${method}().`
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

  if (error instanceof TypeError || error instanceof ProductionAdapterPolicyValidationError) {
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
