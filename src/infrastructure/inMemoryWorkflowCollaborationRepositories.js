export function createInMemoryWorkflowCollaborationRepositories(initialState = {}) {
  const versionsById = new Map();
  const versionsByWorkflowId = new Map();
  const commentsById = new Map();
  const commentsByWorkflowId = new Map();
  const templatesById = new Map();
  const templatesByProjectId = new Map();

  for (const version of initialState.versions ?? []) {
    saveVersion(version);
  }

  for (const comment of initialState.comments ?? []) {
    saveComment(comment);
  }

  for (const template of initialState.templates ?? []) {
    saveTemplate(template);
  }

  return Object.freeze({
    versions: Object.freeze({
      async findById(id) {
        return cloneOrNull(versionsById.get(id));
      },

      async findByWorkflowId(workflowId) {
        return cloneArray(versionsByWorkflowId.get(workflowId) ?? []);
      },

      async findAll() {
        return cloneArray([...versionsById.values()]);
      },

      async save(version) {
        saveVersion(version);

        return cloneOrNull(version);
      }
    }),

    comments: Object.freeze({
      async findById(id) {
        return cloneOrNull(commentsById.get(id));
      },

      async findByWorkflowId(workflowId) {
        return cloneArray(commentsByWorkflowId.get(workflowId) ?? []);
      },

      async findAll() {
        return cloneArray([...commentsById.values()]);
      },

      async save(comment) {
        saveComment(comment);

        return cloneOrNull(comment);
      }
    }),

    templates: Object.freeze({
      async findById(id) {
        return cloneOrNull(templatesById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(templatesByProjectId.get(projectId) ?? []);
      },

      async findAll() {
        return cloneArray([...templatesById.values()]);
      },

      async save(template) {
        saveTemplate(template);

        return cloneOrNull(template);
      }
    })
  });

  function saveVersion(version) {
    const existing = versionsById.get(version.id);

    if (existing && existing.workflow_id !== version.workflow_id) {
      removeFromIndex({
        index: versionsByWorkflowId,
        key: existing.workflow_id,
        id: existing.id
      });
    }

    versionsById.set(version.id, clone(version));
    upsertIndexEntry({
      index: versionsByWorkflowId,
      key: version.workflow_id,
      value: version
    });
  }

  function saveComment(comment) {
    const existing = commentsById.get(comment.id);

    if (existing && existing.workflow_id !== comment.workflow_id) {
      removeFromIndex({
        index: commentsByWorkflowId,
        key: existing.workflow_id,
        id: existing.id
      });
    }

    commentsById.set(comment.id, clone(comment));
    upsertIndexEntry({
      index: commentsByWorkflowId,
      key: comment.workflow_id,
      value: comment
    });
  }

  function saveTemplate(template) {
    const existing = templatesById.get(template.id);

    if (existing && existing.project_id !== template.project_id) {
      removeFromIndex({
        index: templatesByProjectId,
        key: existing.project_id,
        id: existing.id
      });
    }

    templatesById.set(template.id, clone(template));
    upsertIndexEntry({
      index: templatesByProjectId,
      key: template.project_id,
      value: template
    });
  }
}

function upsertIndexEntry({
  index,
  key,
  value
}) {
  const existing = index.get(key) ?? [];
  const withoutDuplicate = existing.filter((entry) => entry.id !== value.id);

  index.set(key, [
    ...withoutDuplicate,
    clone(value)
  ]);
}

function removeFromIndex({
  index,
  key,
  id
}) {
  const existing = index.get(key) ?? [];

  index.set(
    key,
    existing.filter((entry) => entry.id !== id)
  );
}

function cloneOrNull(value) {
  return value ? clone(value) : null;
}

function cloneArray(values) {
  return values.map((value) => clone(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
