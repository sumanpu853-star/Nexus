import assert from "node:assert/strict";
import test from "node:test";
import { createWorkflowTemplateService } from "../../src/application/workflowTemplateService.js";

test("workflow template service lists immutable templates", async () => {
  const service = createWorkflowTemplateService();
  const templates = await service.listWorkflowTemplates();

  assert.equal(
    templates.some((template) => template.id === "manual-http-slack-alert"),
    true
  );
  assert.equal(Object.isFrozen(templates[0].nodes[0]), true);
});

test("workflow template service creates drafts from templates", async () => {
  const service = createWorkflowTemplateService();
  const draft = await service.createWorkflowDraft({
    template_id: "manual-http-slack-alert",
    name: "Production Alert"
  });

  assert.equal(draft.name, "Production Alert");
  assert.equal(draft.nodes[1].type, "http_request");
  assert.equal(draft.edges[2].type, "error");
  await assert.rejects(
    () => service.createWorkflowDraft({ template_id: "missing" }),
    /not available/
  );
});

test("workflow template service validates custom template catalogs", () => {
  assert.throws(
    () => createWorkflowTemplateService({
      templates: [
        {
          id: "invalid",
          name: "Invalid",
          nodes: [
            {
              id: "http",
              type: "http_request",
              parameters: {
                url: ""
              }
            }
          ],
          edges: []
        }
      ]
    }),
    /Workflow nodes do not match their node definitions/
  );
});
