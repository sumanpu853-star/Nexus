import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  WorkflowExecutionValidationError
} from "../domain/workflowExecutionPolicy.js";

export function createExecutionHttpHandler({
  workflowExecutionService
} = {}) {
  assertExecutionService(workflowExecutionService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (
          method === "GET" &&
          segments.length === 4 &&
          segments[0] === "workflows" &&
          segments[2] === "executions" &&
          segments[3] === "dashboard"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            dashboard: await workflowExecutionService.getWorkflowExecutionDashboard({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1],
              filters: {
                status: query.status,
                trigger_source: query.trigger_source,
                mode: query.mode,
                started_by: query.started_by,
                node_id: query.node_id,
                since: query.since,
                until: query.until
              }
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 4 &&
          segments[0] === "workflows" &&
          segments[2] === "executions" &&
          segments[3] === "observability"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            observability: await workflowExecutionService.getWorkflowExecutionObservability({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1]
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "workflows" &&
          segments[2] === "executions"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            history: await workflowExecutionService.listWorkflowExecutionHistory({
              actor: request.actor,
              project_id: query.project_id,
              workflow_id: segments[1],
              status: query.status,
              trigger_source: query.trigger_source,
              started_by: query.started_by,
              limit: query.limit,
              cursor: query.cursor
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 2 &&
          segments[0] === "executions"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            execution: await workflowExecutionService.getWorkflowExecution({
              actor: request.actor,
              project_id: query.project_id,
              execution_id: segments[1]
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "executions" &&
          segments[2] === "timeline"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            timeline: await workflowExecutionService.getWorkflowExecutionTimeline({
              actor: request.actor,
              project_id: query.project_id,
              execution_id: segments[1]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 5 &&
          segments[0] === "executions" &&
          segments[2] === "node-runs" &&
          segments[4] === "result"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, {
            execution: await workflowExecutionService.recordNodeRunResult({
              actor: request.actor,
              project_id: body.project_id,
              execution_id: segments[1],
              node_id: segments[3],
              status: body.status,
              attempt: body.attempt,
              input: body.input,
              output: body.output,
              error: body.error,
              usage: body.usage,
              cost: body.cost,
              trace: body.trace,
              secretValues: body.secretValues
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 5 &&
          segments[0] === "executions" &&
          segments[2] === "node-runs" &&
          segments[4] === "logs"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            execution: await workflowExecutionService.recordNodeRunLog({
              actor: request.actor,
              project_id: body.project_id,
              execution_id: segments[1],
              node_id: segments[3],
              attempt: body.attempt,
              level: body.level,
              message: body.message,
              metadata: body.metadata,
              secretValues: body.secretValues
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "executions" &&
          segments[2] === "rerun"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            execution: await workflowExecutionService.queuePartialWorkflowExecution({
              actor: request.actor,
              project_id: body.project_id,
              workflow_id: body.workflow_id,
              source_execution_id: segments[1],
              from_node_id: body.from_node_id,
              input: body.input,
              secretValues: body.secretValues,
              metadata: body.metadata
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

function assertExecutionService(workflowExecutionService) {
  for (const method of [
    "getWorkflowExecution",
    "getWorkflowExecutionDashboard",
    "getWorkflowExecutionObservability",
    "getWorkflowExecutionTimeline",
    "listWorkflowExecutionHistory",
    "queuePartialWorkflowExecution",
    "recordNodeRunResult",
    "recordNodeRunLog"
  ]) {
    if (!workflowExecutionService || typeof workflowExecutionService[method] !== "function") {
      throw new TypeError(`createExecutionHttpHandler requires workflowExecutionService.${method}().`);
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

  if (error instanceof TypeError || error instanceof WorkflowExecutionValidationError) {
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
