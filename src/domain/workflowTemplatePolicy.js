import { assertWorkflowNodesSafe } from "./executionSafetyPolicy.js";
import { applyWorkflowNodeDefinitionDefaults } from "./nodeDefinitionPolicy.js";
import { applyWorkflowErrorBranchDefaults } from "./workflowErrorBranchPolicy.js";
import { applyWorkflowNodeExecutionPolicyDefaults } from "./workflowNodeExecutionPolicy.js";
import { assertWorkflowGraphValid } from "./workflowGraphPolicy.js";

const BUILT_IN_WORKFLOW_TEMPLATES = deepFreeze([
  createWorkflowTemplate({
    id: "manual-http-slack-alert",
    name: "Manual HTTP To Slack Alert",
    description: "Trigger an HTTP request manually and post the result to Slack.",
    tags: ["manual", "http", "slack"],
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "http",
        type: "http_request",
        parameters: {
          method: "GET",
          url: "https://example.com/api"
        }
      },
      {
        id: "notify",
        type: "slack",
        parameters: {
          channel: "#ops",
          message: "Workflow finished."
        }
      },
      {
        id: "error_notify",
        type: "slack",
        parameters: {
          channel: "#ops",
          message: "Workflow failed."
        }
      }
    ],
    edges: [
      { id: "manual_to_http", source: "manual", target: "http" },
      { id: "http_to_notify", source: "http", target: "notify" },
      { id: "http_to_error", source: "http", target: "error_notify", type: "error" }
    ],
    settings: {
      execution_mode: "manual"
    }
  }),
  createWorkflowTemplate({
    id: "manual-agent-review",
    name: "Manual Agent Review",
    description: "Run an AI agent from a manual trigger and post a review summary.",
    tags: ["manual", "agent", "review"],
    nodes: [
      { id: "manual", type: "manual" },
      {
        id: "agent",
        type: "agent",
        parameters: {
          instructions: "Review the provided input and return a concise operational summary."
        }
      },
      {
        id: "notify",
        type: "slack",
        parameters: {
          channel: "#reviews",
          message: "Agent review completed."
        }
      }
    ],
    edges: [
      { id: "manual_to_agent", source: "manual", target: "agent" },
      { id: "agent_to_notify", source: "agent", target: "notify" }
    ],
    settings: {
      execution_mode: "manual"
    }
  })
]);

export class WorkflowTemplateValidationError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "WorkflowTemplateValidationError";
    this.code = "workflow_template_invalid";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function getBuiltInWorkflowTemplates() {
  return BUILT_IN_WORKFLOW_TEMPLATES.map((template) => deepFreeze(deepClone(template)));
}

export function findWorkflowTemplateById({
  template_id,
  templates = getBuiltInWorkflowTemplates()
} = {}) {
  const templateId = normalizeRequiredString(template_id, "Template id");

  return templates.find((template) => template.id === templateId) ?? null;
}

export function createWorkflowTemplate({
  id,
  name,
  description = "",
  tags = [],
  nodes = [],
  edges = [],
  settings = {}
} = {}) {
  const normalizedNodes = applyWorkflowNodeExecutionPolicyDefaults({
    nodes: applyWorkflowNodeDefinitionDefaults({ nodes })
  });
  const normalizedEdges = applyWorkflowErrorBranchDefaults({ edges });

  assertWorkflowGraphValid({
    nodes: normalizedNodes,
    edges: normalizedEdges
  });
  assertWorkflowNodesSafe({
    nodes: normalizedNodes
  });

  return deepFreeze({
    id: normalizeRequiredString(id, "Template id"),
    name: normalizeRequiredString(name, "Template name"),
    description: normalizeOptionalString(description, "Template description"),
    tags: normalizeStringList(tags, "Template tags"),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    settings: normalizePlainObject(settings, "Template settings")
  });
}

export function createWorkflowDraftFromTemplate({
  template,
  name,
  description
} = {}) {
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    throw new TypeError("Workflow template must be an object.");
  }

  return deepFreeze({
    name: normalizeNullableString(name, "Workflow draft name") || template.name,
    description:
      normalizeNullableString(description, "Workflow draft description") ||
      template.description,
    nodes: deepClone(template.nodes),
    edges: deepClone(template.edges),
    settings: deepClone(template.settings)
  });
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WorkflowTemplateValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new WorkflowTemplateValidationError(`${field} must be a string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === undefined || value === null) {
    return "";
  }

  return normalizeOptionalString(value, field);
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) {
    throw new WorkflowTemplateValidationError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowTemplateValidationError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
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
