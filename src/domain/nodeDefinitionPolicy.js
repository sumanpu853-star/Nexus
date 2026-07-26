export const NODE_CATEGORIES = Object.freeze({
  TRIGGER: "trigger",
  ACTION: "action",
  AI: "ai",
  CODE: "code"
});

export const NODE_PARAMETER_TYPES = Object.freeze({
  STRING: "string",
  URL: "url",
  ENUM: "enum",
  OBJECT: "object",
  ARRAY: "array",
  BOOLEAN: "boolean",
  INTEGER: "integer",
  NUMBER: "number"
});

export const NODE_PARAMETER_CONTROLS = Object.freeze({
  TEXT: "text",
  TEXTAREA: "textarea",
  SELECT: "select",
  KEY_VALUE: "key_value",
  JSON: "json",
  TOGGLE: "toggle",
  NUMBER: "number"
});

const BUILT_IN_NODE_DEFINITIONS = deepFreeze([
  createNodeDefinition({
    type: "manual",
    label: "Manual Trigger",
    category: NODE_CATEGORIES.TRIGGER,
    icon: "play-circle",
    input_handles: [],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: { fields: [] },
    credential_requirements: [],
    execution: { supports_timeout: false, supports_retry: false },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "http_request",
    label: "HTTP Request",
    category: NODE_CATEGORIES.ACTION,
    icon: "send",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "method",
          label: "Method",
          type: NODE_PARAMETER_TYPES.ENUM,
          control: NODE_PARAMETER_CONTROLS.SELECT,
          required: true,
          default: "GET",
          options: ["GET", "POST", "PUT", "PATCH", "DELETE"]
        },
        {
          name: "url",
          label: "URL",
          type: NODE_PARAMETER_TYPES.URL,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "headers",
          label: "Headers",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.KEY_VALUE,
          required: false,
          default: {}
        },
        {
          name: "query",
          label: "Query",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.KEY_VALUE,
          required: false,
          default: {}
        },
        {
          name: "body",
          label: "Body",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.JSON,
          required: false,
          default: {}
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: ["authorization", "headers"] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "slack",
    label: "Slack Message",
    category: NODE_CATEGORIES.ACTION,
    icon: "message-square",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "channel",
          label: "Channel",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "message",
          label: "Message",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        },
        {
          name: "thread_ts",
          label: "Thread Timestamp",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        }
      ]
    },
    credential_requirements: [
      { name: "slack", type: "slack_bot_token", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "teams_message",
    label: "Teams Message",
    category: NODE_CATEGORIES.ACTION,
    icon: "messages-square",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "team",
          label: "Team",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        },
        {
          name: "channel",
          label: "Channel",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "message",
          label: "Message",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        }
      ]
    },
    credential_requirements: [
      { name: "teams", type: "teams_oauth", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "gmail",
    label: "Gmail Email",
    category: NODE_CATEGORIES.ACTION,
    icon: "mail",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "to",
          label: "To",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "subject",
          label: "Subject",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "body",
          label: "Body",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        }
      ]
    },
    credential_requirements: [
      { name: "gmail", type: "gmail_oauth", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "outlook_email",
    label: "Outlook Email",
    category: NODE_CATEGORIES.ACTION,
    icon: "mail",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "to",
          label: "To",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "subject",
          label: "Subject",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "body",
          label: "Body",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        }
      ]
    },
    credential_requirements: [
      { name: "outlook", type: "outlook_oauth", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "google_drive",
    label: "Google Drive",
    category: NODE_CATEGORIES.ACTION,
    icon: "folder-up",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "action",
          label: "Action",
          type: NODE_PARAMETER_TYPES.ENUM,
          control: NODE_PARAMETER_CONTROLS.SELECT,
          required: true,
          default: "list_files",
          options: ["upload_file", "download_file", "list_files"]
        },
        {
          name: "file_id",
          label: "File ID",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        },
        {
          name: "file_name",
          label: "File Name",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        },
        {
          name: "content",
          label: "Content",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: false
        },
        {
          name: "folder_id",
          label: "Folder ID",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        }
      ]
    },
    credential_requirements: [
      { name: "google_drive", type: "google_drive_oauth", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "github",
    label: "GitHub",
    category: NODE_CATEGORIES.ACTION,
    icon: "github",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "action",
          label: "Action",
          type: NODE_PARAMETER_TYPES.ENUM,
          control: NODE_PARAMETER_CONTROLS.SELECT,
          required: true,
          default: "create_issue",
          options: ["create_issue", "comment_on_issue", "dispatch_workflow"]
        },
        {
          name: "repo",
          label: "Repository",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "title",
          label: "Title",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        },
        {
          name: "body",
          label: "Body",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: false
        },
        {
          name: "workflow",
          label: "Workflow",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false
        }
      ]
    },
    credential_requirements: [
      { name: "github", type: "github_token", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "database_query",
    label: "Database Query",
    category: NODE_CATEGORIES.ACTION,
    icon: "database",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "query",
          label: "Query",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        },
        {
          name: "params",
          label: "Params",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.JSON,
          required: false,
          default: {}
        }
      ]
    },
    credential_requirements: [
      { name: "database", type: "database_connection", required: false }
    ],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: ["params"] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "webhook",
    label: "Webhook Trigger",
    category: NODE_CATEGORIES.TRIGGER,
    icon: "webhook",
    input_handles: [],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "path",
          label: "Path",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "method",
          label: "Method",
          type: NODE_PARAMETER_TYPES.ENUM,
          control: NODE_PARAMETER_CONTROLS.SELECT,
          required: true,
          default: "POST",
          options: ["GET", "POST", "PUT", "PATCH", "DELETE"]
        },
        {
          name: "secret_required",
          label: "Secret Required",
          type: NODE_PARAMETER_TYPES.BOOLEAN,
          control: NODE_PARAMETER_CONTROLS.TOGGLE,
          required: false,
          default: true
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: false, supports_retry: false },
    redaction: { parameter_keys: ["headers", "authorization"] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "schedule",
    label: "Schedule Trigger",
    category: NODE_CATEGORIES.TRIGGER,
    icon: "calendar-clock",
    input_handles: [],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "cron",
          label: "Cron",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "timezone",
          label: "Timezone",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false,
          default: "UTC"
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: false, supports_retry: false },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "agent",
    label: "AI Agent",
    category: NODE_CATEGORIES.AI,
    icon: "bot",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "model",
          label: "Model",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false,
          default: "nexus-agent-deterministic-v1"
        },
        {
          name: "temperature",
          label: "Temperature",
          type: NODE_PARAMETER_TYPES.NUMBER,
          control: NODE_PARAMETER_CONTROLS.NUMBER,
          required: false,
          default: 0.2
        },
        {
          name: "instructions",
          label: "Instructions",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        },
        {
          name: "tools",
          label: "Tools",
          type: NODE_PARAMETER_TYPES.ARRAY,
          control: NODE_PARAMETER_CONTROLS.JSON,
          required: false,
          default: []
        },
        {
          name: "memory_scope",
          label: "Memory Scope",
          type: NODE_PARAMETER_TYPES.ENUM,
          control: NODE_PARAMETER_CONTROLS.SELECT,
          required: false,
          default: "session",
          options: ["none", "session", "user", "semantic"]
        },
        {
          name: "memory_key",
          label: "Memory Key",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: false,
          default: "default"
        },
        {
          name: "tool_call_visibility",
          label: "Tool Call Visibility",
          type: NODE_PARAMETER_TYPES.BOOLEAN,
          control: NODE_PARAMETER_CONTROLS.TOGGLE,
          required: false,
          default: true
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "knowledge_search",
    label: "Knowledge Search",
    category: NODE_CATEGORIES.AI,
    icon: "search",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "knowledge_base_id",
          label: "Knowledge Base",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXT,
          required: true
        },
        {
          name: "query",
          label: "Query",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: true
        },
        {
          name: "limit",
          label: "Limit",
          type: NODE_PARAMETER_TYPES.INTEGER,
          control: NODE_PARAMETER_CONTROLS.NUMBER,
          required: false,
          default: 5
        },
        {
          name: "rerank",
          label: "Rerank",
          type: NODE_PARAMETER_TYPES.BOOLEAN,
          control: NODE_PARAMETER_CONTROLS.TOGGLE,
          required: false,
          default: true
        },
        {
          name: "filters",
          label: "Filters",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.KEY_VALUE,
          required: false,
          default: {}
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: true, supports_retry: true },
    redaction: { parameter_keys: [] },
    availability: { status: "available" }
  }),
  createNodeDefinition({
    type: "python_script",
    label: "Python Script",
    category: NODE_CATEGORIES.CODE,
    icon: "file-code",
    input_handles: [{ id: "main", label: "Main" }],
    output_handles: [{ id: "main", label: "Main" }],
    parameter_schema: {
      fields: [
        {
          name: "code",
          label: "Code",
          type: NODE_PARAMETER_TYPES.STRING,
          control: NODE_PARAMETER_CONTROLS.TEXTAREA,
          required: false
        },
        {
          name: "input",
          label: "Input",
          type: NODE_PARAMETER_TYPES.OBJECT,
          control: NODE_PARAMETER_CONTROLS.JSON,
          required: false,
          default: {}
        }
      ]
    },
    credential_requirements: [],
    execution: { supports_timeout: true, supports_retry: false },
    redaction: { parameter_keys: [] },
    availability: {
      status: "disabled",
      reason: "Requires a sandboxed runner before production use."
    }
  })
]);

export class WorkflowNodeDefinitionValidationError extends Error {
  constructor(message, {
    violations = []
  } = {}) {
    super(message);
    this.name = "WorkflowNodeDefinitionValidationError";
    this.code = "workflow_node_definition_invalid";
    this.violations = Object.freeze(violations.map((violation) => Object.freeze({ ...violation })));
  }
}

export function getBuiltInNodeDefinitions() {
  return BUILT_IN_NODE_DEFINITIONS.map((definition) => deepFreeze(deepClone(definition)));
}

export function getBuiltInNodeDefinitionMap() {
  return createNodeDefinitionMap(getBuiltInNodeDefinitions());
}

export function createNodeDefinition(definition = {}) {
  const normalized = {
    type: normalizeRequiredString(definition.type, "Node definition type"),
    label: normalizeRequiredString(definition.label, "Node definition label"),
    category: normalizeEnum(definition.category, NODE_CATEGORIES, "Node definition category"),
    icon: normalizeRequiredString(definition.icon, "Node definition icon"),
    input_handles: normalizeHandles(definition.input_handles ?? [], "input_handles"),
    output_handles: normalizeHandles(definition.output_handles ?? [], "output_handles"),
    parameter_schema: normalizeParameterSchema(definition.parameter_schema ?? { fields: [] }),
    credential_requirements: normalizeCredentialRequirements(
      definition.credential_requirements ?? []
    ),
    execution: normalizeExecutionSupport(definition.execution ?? {}),
    redaction: normalizeRedaction(definition.redaction ?? {}),
    availability: normalizeAvailability(definition.availability ?? {})
  };

  return deepFreeze(normalized);
}

export function findWorkflowNodeDefinitionViolations({
  nodes,
  nodeDefinitions = getBuiltInNodeDefinitions()
} = {}) {
  if (!Array.isArray(nodes)) {
    return [
      {
        type: "invalid_nodes",
        message: "Workflow nodes must be an array."
      }
    ];
  }

  const definitionsByType = createNodeDefinitionMap(nodeDefinitions);

  return nodes.flatMap((node, index) =>
    validateWorkflowNodeAgainstDefinition({
      node,
      index,
      definitionsByType
    })
  );
}

export function assertWorkflowNodesMatchDefinitions({
  nodes,
  nodeDefinitions = getBuiltInNodeDefinitions()
} = {}) {
  const violations = findWorkflowNodeDefinitionViolations({
    nodes,
    nodeDefinitions
  });

  if (violations.length > 0) {
    throw new WorkflowNodeDefinitionValidationError(
      "Workflow nodes do not match their node definitions.",
      { violations }
    );
  }
}

export function applyWorkflowNodeDefinitionDefaults({
  nodes,
  nodeDefinitions = getBuiltInNodeDefinitions()
} = {}) {
  assertWorkflowNodesMatchDefinitions({
    nodes,
    nodeDefinitions
  });

  const definitionsByType = createNodeDefinitionMap(nodeDefinitions);

  return nodes.map((node, index) => {
    const definition = definitionsByType.get(node.type.trim());

    return deepFreeze({
      ...deepClone(node),
      label: normalizeOptionalString(node.label) ?? definition.label,
      parameters: applyParameterDefaults({
        parameters: node.parameters ?? {},
        definition
      }),
      credential_refs: normalizeCredentialRefs(node.credential_refs ?? {}, {
        definition,
        nodeId: resolveNodeId(node, index)
      })
    });
  });
}

export function findNodeDefinitionByType({
  type,
  nodeDefinitions = getBuiltInNodeDefinitions()
} = {}) {
  const normalizedType = normalizeRequiredString(type, "Node type");
  const definitionsByType = createNodeDefinitionMap(nodeDefinitions);

  return definitionsByType.get(normalizedType) ?? null;
}

function validateWorkflowNodeAgainstDefinition({
  node,
  index,
  definitionsByType
}) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [
      {
        type: "invalid_node",
        node_index: index,
        message: `Workflow node at index ${index} must be an object.`
      }
    ];
  }

  const nodeId = resolveNodeId(node, index);
  const nodeType = normalizeOptionalString(node.type);

  if (!nodeType || !definitionsByType.has(nodeType)) {
    return [
      {
        type: "unsupported_node_type",
        node_id: nodeId,
        node_type: node.type ?? null,
        supported: [...definitionsByType.keys()],
        message: `Node "${nodeId}" type is not supported by the node catalog.`
      }
    ];
  }

  const definition = definitionsByType.get(nodeType);
  const parameterViolations = validateNodeParameters({
    parameters: node.parameters ?? {},
    definition,
    nodeId
  });
  const credentialViolations = validateCredentialRefs({
    credentialRefs: node.credential_refs ?? {},
    definition,
    nodeId
  });

  return [...parameterViolations, ...credentialViolations];
}

function validateNodeParameters({
  parameters,
  definition,
  nodeId
}) {
  if (!isPlainObject(parameters)) {
    return [
      {
        type: "invalid_node_parameters",
        node_id: nodeId,
        message: `Node "${nodeId}" parameters must be an object.`
      }
    ];
  }

  const fields = definition.parameter_schema.fields;
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const violations = [];

  for (const parameterName of Object.keys(parameters)) {
    if (!fieldsByName.has(parameterName)) {
      violations.push({
        type: "unsupported_node_parameter",
        node_id: nodeId,
        parameter: parameterName,
        node_type: definition.type,
        message: `Node "${nodeId}" parameter "${parameterName}" is not supported.`
      });
    }
  }

  for (const field of fields) {
    const value = parameters[field.name];

    if (value === undefined) {
      if (field.required && !Object.hasOwn(field, "default")) {
        violations.push({
          type: "required_node_parameter_missing",
          node_id: nodeId,
          parameter: field.name,
          node_type: definition.type,
          message: `Node "${nodeId}" requires parameter "${field.name}".`
        });
      }

      continue;
    }

    violations.push(...validateParameterValue({
      value,
      field,
      nodeId,
      nodeType: definition.type
    }));
  }

  return violations;
}

function validateParameterValue({
  value,
  field,
  nodeId,
  nodeType
}) {
  if (!parameterValueMatchesType(value, field)) {
    return [
      {
        type: field.type === NODE_PARAMETER_TYPES.URL
          ? "invalid_node_parameter_format"
          : "invalid_node_parameter_type",
        node_id: nodeId,
        node_type: nodeType,
        parameter: field.name,
        expected_type: field.type,
        message: `Node "${nodeId}" parameter "${field.name}" must be a valid ${field.type}.`
      }
    ];
  }

  return [];
}

function validateCredentialRefs({
  credentialRefs,
  definition,
  nodeId
}) {
  if (!isPlainObject(credentialRefs)) {
    return [
      {
        type: "invalid_node_credential_refs",
        node_id: nodeId,
        message: `Node "${nodeId}" credential_refs must be an object.`
      }
    ];
  }

  const requirementsByName = new Map(
    definition.credential_requirements.map((requirement) => [requirement.name, requirement])
  );
  const violations = [];

  for (const credentialName of Object.keys(credentialRefs)) {
    if (!requirementsByName.has(credentialName)) {
      violations.push({
        type: "unsupported_node_credential_ref",
        node_id: nodeId,
        credential: credentialName,
        node_type: definition.type,
        message: `Node "${nodeId}" credential "${credentialName}" is not supported.`
      });
      continue;
    }

    if (
      typeof credentialRefs[credentialName] !== "string" ||
      credentialRefs[credentialName].trim() === ""
    ) {
      violations.push({
        type: "invalid_node_credential_ref",
        node_id: nodeId,
        credential: credentialName,
        node_type: definition.type,
        message: `Node "${nodeId}" credential "${credentialName}" must reference a credential id.`
      });
    }
  }

  for (const requirement of definition.credential_requirements) {
    if (
      requirement.required &&
      (
        typeof credentialRefs[requirement.name] !== "string" ||
        credentialRefs[requirement.name].trim() === ""
      )
    ) {
      violations.push({
        type: "required_node_credential_missing",
        node_id: nodeId,
        credential: requirement.name,
        node_type: definition.type,
        message: `Node "${nodeId}" requires credential "${requirement.name}".`
      });
    }
  }

  return violations;
}

function applyParameterDefaults({
  parameters,
  definition
}) {
  const normalized = {};

  for (const field of definition.parameter_schema.fields) {
    if (parameters[field.name] !== undefined) {
      normalized[field.name] = deepClone(parameters[field.name]);
      continue;
    }

    if (Object.hasOwn(field, "default")) {
      normalized[field.name] = deepClone(field.default);
    }
  }

  return deepFreeze(normalized);
}

function createNodeDefinitionMap(nodeDefinitions) {
  if (!Array.isArray(nodeDefinitions)) {
    throw new TypeError("nodeDefinitions must be an array.");
  }

  const definitionsByType = new Map();

  for (const definition of nodeDefinitions) {
    const normalized = createNodeDefinition(definition);

    if (definitionsByType.has(normalized.type)) {
      throw new TypeError(`Node definition "${normalized.type}" is duplicated.`);
    }

    definitionsByType.set(normalized.type, normalized);
  }

  return definitionsByType;
}

function normalizeParameterSchema(schema) {
  if (!isPlainObject(schema)) {
    throw new TypeError("Node definition parameter_schema must be an object.");
  }

  if (!Array.isArray(schema.fields)) {
    throw new TypeError("Node definition parameter_schema.fields must be an array.");
  }

  const fieldNames = new Set();

  return deepFreeze({
    fields: schema.fields.map((field) => {
      const normalized = normalizeParameterField(field);

      if (fieldNames.has(normalized.name)) {
        throw new TypeError(`Node definition parameter "${normalized.name}" is duplicated.`);
      }

      fieldNames.add(normalized.name);

      return normalized;
    })
  });
}

function normalizeParameterField(field) {
  if (!isPlainObject(field)) {
    throw new TypeError("Node definition parameter fields must be objects.");
  }

  const normalized = {
    name: normalizeRequiredString(field.name, "Node parameter name"),
    label: normalizeRequiredString(field.label, "Node parameter label"),
    type: normalizeEnum(field.type, NODE_PARAMETER_TYPES, "Node parameter type"),
    control: normalizeEnum(field.control, NODE_PARAMETER_CONTROLS, "Node parameter control"),
    required: Boolean(field.required)
  };

  if (normalized.type === NODE_PARAMETER_TYPES.ENUM) {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      throw new TypeError(`Node parameter "${normalized.name}" must define enum options.`);
    }

    normalized.options = field.options.map((option) =>
      normalizeRequiredString(option, `Node parameter "${normalized.name}" option`)
    );
  }

  if (Object.hasOwn(field, "default")) {
    if (!parameterValueMatchesType(field.default, normalized)) {
      throw new TypeError(`Node parameter "${normalized.name}" default does not match its type.`);
    }

    normalized.default = deepClone(field.default);
  }

  return deepFreeze(normalized);
}

function normalizeHandles(handles, field) {
  if (!Array.isArray(handles)) {
    throw new TypeError(`Node definition ${field} must be an array.`);
  }

  return handles.map((handle) => {
    if (!isPlainObject(handle)) {
      throw new TypeError(`Node definition ${field} entries must be objects.`);
    }

    return deepFreeze({
      id: normalizeRequiredString(handle.id, `Node definition ${field} id`),
      label: normalizeRequiredString(handle.label, `Node definition ${field} label`)
    });
  });
}

function normalizeCredentialRequirements(requirements) {
  if (!Array.isArray(requirements)) {
    throw new TypeError("Node definition credential_requirements must be an array.");
  }

  return requirements.map((requirement) => {
    if (!isPlainObject(requirement)) {
      throw new TypeError("Node definition credential requirements must be objects.");
    }

    return deepFreeze({
      name: normalizeRequiredString(requirement.name, "Credential requirement name"),
      type: normalizeRequiredString(requirement.type, "Credential requirement type"),
      required: Boolean(requirement.required)
    });
  });
}

function normalizeCredentialRefs(credentialRefs, {
  definition,
  nodeId
}) {
  const violations = validateCredentialRefs({
    credentialRefs,
    definition,
    nodeId
  });

  if (violations.length > 0) {
    throw new WorkflowNodeDefinitionValidationError(
      "Workflow node credential references are invalid.",
      { violations }
    );
  }

  return deepFreeze(
    Object.fromEntries(
      Object.entries(credentialRefs).map(([name, credentialId]) => [
        name,
        credentialId.trim()
      ])
    )
  );
}

function normalizeExecutionSupport(execution) {
  if (!isPlainObject(execution)) {
    throw new TypeError("Node definition execution must be an object.");
  }

  return deepFreeze({
    supports_timeout: Boolean(execution.supports_timeout),
    supports_retry: Boolean(execution.supports_retry)
  });
}

function normalizeRedaction(redaction) {
  if (!isPlainObject(redaction)) {
    throw new TypeError("Node definition redaction must be an object.");
  }

  return deepFreeze({
    parameter_keys: normalizeStringArray(redaction.parameter_keys ?? [], "redaction.parameter_keys")
  });
}

function normalizeAvailability(availability) {
  if (!isPlainObject(availability)) {
    throw new TypeError("Node definition availability must be an object.");
  }

  const status = availability.status ?? "available";

  if (!["available", "disabled"].includes(status)) {
    throw new TypeError("Node definition availability.status is not supported.");
  }

  return deepFreeze({
    status,
    reason: normalizeOptionalString(availability.reason) ?? ""
  });
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => normalizeRequiredString(entry, field));
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new TypeError(`${field} is not supported.`);
  }

  return value;
}

function parameterValueMatchesType(value, field) {
  switch (field.type) {
    case NODE_PARAMETER_TYPES.STRING:
      return typeof value === "string";
    case NODE_PARAMETER_TYPES.URL:
      return typeof value === "string" && isHttpUrl(value);
    case NODE_PARAMETER_TYPES.ENUM:
      return typeof value === "string" && field.options.includes(value);
    case NODE_PARAMETER_TYPES.OBJECT:
      return isPlainObject(value);
    case NODE_PARAMETER_TYPES.ARRAY:
      return Array.isArray(value);
    case NODE_PARAMETER_TYPES.BOOLEAN:
      return typeof value === "boolean";
    case NODE_PARAMETER_TYPES.INTEGER:
      return Number.isInteger(value);
    case NODE_PARAMETER_TYPES.NUMBER:
      return typeof value === "number" && Number.isFinite(value);
    default:
      return false;
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);

    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function resolveNodeId(node, index) {
  return typeof node.id === "string" && node.id.trim() !== ""
    ? node.id.trim()
    : `node:${index}`;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
