import {
  DEPLOYMENT_STATUSES
} from "../domain/deploymentPolicy.js";

export function createInMemoryDeploymentRepositories(initialState = {}) {
  const environmentsById = new Map();
  const environmentsByProjectId = new Map();
  const environmentsByProjectEnvironment = new Map();
  const deploymentsById = new Map();
  const deploymentsByProjectId = new Map();

  for (const environment of initialState.environments ?? []) {
    saveEnvironment(environment);
  }

  for (const deployment of initialState.deployments ?? []) {
    saveDeployment(deployment);
  }

  return Object.freeze({
    environments: Object.freeze({
      async findByProjectId(projectId) {
        return cloneArray(environmentsByProjectId.get(projectId) ?? []);
      },

      async findByProjectEnvironment({
        project_id,
        environment
      } = {}) {
        const id = environmentsByProjectEnvironment.get(
          projectEnvironmentKey(project_id, environment)
        );

        return id ? cloneOrNull(environmentsById.get(id)) : null;
      },

      async save(environment) {
        saveEnvironment(environment);

        return cloneOrNull(environment);
      }
    }),

    deployments: Object.freeze({
      async findById(id) {
        return cloneOrNull(deploymentsById.get(id));
      },

      async findByProjectId(projectId) {
        return cloneArray(deploymentsByProjectId.get(projectId) ?? []);
      },

      async findActiveByWorkflowEnvironment({
        project_id,
        workflow_id,
        environment
      } = {}) {
        const deployments = deploymentsByProjectId.get(project_id) ?? [];
        const active = [...deployments].reverse().find(
          (deployment) =>
            deployment.workflow_id === workflow_id &&
            deployment.environment === environment &&
            deployment.status === DEPLOYMENT_STATUSES.ACTIVE
        );

        return cloneOrNull(active);
      },

      async save(deployment) {
        saveDeployment(deployment);

        return cloneOrNull(deployment);
      }
    })
  });

  function saveEnvironment(environment) {
    const existing = environmentsById.get(environment.id);

    if (existing) {
      removeFromIndex({
        index: environmentsByProjectId,
        key: existing.project_id,
        id: environment.id
      });
      environmentsByProjectEnvironment.delete(
        projectEnvironmentKey(existing.project_id, existing.environment)
      );
    }

    environmentsById.set(environment.id, clone(environment));
    environmentsByProjectEnvironment.set(
      projectEnvironmentKey(environment.project_id, environment.environment),
      environment.id
    );
    upsertInIndex({
      index: environmentsByProjectId,
      key: environment.project_id,
      value: environment
    });
  }

  function saveDeployment(deployment) {
    const existing = deploymentsById.get(deployment.id);

    if (existing) {
      removeFromIndex({
        index: deploymentsByProjectId,
        key: existing.project_id,
        id: deployment.id
      });
    }

    deploymentsById.set(deployment.id, clone(deployment));
    upsertInIndex({
      index: deploymentsByProjectId,
      key: deployment.project_id,
      value: deployment
    });
  }
}

function projectEnvironmentKey(projectId, environment) {
  return `${projectId}:${environment}`;
}

function upsertInIndex({
  index,
  key,
  value
}) {
  const values = index.get(key) ?? [];
  const withoutDuplicate = values.filter((entry) => entry.id !== value.id);

  index.set(key, [...withoutDuplicate, clone(value)]);
}

function removeFromIndex({
  index,
  key,
  id
}) {
  const values = index.get(key) ?? [];

  index.set(key, values.filter((entry) => entry.id !== id));
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
