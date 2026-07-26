import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  IntegrationPolicyValidationError
} from "../domain/integrationPolicy.js";

export function createIntegrationHttpHandler({
  integrationService
} = {}) {
  assertIntegrationService(integrationService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (method === "GET" && segments.length === 1 && segments[0] === "integrations") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            integrations: await integrationService.listIntegrationDefinitions({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 1 &&
          segments[0] === "integration-connections"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            connections: await integrationService.listConnections({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 1 &&
          segments[0] === "integration-connections"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            connection: await integrationService.createConnection({
              actor: request.actor,
              project_id: body.project_id,
              integration_type: body.integration_type,
              name: body.name,
              credential_id: body.credential_id,
              settings: body.settings
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "integration-connections" &&
          segments[2] === "invoke"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            invocation: await integrationService.invokeIntegration({
              actor: request.actor,
              project_id: body.project_id,
              connection_id: segments[1],
              action: body.action,
              input: body.input
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "integration-connections" &&
          segments[2] === "invocations"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            invocations: await integrationService.listConnectionInvocations({
              actor: request.actor,
              project_id: query.project_id,
              connection_id: segments[1]
            })
          });
        }

        if (method === "GET" && segments.length === 1 && segments[0] === "webhooks") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            webhooks: await integrationService.listWebhooks({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (method === "POST" && segments.length === 1 && segments[0] === "webhooks") {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            webhook: await integrationService.registerWebhook({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: body.workflow_id,
              connection_id: body.connection_id,
              path: body.path,
              secret_ref: body.secret_ref,
              is_active: body.is_active
            })
          });
        }

        if (method === "GET" && segments.length === 1 && segments[0] === "schedules") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            schedules: await integrationService.listSchedules({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (method === "POST" && segments.length === 1 && segments[0] === "schedules") {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            schedule: await integrationService.registerSchedule({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: body.workflow_id,
              cron: body.cron,
              timezone: body.timezone,
              is_active: body.is_active
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

function assertIntegrationService(integrationService) {
  for (const method of [
    "listIntegrationDefinitions",
    "createConnection",
    "listConnections",
    "invokeIntegration",
    "listConnectionInvocations",
    "registerWebhook",
    "listWebhooks",
    "registerSchedule",
    "listSchedules"
  ]) {
    if (!integrationService || typeof integrationService[method] !== "function") {
      throw new TypeError(`createIntegrationHttpHandler requires integrationService.${method}().`);
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

  if (error instanceof TypeError || error instanceof IntegrationPolicyValidationError) {
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
