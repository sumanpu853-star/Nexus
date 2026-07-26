import assert from "node:assert/strict";
import test from "node:test";
import { createNodeCatalogService } from "../../src/application/nodeCatalogService.js";

test("node catalog service lists schema-driven node definitions", async () => {
  const service = createNodeCatalogService();
  const definitions = await service.listNodeDefinitions();
  const http = definitions.find((definition) => definition.type === "http_request");

  assert.equal(Boolean(http), true);
  assert.equal(http.parameter_schema.fields.some((field) => field.name === "url"), true);
  assert.equal(Object.isFrozen(http.parameter_schema.fields[0]), true);
});

test("node catalog service can hide disabled node definitions", async () => {
  const service = createNodeCatalogService();
  const definitions = await service.listNodeDefinitions({
    include_disabled: false
  });

  assert.equal(
    definitions.some((definition) => definition.type === "python_script"),
    false
  );
});

test("node catalog service returns individual node definitions", async () => {
  const service = createNodeCatalogService();
  const definition = await service.getNodeDefinition({
    type: "slack"
  });

  assert.equal(definition.label, "Slack Message");
  assert.equal(definition.credential_requirements[0].type, "slack_bot_token");
  await assert.rejects(
    () => service.getNodeDefinition({ type: "missing" }),
    /not available/
  );
});

test("node catalog service exposes form-rendering metadata", async () => {
  const service = createNodeCatalogService();
  const forms = await service.listNodeFormDefinitions();
  const httpForm = forms.find((form) => form.node_type === "http_request");

  assert.equal(Boolean(httpForm), true);
  assert.deepEqual(
    httpForm.fields.map((field) => [field.name, field.control]),
    [
      ["method", "select"],
      ["url", "text"],
      ["headers", "key_value"],
      ["query", "key_value"],
      ["body", "json"]
    ]
  );
  assert.equal(
    forms.some((form) => form.node_type === "python_script"),
    false
  );
});

test("node catalog service rejects duplicate custom node definitions", () => {
  assert.throws(
    () =>
      createNodeCatalogService({
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
