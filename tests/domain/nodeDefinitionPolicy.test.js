import assert from "node:assert/strict";
import test from "node:test";
import {
  NODE_CATEGORIES,
  NODE_PARAMETER_CONTROLS,
  NODE_PARAMETER_TYPES,
  applyWorkflowNodeDefinitionDefaults,
  assertWorkflowNodesMatchDefinitions,
  createNodeDefinition,
  findNodeDefinitionByType,
  findWorkflowNodeDefinitionViolations,
  getBuiltInNodeDefinitions
} from "../../src/domain/nodeDefinitionPolicy.js";

test("node definition policy exposes built-in schema-driven node definitions", () => {
  const definitions = getBuiltInNodeDefinitions();
  const http = findNodeDefinitionByType({
    type: "http_request",
    nodeDefinitions: definitions
  });
  const knowledgeSearch = findNodeDefinitionByType({
    type: "knowledge_search",
    nodeDefinitions: definitions
  });

  assert.equal(definitions.length >= 6, true);
  assert.equal(http.label, "HTTP Request");
  assert.equal(http.category, NODE_CATEGORIES.ACTION);
  assert.equal(knowledgeSearch.category, NODE_CATEGORIES.AI);
  assert.equal(knowledgeSearch.availability.status, "available");
  assert.deepEqual(
    http.parameter_schema.fields.map((field) => [field.name, field.type, field.control]),
    [
      ["method", NODE_PARAMETER_TYPES.ENUM, NODE_PARAMETER_CONTROLS.SELECT],
      ["url", NODE_PARAMETER_TYPES.URL, NODE_PARAMETER_CONTROLS.TEXT],
      ["headers", NODE_PARAMETER_TYPES.OBJECT, NODE_PARAMETER_CONTROLS.KEY_VALUE],
      ["query", NODE_PARAMETER_TYPES.OBJECT, NODE_PARAMETER_CONTROLS.KEY_VALUE],
      ["body", NODE_PARAMETER_TYPES.OBJECT, NODE_PARAMETER_CONTROLS.JSON]
    ]
  );
  assert.equal(Object.isFrozen(http.parameter_schema.fields[0]), true);
});

test("node definition policy exposes knowledge search form defaults", () => {
  const normalized = applyWorkflowNodeDefinitionDefaults({
    nodes: [
      {
        id: "search",
        type: "knowledge_search",
        parameters: {
          knowledge_base_id: "knowledge_base_1",
          query: "reset password"
        }
      }
    ]
  });

  assert.deepEqual(normalized[0].parameters, {
    knowledge_base_id: "knowledge_base_1",
    query: "reset password",
    limit: 5,
    rerank: true,
    filters: {}
  });
});

test("node definition policy exposes agent model, memory, and visibility defaults", () => {
  const normalized = applyWorkflowNodeDefinitionDefaults({
    nodes: [
      {
        id: "agent",
        type: "agent",
        parameters: {
          instructions: "Answer support questions."
        }
      }
    ]
  });

  assert.deepEqual(normalized[0].parameters, {
    model: "nexus-agent-deterministic-v1",
    temperature: 0.2,
    instructions: "Answer support questions.",
    tools: [],
    memory_scope: "session",
    memory_key: "default",
    tool_call_visibility: true
  });
});

test("node definition policy applies labels, parameters, and credential defaults", () => {
  const normalized = applyWorkflowNodeDefinitionDefaults({
    nodes: [
      {
        id: "http",
        type: "http_request",
        parameters: {
          url: "https://example.com/api"
        }
      }
    ]
  });

  assert.deepEqual(normalized, [
    {
      id: "http",
      type: "http_request",
      label: "HTTP Request",
      parameters: {
        method: "GET",
        url: "https://example.com/api",
        headers: {},
        query: {},
        body: {}
      },
      credential_refs: {}
    }
  ]);
  assert.equal(Object.isFrozen(normalized[0].parameters), true);
});

test("node definition policy validates required fields, unsupported fields, and formats", () => {
  const violations = findWorkflowNodeDefinitionViolations({
    nodes: [
      {
        id: "http",
        type: "http_request",
        parameters: {
          method: "TRACE",
          url: "ftp://example.com",
          surprise: true
        }
      },
      {
        id: "slack",
        type: "slack",
        parameters: {
          channel: "#ops"
        }
      },
      {
        id: "unknown",
        type: "spreadsheet"
      }
    ]
  });

  assert.deepEqual(
    violations.map((violation) => violation.type),
    [
      "unsupported_node_parameter",
      "invalid_node_parameter_type",
      "invalid_node_parameter_format",
      "required_node_parameter_missing",
      "unsupported_node_type"
    ]
  );
});

test("node definition policy validates credential ref shapes", () => {
  const violations = findWorkflowNodeDefinitionViolations({
    nodes: [
      {
        id: "slack",
        type: "slack",
        parameters: {
          channel: "#ops",
          message: "Done"
        },
        credential_refs: {
          slack: "",
          github: "credential_1"
        }
      }
    ]
  });

  assert.deepEqual(
    violations.map((violation) => violation.type),
    ["invalid_node_credential_ref", "unsupported_node_credential_ref"]
  );
});

test("node definition policy throws structured workflow validation errors", () => {
  assert.throws(
    () =>
      assertWorkflowNodesMatchDefinitions({
        nodes: [{ id: "http", type: "http_request", parameters: {} }]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowNodeDefinitionValidationError");
      assert.equal(error.code, "workflow_node_definition_invalid");
      assert.equal(error.violations[0].type, "required_node_parameter_missing");
      return true;
    }
  );
});

test("node definition policy rejects malformed custom definitions", () => {
  assert.throws(
    () =>
      createNodeDefinition({
        type: "bad",
        label: "Bad",
        category: "action",
        icon: "box",
        parameter_schema: {
          fields: [
            {
              name: "mode",
              label: "Mode",
              type: "enum",
              control: "select",
              default: "missing",
              options: ["ok"]
            }
          ]
        }
      }),
    /default does not match/
  );
});

test("node definition policy rejects duplicate custom definition types", () => {
  assert.throws(
    () =>
      findWorkflowNodeDefinitionViolations({
        nodes: [],
        nodeDefinitions: [
          {
            type: "custom",
            label: "Custom",
            category: "action",
            icon: "box",
            parameter_schema: { fields: [] }
          },
          {
            type: "custom",
            label: "Custom Again",
            category: "action",
            icon: "box",
            parameter_schema: { fields: [] }
          }
        ]
      }),
    /duplicated/
  );
});
