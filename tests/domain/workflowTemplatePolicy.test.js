import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkflowDraftFromTemplate,
  createWorkflowTemplate,
  findWorkflowTemplateById,
  getBuiltInWorkflowTemplates
} from "../../src/domain/workflowTemplatePolicy.js";

test("workflow template policy exposes validated built-in templates", () => {
  const templates = getBuiltInWorkflowTemplates();
  const template = findWorkflowTemplateById({
    template_id: "manual-http-slack-alert",
    templates
  });

  assert.equal(Boolean(template), true);
  assert.deepEqual(
    template.nodes.map((node) => node.id),
    ["manual", "http", "notify", "error_notify"]
  );
  assert.equal(template.nodes[1].parameters.method, "GET");
  assert.equal(template.edges[2].type, "error");
  assert.equal(Object.isFrozen(template.nodes[0]), true);
});

test("workflow template policy creates workflow drafts from templates", () => {
  const template = findWorkflowTemplateById({
    template_id: "manual-agent-review"
  });
  const draft = createWorkflowDraftFromTemplate({
    template,
    name: "Review Incoming Ticket"
  });

  assert.equal(draft.name, "Review Incoming Ticket");
  assert.equal(draft.description, template.description);
  assert.deepEqual(
    draft.nodes.map((node) => node.type),
    ["manual", "agent", "slack"]
  );
});

test("workflow template policy rejects invalid template graphs and node parameters", () => {
  assert.throws(
    () =>
      createWorkflowTemplate({
        id: "bad",
        name: "Bad",
        nodes: [
          {
            id: "http",
            type: "http_request",
            parameters: { url: "not-a-url" }
          }
        ]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowNodeDefinitionValidationError");
      return true;
    }
  );
});
