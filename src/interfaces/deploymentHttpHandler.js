import {
  DeploymentPolicyValidationError
} from "../domain/deploymentPolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createDeploymentHttpHandler({
  deploymentService
} = {}) {
  assertDeploymentService(deploymentService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "deployment-environments"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            environments: await deploymentService.listEnvironments({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (
          method === "PUT" &&
          segments.length === 2 &&
          segments[0] === "deployment-environments"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            environment: await deploymentService.upsertEnvironment({
              actor: request.actor,
              project_id: body.project_id,
              environment: segments[1],
              variables: body.variables
            })
          });
        }

        if (method === "GET" && segments.length === 1 && segments[0] === "deployments") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            deployments: await deploymentService.listDeployments({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "deployments" &&
          segments[1] === "active"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            deployment: await deploymentService.getActiveDeployment({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: query.workflow_id,
              environment: query.environment
            })
          });
        }

        if (method === "POST" && segments.length === 1 && segments[0] === "deployments") {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            deployment: await deploymentService.publishWorkflow({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: body.workflow_id,
              environment: body.environment,
              version: body.version
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "deployments" &&
          segments[2] === "disable"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            deployment: await deploymentService.disableDeployment({
              actor: request.actor,
              project_id: body.project_id,
              deployment_id: segments[1]
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

function assertDeploymentService(deploymentService) {
  for (const method of [
    "upsertEnvironment",
    "listEnvironments",
    "publishWorkflow",
    "listDeployments",
    "getActiveDeployment",
    "disableDeployment"
  ]) {
    if (!deploymentService || typeof deploymentService[method] !== "function") {
      throw new TypeError(`createDeploymentHttpHandler requires deploymentService.${method}().`);
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

  if (error instanceof TypeError || error instanceof DeploymentPolicyValidationError) {
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
