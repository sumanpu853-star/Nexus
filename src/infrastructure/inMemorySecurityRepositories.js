export function createInMemorySecurityRepositories(initialState = {}) {
  const usersById = new Map();
  const usersByEmail = new Map();
  const projectsById = new Map();
  const membershipsByProjectId = new Map();
  const workflowsById = new Map();
  const workflowsByProjectId = new Map();

  for (const user of initialState.users ?? []) {
    saveUser(user);
  }

  for (const project of initialState.projects ?? []) {
    saveProject(project);
  }

  for (const membership of initialState.memberships ?? []) {
    saveMembership(membership);
  }

  for (const workflow of initialState.workflows ?? []) {
    saveWorkflow(workflow);
  }

  return Object.freeze({
    users: Object.freeze({
      async findById(id) {
        return cloneOrNull(usersById.get(id));
      },

      async findByEmail(email) {
        const id = usersByEmail.get(email);

        return id ? cloneOrNull(usersById.get(id)) : null;
      },

      async save(user) {
        saveUser(user);

        return cloneOrNull(user);
      }
    }),

    projects: Object.freeze({
      async findById(id) {
        return cloneOrNull(projectsById.get(id));
      },

      async save(project) {
        saveProject(project);

        return cloneOrNull(project);
      }
    }),

    memberships: Object.freeze({
      async findByProjectId(projectId) {
        return cloneArray(membershipsByProjectId.get(projectId) ?? []);
      },

      async save(membership) {
        saveMembership(membership);

        return cloneOrNull(membership);
      }
    }),

    workflows: Object.freeze({
      async findById(id) {
        return cloneOrNull(workflowsById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(workflowsByProjectId.get(projectId) ?? []);
      },

      async save(workflow) {
        saveWorkflow(workflow);

        return cloneOrNull(workflow);
      }
    })
  });

  function saveUser(user) {
    const existing = usersById.get(user.id);

    if (existing && existing.email !== user.email) {
      usersByEmail.delete(existing.email);
    }

    usersById.set(user.id, clone(user));
    usersByEmail.set(user.email, user.id);
  }

  function saveProject(project) {
    projectsById.set(project.id, clone(project));
  }

  function saveMembership(membership) {
    const existing = membershipsByProjectId.get(membership.project_id) ?? [];
    const withoutDuplicate = existing.filter(
      (entry) => entry.user_id !== membership.user_id
    );

    membershipsByProjectId.set(membership.project_id, [
      ...withoutDuplicate,
      clone(membership)
    ]);
  }

  function saveWorkflow(workflow) {
    const existingWorkflow = workflowsById.get(workflow.id);

    if (existingWorkflow && existingWorkflow.project_id !== workflow.project_id) {
      const previousProjectWorkflows = workflowsByProjectId.get(existingWorkflow.project_id) ?? [];
      workflowsByProjectId.set(
        existingWorkflow.project_id,
        previousProjectWorkflows.filter((entry) => entry.id !== workflow.id)
      );
    }

    workflowsById.set(workflow.id, clone(workflow));

    const projectWorkflows = workflowsByProjectId.get(workflow.project_id) ?? [];
    const withoutDuplicate = projectWorkflows.filter((entry) => entry.id !== workflow.id);

    workflowsByProjectId.set(workflow.project_id, [
      ...withoutDuplicate,
      clone(workflow)
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
