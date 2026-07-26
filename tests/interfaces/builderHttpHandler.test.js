import assert from "node:assert/strict";
import test from "node:test";
import { createNodeCatalogService } from "../../src/application/nodeCatalogService.js";
import { createWorkflowTemplateService } from "../../src/application/workflowTemplateService.js";
import { createBuilderHttpHandler } from "../../src/interfaces/builderHttpHandler.js";

test("builder http handler exposes node forms", async () => {
  const handler = createBuilderHandler();
  const response = await handler.handle({
    method: "GET",
    path: "/builder/node-forms"
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.body.forms.some((form) => form.node_type === "http_request"),
    true
  );
});

test("builder http handler exposes workflow templates and draft creation", async () => {
  const handler = createBuilderHandler();
  const templates = await handler.handle({
    method: "GET",
    path: "/workflow-templates"
  });
  const draft = await handler.handle({
    method: "POST",
    path: "/workflow-templates/draft",
    body: {
      template_id: "manual-http-slack-alert",
      name: "Production Alert"
    }
  });

  assert.equal(templates.status, 200);
  assert.equal(templates.body.templates[0].id, "manual-http-slack-alert");
  assert.equal(draft.status, 200);
  assert.equal(draft.body.name, "Production Alert");
  assert.equal(draft.body.nodes[1].type, "http_request");
});

test("builder http handler maps template validation errors to bad requests", async () => {
  const handler = createBuilderHandler();
  const response = await handler.handle({
    method: "POST",
    path: "/workflow-templates/draft",
    body: {
      template_id: ""
    }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "workflow_template_invalid");
});

function createBuilderHandler() {
  return createBuilderHttpHandler({
    nodeCatalogService: createNodeCatalogService(),
    workflowTemplateService: createWorkflowTemplateService()
  });
}
