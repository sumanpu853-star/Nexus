import {
  WORKFLOW_TRIGGER_SOURCES
} from "../domain/workflowExecutionPolicy.js";

export function createKnowledgeSearchAgentTool({
  knowledgeBaseService,
  name = "knowledge_search"
} = {}) {
  assertService(knowledgeBaseService, "knowledgeBaseService", ["searchKnowledgeBase"]);
  const toolName = normalizeRequiredString(name, "Knowledge agent tool name");

  return deepFreeze({
    name: toolName,
    description: "Search a project knowledge base from an agent run.",
    handler: async ({
      input = {},
      context = {}
    } = {}) => {
      const normalizedInput = normalizePlainObject(input, "Knowledge agent tool input");
      const result = await knowledgeBaseService.searchKnowledgeBase({
        actor: {
          id: normalizeRequiredString(context.actor_id, "Knowledge agent tool actor_id")
        },
        project_id: normalizeRequiredString(
          context.project_id,
          "Knowledge agent tool project_id"
        ),
        knowledge_base_id: normalizeRequiredString(
          normalizedInput.knowledge_base_id,
          "Knowledge agent tool knowledge_base_id"
        ),
        query: normalizeRequiredString(normalizedInput.query, "Knowledge agent tool query"),
        limit: normalizePositiveInteger(
          normalizedInput.limit ?? 5,
          "Knowledge agent tool limit"
        ),
        filters: normalizePlainObject(
          normalizedInput.filters ?? {},
          "Knowledge agent tool filters"
        ),
        rerank: normalizedInput.rerank !== false
      });

      return deepFreeze({
        knowledge_base_id: result.knowledge_base_id,
        query: result.query,
        result_count: result.results.length,
        results: result.results
      });
    }
  });
}

export function createWorkflowRunAgentTool({
  workflowExecutionService,
  name = "run_workflow"
} = {}) {
  assertService(workflowExecutionService, "workflowExecutionService", [
    "queueWorkflowExecution"
  ]);
  const toolName = normalizeRequiredString(name, "Workflow agent tool name");

  return deepFreeze({
    name: toolName,
    description: "Queue a project workflow from an agent run.",
    handler: async ({
      input = {},
      context = {}
    } = {}) => {
      const normalizedInput = normalizePlainObject(input, "Workflow agent tool input");
      const execution = await workflowExecutionService.queueWorkflowExecution({
        actor: {
          id: normalizeRequiredString(context.actor_id, "Workflow agent tool actor_id")
        },
        project_id: normalizeRequiredString(
          context.project_id,
          "Workflow agent tool project_id"
        ),
        workflow_id: normalizeRequiredString(
          normalizedInput.workflow_id,
          "Workflow agent tool workflow_id"
        ),
        trigger_source: WORKFLOW_TRIGGER_SOURCES.SUB_WORKFLOW,
        input: normalizePlainObject(
          normalizedInput.input ?? {},
          "Workflow agent tool queued input"
        ),
        secretValues: normalizeStringArray(
          normalizedInput.secretValues ?? [],
          "Workflow agent tool secretValues"
        ),
        metadata: {
          ...normalizePlainObject(
            normalizedInput.metadata ?? {},
            "Workflow agent tool metadata"
          ),
          source: "agent_tool",
          parent_agent_id: normalizeOptionalString(context.agent_id ?? ""),
          parent_agent_run_id: normalizeOptionalString(context.run_id ?? ""),
          parent_tool_name: toolName
        }
      });

      return deepFreeze({
        queued: true,
        execution_id: execution.id,
        workflow_id: execution.workflow_id,
        project_id: execution.project_id,
        status: execution.status,
        trigger_source: execution.trigger_source,
        mode: execution.mode
      });
    }
  });
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

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
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

function assertService(service, name, methods) {
  for (const method of methods) {
    if (!service || typeof service[method] !== "function") {
      throw new TypeError(`${name}.${method}() is required.`);
    }
  }
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
