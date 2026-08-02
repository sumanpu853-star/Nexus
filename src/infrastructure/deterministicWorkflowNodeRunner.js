import {
  WORKFLOW_TRACE_SPAN_KINDS
} from "../domain/workflowExecutionPolicy.js";

export function createDeterministicWorkflowNodeRunner({
  handlers = {}
} = {}) {
  const handlerMap = new Map(Object.entries(handlers));

  return Object.freeze({
    async runNode({
      workflow,
      execution,
      node,
      nodeRun,
      input = {},
      context = {}
    } = {}) {
      const normalizedNode = normalizeNode(node);
      const handler =
        handlerMap.get(normalizedNode.id) ??
        handlerMap.get(normalizedNode.type) ??
        defaultNodeHandler;
      const result = await handler({
        workflow,
        execution,
        node: normalizedNode,
        nodeRun,
        input: normalizePlainObject(input, "Workflow node input"),
        context: normalizePlainObject(context, "Workflow node context")
      });

      return normalizeRunResult(
        result ?? {
          output: createDefaultOutput({ node: normalizedNode, input })
        },
        normalizedNode
      );
    }
  });
}

function defaultNodeHandler({
  node,
  input
}) {
  return {
    output: createDefaultOutput({ node, input }),
    logs: [
      {
        level: "info",
        message: `Executed node ${node.id}`,
        metadata: {
          node_type: node.type
        }
      }
    ],
    trace: {
      name: `Node ${node.id}`,
      kind: WORKFLOW_TRACE_SPAN_KINDS.NODE,
      attributes: {
        node_type: node.type
      }
    }
  };
}

function createDefaultOutput({
  node,
  input
}) {
  const parameters = node.parameters ?? {};

  switch (node.type) {
    case "manual":
    case "webhook":
    case "schedule":
      return {
        triggered: true,
        node_id: node.id,
        input
      };
    case "http_request":
      return {
        status_code: 200,
        method: parameters.method ?? "GET",
        url: parameters.url,
        body: parameters.body ?? null
      };
    case "slack":
    case "teams_message":
      return {
        message_id: stableId("message", `${node.type}:${parameters.channel}:${parameters.message}`),
        channel: parameters.channel,
        delivered: true
      };
    case "gmail":
    case "outlook_email":
      return {
        message_id: stableId("email", `${node.type}:${parameters.to}:${parameters.subject}`),
        to: parameters.to,
        delivered: true
      };
    case "google_drive":
      return {
        file_id: parameters.file_id ?? stableId("file", parameters.file_name ?? node.id),
        action: parameters.action,
        accepted: true
      };
    case "github":
      return {
        id: stableId("github", `${parameters.action}:${parameters.repo}:${parameters.title ?? ""}`),
        repo: parameters.repo,
        action: parameters.action
      };
    case "database_query":
      return {
        rows: [],
        row_count: 0,
        query_hash: stableId("query", parameters.query)
      };
    case "knowledge_search":
      return {
        matches: [],
        knowledge_base_id: parameters.knowledge_base_id,
        query: parameters.query
      };
    case "agent":
      return {
        model: parameters.model,
        message: `Deterministic agent completed ${node.id}`,
        tool_calls: []
      };
    default:
      return {
        node_id: node.id,
        accepted: true
      };
  }
}

function normalizeRunResult(result, node) {
  const normalized = normalizePlainObject(result, "Workflow node run result");

  return Object.freeze({
    output: normalizePlainObject(
      normalized.output ?? createDefaultOutput({ node, input: {} }),
      "Workflow node run output"
    ),
    logs: normalizeLogs(normalized.logs ?? []),
    usage: normalizePlainObject(normalized.usage ?? {}, "Workflow node run usage"),
    cost: normalizePlainObject(normalized.cost ?? {}, "Workflow node run cost"),
    trace: normalizePlainObject(
      normalized.trace ?? {
        name: `Node ${node.id}`,
        kind: WORKFLOW_TRACE_SPAN_KINDS.NODE,
        attributes: { node_type: node.type }
      },
      "Workflow node run trace"
    ),
    secretValues: normalizeStringArray(
      normalized.secretValues ?? [],
      "Workflow node run secretValues"
    )
  });
}

function normalizeLogs(logs) {
  if (!Array.isArray(logs)) {
    throw new TypeError("Workflow node run logs must be an array.");
  }

  return logs.map((log) => {
    const normalized = normalizePlainObject(log, "Workflow node run log");

    return Object.freeze({
      level: typeof normalized.level === "string" && normalized.level.trim() !== ""
        ? normalized.level.trim()
        : "info",
      message: normalizeRequiredString(
        normalized.message,
        "Workflow node run log message"
      ),
      metadata: normalizePlainObject(
        normalized.metadata ?? {},
        "Workflow node run log metadata"
      )
    });
  });
}

function normalizeNode(node) {
  const normalized = normalizePlainObject(node, "Workflow node");

  return Object.freeze({
    ...normalized,
    id: normalizeRequiredString(normalized.id, "Workflow node id"),
    type: normalizeRequiredString(normalized.type, "Workflow node type"),
    parameters: normalizePlainObject(
      normalized.parameters ?? {},
      "Workflow node parameters"
    )
  });
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

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}
