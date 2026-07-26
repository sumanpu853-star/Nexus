export function createDeterministicIntegrationGateway({
  handlers = {}
} = {}) {
  const customHandlers = new Map(Object.entries(handlers));

  return Object.freeze({
    async invoke({
      definition,
      connection,
      action,
      input = {},
      context = {}
    } = {}) {
      const integrationType = normalizeRequiredString(
        definition?.type ?? connection?.integration_type,
        "Integration type"
      );
      const normalizedAction = normalizeRequiredString(action, "Integration action");
      const handlerKey = `${integrationType}:${normalizedAction}`;
      const handler = customHandlers.get(handlerKey) ?? defaultIntegrationHandler;

      return normalizePlainObject(
        await handler({
          definition,
          connection,
          action: normalizedAction,
          input: normalizePlainObject(input, "Integration input"),
          context: normalizePlainObject(context, "Integration context")
        }),
        "Integration output"
      );
    }
  });
}

function defaultIntegrationHandler({
  definition,
  connection,
  action,
  input,
  context
}) {
  const integrationType = definition?.type ?? connection.integration_type;

  switch (integrationType) {
    case "http":
      return {
        status_code: 200,
        method: input.method ?? "GET",
        url: input.url ?? connection.settings?.base_url ?? "https://example.com",
        body: input.body ?? null
      };
    case "slack":
    case "teams":
      return {
        message_id: stableId("message", `${integrationType}:${input.channel}:${input.message}`),
        channel: input.channel,
        delivered: true
      };
    case "gmail":
    case "outlook_email":
      return {
        message_id: stableId("email", `${integrationType}:${input.to}:${input.subject}`),
        to: input.to,
        delivered: true
      };
    case "google_drive":
      return {
        file_id: input.file_id ?? stableId("file", `${action}:${input.file_name ?? "file"}`),
        action,
        accepted: true
      };
    case "github":
      return {
        repo: input.repo,
        action,
        id: stableId("github", `${action}:${input.repo}:${input.title ?? input.workflow ?? ""}`)
      };
    case "database":
      return {
        rows: [],
        row_count: 0,
        query_hash: stableId("query", input.query ?? "")
      };
    default:
      return {
        integration_type: integrationType,
        action,
        accepted: true,
        context
      };
  }
}

function stableId(prefix, value) {
  let hash = 2166136261;

  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}
