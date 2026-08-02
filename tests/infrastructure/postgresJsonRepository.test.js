import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createWorkspaceAdministrationService } from "../../src/application/workspaceAdministrationService.js";
import {
  createPostgresJsonRepository,
  createPostgresRuntimeRepositories
} from "../../src/infrastructure/postgresJsonRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("postgres json repository stores and queries durable records", async () => {
  const sqlClient = createFakePostgresClient();
  const repository = createPostgresJsonRepository({
    sqlClient,
    resource: "workflows"
  });

  await repository.save({
    id: "workflow_1",
    project_id: "project_1",
    name: "Support"
  });
  await repository.save({
    id: "workflow_2",
    project_id: "project_2",
    name: "Finance"
  });

  assert.equal((await repository.findById("workflow_1")).name, "Support");
  assert.deepEqual(
    (await repository.findByProjectId("project_1")).map((workflow) => workflow.id),
    ["workflow_1"]
  );
  assert.equal(sqlClient.queryLog.some((entry) => entry.text.includes("$1")), true);
});

test("postgres runtime repositories satisfy project workflow service ports", async () => {
  const repositories = createPostgresRuntimeRepositories({
    sqlClient: createFakePostgresClient()
  });
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const { project } = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Durable Workflow",
    nodes: [{ id: "manual", type: "manual" }]
  });

  assert.equal((await repositories.projects.findById(project.id)).name, "AI Workflows");
  assert.equal((await repositories.memberships.findByProjectId(project.id)).length, 1);
  assert.equal((await repositories.workflows.findByProjectId(project.id))[0].id, workflow.id);
});

test("postgres runtime repositories expose phase 5 enterprise ports", async () => {
  const repositories = createPostgresRuntimeRepositories({
    sqlClient: createFakePostgresClient()
  });
  const ids = sequenceIds();
  const service = createWorkspaceAdministrationService({
    workspaceRepository: repositories.workspaces,
    workspaceMembershipRepository: repositories.workspaceMemberships,
    workspaceProjectLinkRepository: repositories.workspaceProjectLinks,
    projectRepository: repositories.projects,
    idGenerator: ids,
    clock: () => new Date(timestamp)
  });

  await repositories.projects.save({
    id: "project_1",
    owner_id: "owner_1",
    name: "Enterprise Project"
  });

  const { workspace } = await service.createWorkspace({
    actor: { id: "owner_1" },
    name: "Enterprise Workspace"
  });

  await service.addWorkspaceMember({
    actor: { id: "owner_1" },
    workspace_id: workspace.id,
    user_id: "member_1",
    role: "member"
  });
  await service.linkProjectToWorkspace({
    actor: { id: "owner_1" },
    workspace_id: workspace.id,
    project_id: "project_1"
  });
  await repositories.workflowExports.save({
    id: "export_1",
    workflow_id: "workflow_1",
    project_id: "project_1"
  });
  await repositories.auditEvents.save({
    id: "audit_1",
    action: "workspace.created"
  });

  assert.equal((await repositories.workspaces.findById(workspace.id)).name, "Enterprise Workspace");
  assert.equal((await repositories.workspaceMemberships.findByWorkspaceId(workspace.id)).length, 2);
  assert.equal((await repositories.workspaceProjectLinks.findByProjectId("project_1")).workspace_id, workspace.id);
  assert.equal((await repositories.workflowExports.findByWorkflowId("workflow_1"))[0].id, "export_1");
  assert.equal((await repositories.auditEvents.findAll()).length, 1);
});

function createFakePostgresClient() {
  const records = new Map();

  return {
    queryLog: [],
    async query(statement) {
      this.queryLog.push(statement);
      const text = statement.text.toLowerCase();
      const values = statement.values ?? [];

      if (text.startsWith("insert into")) {
        const [resource, id, payload] = values;
        records.set(`${resource}:${id}`, {
          resource,
          id,
          payload: JSON.parse(payload)
        });

        return { rows: [] };
      }

      if (text.includes("and id = $2")) {
        const [resource, id] = values;
        const record = records.get(`${resource}:${id}`);

        return { rows: record ? [{ payload: record.payload }] : [] };
      }

      const [resource, ...fieldValues] = values;
      const fieldPairs = [];

      for (let index = 0; index < fieldValues.length; index += 2) {
        fieldPairs.push([fieldValues[index], fieldValues[index + 1]]);
      }

      return {
        rows: [...records.values()]
          .filter((record) =>
            record.resource === resource &&
            fieldPairs.every(([field, value]) => String(record.payload[field]) === value)
          )
          .map((record) => ({ payload: record.payload }))
      };
    },
    async transaction(callback) {
      return callback();
    }
  };
}

function sequenceIds() {
  const counters = new Map();

  return {
    nextId(prefix) {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);

      return `${prefix}_${next}`;
    }
  };
}
