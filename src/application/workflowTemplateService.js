import {
  createWorkflowTemplate,
  createWorkflowDraftFromTemplate,
  findWorkflowTemplateById,
  getBuiltInWorkflowTemplates
} from "../domain/workflowTemplatePolicy.js";

export function createWorkflowTemplateService({
  templates = getBuiltInWorkflowTemplates()
} = {}) {
  assertTemplates(templates);
  const templateCatalog = templates.map((template) => createWorkflowTemplate(template));
  const seenIds = new Set();

  for (const template of templateCatalog) {
    if (seenIds.has(template.id)) {
      throw new TypeError(`Workflow template "${template.id}" is duplicated.`);
    }

    seenIds.add(template.id);
  }

  return Object.freeze({
    async listWorkflowTemplates() {
      return templateCatalog.map((template) => deepFreeze(deepClone(template)));
    },

    async createWorkflowDraft({
      template_id,
      name,
      description
    } = {}) {
      const template = findWorkflowTemplateById({
        template_id,
        templates: templateCatalog
      });

      if (!template) {
        throw new TypeError(`Workflow template "${template_id}" is not available.`);
      }

      return createWorkflowDraftFromTemplate({
        template,
        name,
        description
      });
    }
  });
}

function assertTemplates(templates) {
  if (!Array.isArray(templates)) {
    throw new TypeError("createWorkflowTemplateService requires templates to be an array.");
  }
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
