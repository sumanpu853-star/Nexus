import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  WorkflowQueuePolicyValidationError
} from "../domain/workflowQueuePolicy.js";

export function createWorkflowQueueHttpHandler({
  workflowQueueService
} = {}) {
  assertWorkflowQueueService(workflowQueueService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "workflow-queue" &&
          segments[1] === "jobs"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            jobs: await workflowQueueService.listJobs({
              actor: request.actor,
              status: query.status ?? null,
              type: query.type ?? null
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "workflow-queue" &&
          segments[1] === "summary"
        ) {
          return jsonResponse(200, {
            summary: await workflowQueueService.getQueueSummary({
              actor: request.actor
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "workflow-queue" &&
          segments[1] === "jobs" &&
          segments[2] === "lease"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            job: await workflowQueueService.leaseNextJob({
              actor: request.actor,
              worker_id: body.worker_id,
              type: body.type,
              lease_duration_ms: body.lease_duration_ms
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 4 &&
          segments[0] === "workflow-queue" &&
          segments[1] === "jobs" &&
          segments[3] === "complete"
        ) {
          return jsonResponse(200, {
            job: await workflowQueueService.completeJob({
              actor: request.actor,
              job_id: segments[2]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 4 &&
          segments[0] === "workflow-queue" &&
          segments[1] === "jobs" &&
          segments[3] === "fail"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            job: await workflowQueueService.failJob({
              actor: request.actor,
              job_id: segments[2],
              error: body.error,
              retry_delay_ms: body.retry_delay_ms
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

function assertWorkflowQueueService(workflowQueueService) {
  for (const method of [
    "listJobs",
    "getQueueSummary",
    "leaseNextJob",
    "completeJob",
    "failJob"
  ]) {
    if (!workflowQueueService || typeof workflowQueueService[method] !== "function") {
      throw new TypeError(
        `createWorkflowQueueHttpHandler requires workflowQueueService.${method}().`
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

  if (error instanceof TypeError || error instanceof WorkflowQueuePolicyValidationError) {
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
