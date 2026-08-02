import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  WorkflowExecutionValidationError
} from "../domain/workflowExecutionPolicy.js";
import {
  WorkflowQueuePolicyValidationError
} from "../domain/workflowQueuePolicy.js";

export function createWorkflowExecutionWorkerHttpHandler({
  workflowExecutionWorkerService
} = {}) {
  assertWorkflowExecutionWorkerService(workflowExecutionWorkerService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "POST" &&
          segments.length === 2 &&
          segments[0] === "workflow-workers" &&
          segments[1] === "run-next"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            run: await workflowExecutionWorkerService.runNextWorkflowExecution({
              actor: request.actor,
              worker_id: body.worker_id
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 2 &&
          segments[0] === "workflow-workers" &&
          segments[1] === "run-until-idle"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            result: await workflowExecutionWorkerService.runWorkflowExecutionsUntilIdle({
              actor: request.actor,
              worker_id: body.worker_id,
              limit: body.limit
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

function assertWorkflowExecutionWorkerService(workflowExecutionWorkerService) {
  for (const method of [
    "runNextWorkflowExecution",
    "runWorkflowExecutionsUntilIdle"
  ]) {
    if (
      !workflowExecutionWorkerService ||
      typeof workflowExecutionWorkerService[method] !== "function"
    ) {
      throw new TypeError(
        `createWorkflowExecutionWorkerHttpHandler requires workflowExecutionWorkerService.${method}().`
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

  if (
    error instanceof TypeError ||
    error instanceof WorkflowQueuePolicyValidationError ||
    error instanceof WorkflowExecutionValidationError
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
