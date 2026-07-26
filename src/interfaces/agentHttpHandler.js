import {
  AgentPolicyValidationError
} from "../domain/agentPolicy.js";
import {
  AuthorizationError
} from "../domain/securityPolicy.js";

export function createAgentHttpHandler({
  agentService
} = {}) {
  assertAgentService(agentService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const segments = normalizePathSegments(request.path);

      try {
        if (method === "GET" && segments.length === 1 && segments[0] === "agents") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            agents: await agentService.listAgents({
              actor: request.actor,
              project_id: query.project_id
            })
          });
        }

        if (method === "POST" && segments.length === 1 && segments[0] === "agents") {
          const body = normalizeBody(request.body);

          return jsonResponse(201, await agentService.createAgent({
            actor: request.actor,
            project_id: body.project_id,
            name: body.name,
            description: body.description,
            instructions: body.instructions,
            model: body.model,
            memory: body.memory,
            tools: body.tools
          }));
        }

        if (method === "GET" && segments.length === 2 && segments[0] === "agents") {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            agent: await agentService.getAgent({
              actor: request.actor,
              project_id: query.project_id,
              agent_id: segments[1]
            })
          });
        }

        if (
          method === "PATCH" &&
          segments.length === 3 &&
          segments[0] === "agents" &&
          segments[2] === "prompt"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(200, await agentService.updateAgentPrompt({
            actor: request.actor,
            project_id: body.project_id,
            agent_id: segments[1],
            instructions: body.instructions,
            model: body.model,
            memory: body.memory,
            tools: body.tools
          }));
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "agents" &&
          segments[2] === "prompt-versions"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            prompt_versions: await agentService.listAgentPromptVersions({
              actor: request.actor,
              project_id: query.project_id,
              agent_id: segments[1]
            })
          });
        }

        if (
          method === "POST" &&
          segments.length === 3 &&
          segments[0] === "agents" &&
          segments[2] === "runs"
        ) {
          const body = normalizeBody(request.body);

          return jsonResponse(201, {
            run: await agentService.runAgent({
              actor: request.actor,
              project_id: body.project_id,
              agent_id: segments[1],
              input: body.input,
              session_id: body.session_id
            })
          });
        }

        if (
          method === "GET" &&
          segments.length === 3 &&
          segments[0] === "agents" &&
          segments[2] === "runs"
        ) {
          const query = normalizeQuery(request.query);

          return jsonResponse(200, {
            runs: await agentService.listAgentRuns({
              actor: request.actor,
              project_id: query.project_id,
              agent_id: segments[1]
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

function assertAgentService(agentService) {
  for (const method of [
    "createAgent",
    "listAgents",
    "getAgent",
    "updateAgentPrompt",
    "listAgentPromptVersions",
    "runAgent",
    "listAgentRuns"
  ]) {
    if (!agentService || typeof agentService[method] !== "function") {
      throw new TypeError(`createAgentHttpHandler requires agentService.${method}().`);
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

  if (error instanceof TypeError || error instanceof AgentPolicyValidationError) {
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
