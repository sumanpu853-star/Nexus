export function createInMemoryWorkflowSourceControlRepositories(initialState = {}) {
  const exportsById = new Map();
  const exportsByWorkflowId = new Map();

  for (const exportRecord of initialState.exports ?? []) {
    saveExport(exportRecord);
  }

  return Object.freeze({
    exports: Object.freeze({
      async findById(id) {
        return cloneOrNull(exportsById.get(id));
      },

      async findByWorkflowId(workflowId) {
        return cloneArray(exportsByWorkflowId.get(workflowId) ?? []);
      },

      async findAll() {
        return cloneArray([...exportsById.values()]);
      },

      async save(exportRecord) {
        saveExport(exportRecord);

        return cloneOrNull(exportRecord);
      }
    })
  });

  function saveExport(exportRecord) {
    const existing = exportsById.get(exportRecord.id);

    if (existing && existing.workflow_id !== exportRecord.workflow_id) {
      const previous = exportsByWorkflowId.get(existing.workflow_id) ?? [];
      exportsByWorkflowId.set(
        existing.workflow_id,
        previous.filter((entry) => entry.id !== exportRecord.id)
      );
    }

    exportsById.set(exportRecord.id, clone(exportRecord));

    const exportsForWorkflow = exportsByWorkflowId.get(exportRecord.workflow_id) ?? [];
    const withoutDuplicate = exportsForWorkflow.filter((entry) =>
      entry.id !== exportRecord.id
    );

    exportsByWorkflowId.set(exportRecord.workflow_id, [
      ...withoutDuplicate,
      clone(exportRecord)
    ]);
  }
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
