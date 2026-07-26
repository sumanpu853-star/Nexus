import { AuthenticationError } from "../domain/securityPolicy.js";

export function createAuthenticationHttpHandler({
  authenticationService
} = {}) {
  assertAuthenticationService(authenticationService);

  return Object.freeze({
    async handle(request = {}) {
      const method = normalizeMethod(request.method);
      const path = normalizePath(request.path);

      try {
        if (method === "POST" && path === "/auth/register") {
          return jsonResponse(
            201,
            await authenticationService.registerUser(normalizeBody(request.body))
          );
        }

        if (method === "POST" && path === "/auth/login") {
          return jsonResponse(
            200,
            await authenticationService.loginUser(normalizeBody(request.body))
          );
        }

        if (method === "GET" && path === "/auth/session") {
          return jsonResponse(
            200,
            await authenticationService.authenticateSession({
              token: extractBearerToken(request.headers ?? {})
            })
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

function assertAuthenticationService(authenticationService) {
  for (const method of ["registerUser", "loginUser", "authenticateSession"]) {
    if (!authenticationService || typeof authenticationService[method] !== "function") {
      throw new TypeError(`createAuthenticationHttpHandler requires authenticationService.${method}().`);
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

function extractBearerToken(headers) {
  const authorization = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "authorization"
  )?.[1];

  if (typeof authorization !== "string") {
    throw new AuthenticationError("Authorization bearer token is required.", "missing_bearer_token");
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthenticationError("Authorization bearer token is invalid.", "invalid_bearer_token");
  }

  return token;
}

function resolveErrorStatus(error) {
  if (error instanceof AuthenticationError) {
    return error.code === "email_taken" ? 409 : 401;
  }

  if (error instanceof TypeError) {
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
