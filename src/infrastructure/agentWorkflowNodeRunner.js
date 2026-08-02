import {
  AGENT_RUN_STATUSES,
  AGENT_TOOL_CALL_STATUSES
} from "../domain/agentPolicy.js";
import {
  WORKFLOW_NODE_RUN_STATUSES,
  WORKFLOW_TRACE_SPAN_KINDS,
  WORKFLOW_TRACE_SPAN_STATUSES
} from "../domain/workflowExecutionPolicy.js";
import {
  createDeterministicWorkflowNodeRunner
} from "./deterministicWorkflowNodeRunner.js";

export function createAgentWorkflowNodeRunner({
  agentService,
  fallbackRunner = createDeterministicWorkflowNodeRunner(),
  costEstimator = estimateAgentRunCost
} = {}) {
  assertService(agentService, "agentService", ["runAgent"]);

  if (!fallbackRunner || typeof fallbackRunner.runNode !== "function") {
    throw new TypeError(
      "createAgentWorkflowNodeRunner requires fallbackRunner.runNode()."
    );
  }

  if (typeof costEstimator !== "function") {
    throw new TypeError("createAgentWorkflowNodeRunner requires a costEstimator function.");
  }

  return Object.freeze({
    async runNode(request = {}) {
      const node = normalizeNode(request.node);
      const agentId = normalizeOptionalString(node.parameters.agent_id ?? "");

      if (node.type !== "agent" || !agentId) {
        return fallbackRunner.runNode({
          ...request,
          node
        });
      }

      const execution = normalizeExecution(request.execution);
      const input = normalizePlainObject(request.input ?? {}, "Agent node input");
      const run = await agentService.runAgent({
        actor: {
          id: normalizeRequiredString(
            execution.started_by ?? request.context?.actor_id,
            "Agent node actor id"
          )
        },
        project_id: normalizeRequiredString(
          execution.project_id ?? request.workflow?.project_id,
          "Agent node project_id"
        ),
        agent_id: agentId,
        session_id: resolveSessionId({
          node,
          input,
          execution,
          context: request.context ?? {}
        }),
        input
      });
      const visibleToolCalls = node.parameters.tool_call_visibility !== false;
      const failedToolCall = (run.tool_calls ?? []).find((toolCall) =>
        toolCall.status !== AGENT_TOOL_CALL_STATUSES.COMPLETED
      );
      const status = run.status === AGENT_RUN_STATUSES.COMPLETED
        ? WORKFLOW_NODE_RUN_STATUSES.SUCCESS
        : WORKFLOW_NODE_RUN_STATUSES.FAILED;

      return deepFreeze({
        status,
        output: createAgentNodeOutput({
          run,
          visibleToolCalls
        }),
        error: status === WORKFLOW_NODE_RUN_STATUSES.FAILED
          ? createAgentNodeError({ run, failedToolCall })
          : null,
        logs: createAgentNodeLogs({
          run,
          node,
          visibleToolCalls
        }),
        usage: normalizePlainObject(run.usage ?? {}, "Agent run usage"),
        cost: normalizePlainObject(
          await costEstimator({ run, node, execution }),
          "Agent run cost"
        ),
        trace: createAgentNodeTrace({
          run,
          node,
          execution,
          status
        }),
        secretValues: []
      });
    }
  });
}

export function estimateAgentRunCost({
  run
} = {}) {
  const usage = normalizePlainObject(run?.usage ?? {}, "Agent run usage");
  const model = normalizePlainObject(run?.model ?? {}, "Agent run model");
  const inputRate = normalizeNonNegativeNumber(
    model.input_token_cost_per_1k ?? model.input_cost_per_1k ?? 0,
    "Agent model input token cost per 1k"
  );
  const outputRate = normalizeNonNegativeNumber(
    model.output_token_cost_per_1k ?? model.output_cost_per_1k ?? 0,
    "Agent model output token cost per 1k"
  );
  const inputTokens = normalizeNonNegativeInteger(
    usage.input_tokens ?? 0,
    "Agent usage input_tokens"
  );
  const outputTokens = normalizeNonNegativeInteger(
    usage.output_tokens ?? 0,
    "Agent usage output_tokens"
  );

  return Object.freeze({
    amount: roundMoney(((inputTokens / 1000) * inputRate) + ((outputTokens / 1000) * outputRate)),
    currency: normalizeCurrency(model.currency ?? "USD")
  });
}

function createAgentNodeOutput({
  run,
  visibleToolCalls
}) {
  const output = normalizePlainObject(run.output ?? {}, "Agent run output");
  const toolCalls = Array.isArray(run.tool_calls) ? run.tool_calls : [];

  return Object.freeze({
    agent_run_id: run.id,
    agent_id: run.agent_id,
    status: run.status,
    message: output.message ?? "",
    model: run.model,
    memory: run.memory,
    usage: run.usage,
    tool_call_count: toolCalls.length,
    tool_calls_visible: visibleToolCalls,
    tool_results: visibleToolCalls ? output.tool_results ?? [] : [],
    tool_calls: visibleToolCalls ? toolCalls : []
  });
}

function createAgentNodeError({
  run,
  failedToolCall
}) {
  if (run.error) {
    return normalizeNullableError(run.error, "Agent run error");
  }

  if (failedToolCall?.error) {
    return normalizeNullableError(failedToolCall.error, "Agent tool call error");
  }

  return {
    code: "agent_node_failed",
    message: "Agent node run failed."
  };
}

function createAgentNodeLogs({
  run,
  node,
  visibleToolCalls
}) {
  const logs = [
    {
      level: run.status === AGENT_RUN_STATUSES.COMPLETED ? "info" : "error",
      message: `Agent node ${node.id} ran agent ${run.agent_id}`,
      metadata: {
        agent_run_id: run.id,
        agent_id: run.agent_id,
        status: run.status,
        model: run.model.model,
        tool_call_count: run.tool_calls.length
      }
    }
  ];

  if (!visibleToolCalls) {
    return Object.freeze(logs);
  }

  return Object.freeze([
    ...logs,
    ...run.tool_calls.map((toolCall) => ({
      level: toolCall.status === AGENT_TOOL_CALL_STATUSES.COMPLETED
        ? "info"
        : "warn",
      message: `Agent tool ${toolCall.tool_name} ${toolCall.status}`,
      metadata: {
        agent_run_id: run.id,
        tool_call_id: toolCall.id,
        tool_name: toolCall.tool_name,
        status: toolCall.status
      }
    }))
  ]);
}

function createAgentNodeTrace({
  run,
  node,
  execution,
  status
}) {
  return Object.freeze({
    name: `Agent ${run.agent_id}`,
    kind: WORKFLOW_TRACE_SPAN_KINDS.MODEL,
    status: status === WORKFLOW_NODE_RUN_STATUSES.SUCCESS
      ? WORKFLOW_TRACE_SPAN_STATUSES.OK
      : WORKFLOW_TRACE_SPAN_STATUSES.ERROR,
    attributes: {
      node_type: node.type,
      agent_id: run.agent_id,
      agent_run_id: run.id,
      model_provider: run.model.provider,
      model: run.model.model,
      memory_scope: run.memory.scope,
      prompt_version: run.output.prompt_version ?? null,
      tool_call_count: run.tool_calls.length,
      execution_id: execution.id
    }
  });
}

function resolveSessionId({
  node,
  input,
  execution,
  context
}) {
  return normalizeOptionalString(node.parameters.session_id ?? "") ||
    normalizeOptionalString(input.session_id ?? "") ||
    normalizeOptionalString(context.session_id ?? "") ||
    execution.id;
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

function normalizeExecution(execution) {
  const normalized = normalizePlainObject(execution, "Workflow execution");

  return Object.freeze({
    ...normalized,
    id: normalizeRequiredString(normalized.id, "Workflow execution id")
  });
}

function normalizeNullableError(value, field) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return { message: value };
  }

  return normalizePlainObject(value, field);
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
}

function normalizeNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function normalizeNonNegativeNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative number.`);
  }

  return value;
}

function normalizeCurrency(value) {
  const normalized = normalizeRequiredString(value, "Agent model cost currency").toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new TypeError("Agent model cost currency must be a 3-letter ISO code.");
  }

  return normalized;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}

function assertService(service, name, methods) {
  for (const method of methods) {
    if (!service || typeof service[method] !== "function") {
      throw new TypeError(`createAgentWorkflowNodeRunner requires ${name}.${method}().`);
    }
  }
}

function roundMoney(value) {
  return Number(value.toFixed(6));
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
