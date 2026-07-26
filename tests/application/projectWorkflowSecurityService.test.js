import assert from "node:assert/strict";
import test from "node:test";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("createProjectForUser creates owner membership for project isolation", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  const result = await service.createProjectForUser({
    actor: { id: "user_1" },
    name: "Ops Automation"
  });

  assert.equal(result.project.owner_id, "user_1");
  assert.deepEqual(result.membership, {
    project_id: "project_1",
    user_id: "user_1",
    role: PROJECT_ROLES.OWNER,
    created_at: timestamp
  });
});

test("createWorkflow requires project membership with write permission", async () => {
  const repositories = createInMemorySecurityRepositories();
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
  await service.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "RAG Intake",
    nodes: [{ id: "manual", type: "manual" }],
    edges: []
  });

  assert.equal(workflow.project_id, project.id);
  assert.equal(workflow.owner_id, "owner_1");
  assert.equal(workflow.nodes[0].timeout_ms, 30000);
  assert.deepEqual(workflow.nodes[0].retry_policy, {
    max_attempts: 1,
    backoff: "fixed",
    initial_delay_ms: 0,
    max_delay_ms: 0
  });
  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "viewer_1" },
        project_id: project.id,
        name: "Viewer Workflow"
      }),
    /required project permission/
  );
});

test("createWorkflow disables python_script until a sandboxed runner exists", async () => {
  const repositories = createInMemorySecurityRepositories();
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

  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        name: "Unsafe Python Workflow",
        nodes: [{ id: "script_1", type: "python_script" }]
      }),
    (error) => {
      assert.equal(error.name, "UnsafeExecutionError");
      assert.equal(error.violations[0].node_type, "python_script");
      return true;
    }
  );
  assert.deepEqual(await repositories.workflows.findByProjectId(project.id), []);
});

test("createWorkflow rejects invalid workflow graphs before persistence", async () => {
  const repositories = createInMemorySecurityRepositories();
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

  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        name: "Broken Workflow",
        nodes: [{ id: "trigger", type: "manual" }],
        edges: [{ id: "bad_edge", source: "trigger", target: "missing" }]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowGraphValidationError");
      assert.equal(error.violations[0].type, "missing_edge_target");
      return true;
    }
  );
  assert.deepEqual(await repositories.workflows.findByProjectId(project.id), []);
});

test("createWorkflow rejects cyclic workflow graphs", async () => {
  const repositories = createInMemorySecurityRepositories();
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

  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        name: "Cyclic Workflow",
        nodes: [
          { id: "a", type: "manual" },
          { id: "b", type: "http_request" }
        ],
        edges: [
          { id: "a_to_b", source: "a", target: "b" },
          { id: "b_to_a", source: "b", target: "a" }
        ]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowGraphValidationError");
      assert.equal(error.violations[0].type, "cycle");
      return true;
    }
  );
  assert.deepEqual(await repositories.workflows.findByProjectId(project.id), []);
});

test("createWorkflow persists explicit retry and timeout policies", async () => {
  const repositories = createInMemorySecurityRepositories();
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
    name: "Retrying HTTP Workflow",
    nodes: [
      {
        id: "http",
        type: "http_request",
        timeout_ms: 15_000,
        retry_policy: {
          max_attempts: 3,
          backoff: "exponential",
          initial_delay_ms: 2_000,
          max_delay_ms: 20_000
        }
      }
    ]
  });

  assert.equal(workflow.nodes[0].timeout_ms, 15_000);
  assert.deepEqual(workflow.nodes[0].retry_policy, {
    max_attempts: 3,
    backoff: "exponential",
    initial_delay_ms: 2_000,
    max_delay_ms: 20_000
  });
});

test("createWorkflow rejects invalid retry and timeout policies before persistence", async () => {
  const repositories = createInMemorySecurityRepositories();
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

  await assert.rejects(
    () =>
      service.createWorkflow({
        actor: { id: "owner_1" },
        project_id: project.id,
        name: "Invalid Runtime Policy",
        nodes: [
          {
            id: "http",
            type: "http_request",
            timeout_ms: 0,
            retry_policy: {
              max_attempts: 10
            }
          }
        ]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowNodeExecutionPolicyError");
      assert.deepEqual(
        error.violations.map((violation) => violation.type),
        ["timeout_out_of_range", "retry_attempts_out_of_range"]
      );
      return true;
    }
  );
  assert.deepEqual(await repositories.workflows.findByProjectId(project.id), []);
});

test("createWorkflow allows python_script when a sandboxed runner is configured", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    runnerCapabilities: {
      python_script: {
        sandboxed: true
      }
    },
    clock: () => new Date(timestamp)
  });
  const { project } = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });

  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Sandboxed Python Workflow",
    nodes: [{ id: "script_1", type: "python_script" }]
  });

  assert.equal(workflow.name, "Sandboxed Python Workflow");
});

test("listProjectWorkflows allows viewers and blocks outsiders", async () => {
  const repositories = createInMemorySecurityRepositories();
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
  await service.addProjectMember({
    actor: { id: "owner_1" },
    project_id: project.id,
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });
  await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "RAG Intake"
  });

  const workflows = await service.listProjectWorkflows({
    actor: { id: "viewer_1" },
    project_id: project.id
  });

  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].name, "RAG Intake");
  await assert.rejects(
    () =>
      service.listProjectWorkflows({
        actor: { id: "outsider_1" },
        project_id: project.id
      }),
    /does not belong/
  );
});

test("getWorkflow blocks cross-project workflow access", async () => {
  const repositories = createInMemorySecurityRepositories();
  const service = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const first = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "First Project"
  });
  const second = await service.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Second Project"
  });
  const workflow = await service.createWorkflow({
    actor: { id: "owner_1" },
    project_id: first.project.id,
    name: "RAG Intake"
  });

  await assert.rejects(
    () =>
      service.getWorkflow({
        actor: { id: "owner_1" },
        project_id: second.project.id,
        workflow_id: workflow.id
      }),
    /not available/
  );
});

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
