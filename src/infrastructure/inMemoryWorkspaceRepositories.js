export function createInMemoryWorkspaceRepositories(initialState = {}) {
  const workspacesById = new Map();
  const membershipsByWorkspaceId = new Map();
  const projectLinksByWorkspaceId = new Map();
  const projectLinksByProjectId = new Map();

  for (const workspace of initialState.workspaces ?? []) {
    saveWorkspace(workspace);
  }

  for (const membership of initialState.memberships ?? []) {
    saveMembership(membership);
  }

  for (const link of initialState.projectLinks ?? []) {
    saveProjectLink(link);
  }

  return Object.freeze({
    workspaces: Object.freeze({
      async findById(id) {
        return cloneOrNull(workspacesById.get(id));
      },

      async findAll() {
        return cloneArray([...workspacesById.values()]);
      },

      async save(workspace) {
        saveWorkspace(workspace);

        return cloneOrNull(workspace);
      }
    }),

    memberships: Object.freeze({
      async findByWorkspaceId(workspaceId) {
        return cloneArray(membershipsByWorkspaceId.get(workspaceId) ?? []);
      },

      async save(membership) {
        saveMembership(membership);

        return cloneOrNull(membership);
      }
    }),

    projectLinks: Object.freeze({
      async findByWorkspaceId(workspaceId) {
        return cloneArray(projectLinksByWorkspaceId.get(workspaceId) ?? []);
      },

      async findByProjectId(projectId) {
        return cloneOrNull(projectLinksByProjectId.get(projectId));
      },

      async save(link) {
        saveProjectLink(link);

        return cloneOrNull(link);
      }
    })
  });

  function saveWorkspace(workspace) {
    workspacesById.set(workspace.id, clone(workspace));
  }

  function saveMembership(membership) {
    const existing = membershipsByWorkspaceId.get(membership.workspace_id) ?? [];
    const withoutDuplicate = existing.filter((entry) =>
      entry.user_id !== membership.user_id
    );

    membershipsByWorkspaceId.set(membership.workspace_id, [
      ...withoutDuplicate,
      clone(membership)
    ]);
  }

  function saveProjectLink(link) {
    const existing = projectLinksByProjectId.get(link.project_id);

    if (existing && existing.workspace_id !== link.workspace_id) {
      const previousLinks = projectLinksByWorkspaceId.get(existing.workspace_id) ?? [];
      projectLinksByWorkspaceId.set(
        existing.workspace_id,
        previousLinks.filter((entry) => entry.project_id !== link.project_id)
      );
    }

    projectLinksByProjectId.set(link.project_id, clone(link));

    const links = projectLinksByWorkspaceId.get(link.workspace_id) ?? [];
    const withoutDuplicate = links.filter((entry) =>
      entry.project_id !== link.project_id
    );

    projectLinksByWorkspaceId.set(link.workspace_id, [
      ...withoutDuplicate,
      clone(link)
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
