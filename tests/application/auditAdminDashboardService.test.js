import assert from "node:assert/strict";
import test from "node:test";
import { createAdminDashboardService } from "../../src/application/adminDashboardService.js";
import { createAuditLogService } from "../../src/application/auditLogService.js";
import { createWorkflowQueueService } from "../../src/application/workflowQueueService.js";
import {
  createWorkflowQueueJobRecord
} from "../../src/domain/workflowQueuePolicy.js";
import { createInMemoryAuditLogRepository } from "../../src/infrastructure/inMemoryAuditLogRepository.js";
import {
  createInMemoryWorkflowQueueRepository
} from "../../src/infrastructure/inMemoryWorkflowQueueRepository.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("audit log service records and gates audit events", async () => {
  const service = createAuditLogService({
    auditEventRepository: createInMemoryAuditLogRepository(),
    adminActorIds: ["admin_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });

  await service.recordAuditEvent({
    actor: { id: "owner_1" },
    action: "workflow.export",
    project_id: "project_1",
    resource_type: "workflow",
    resource_id: "workflow_1"
  });

  const events = await service.listAuditEvents({
    actor: { id: "admin_1" },
    project_id: "project_1"
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].action, "workflow.export");
  await assert.rejects(
    () =>
      service.listAuditEvents({
        actor: { id: "viewer_1" }
      }),
    /audit log admin permission/
  );
});

test("admin dashboard service summarizes counts, queues, readiness, and audits", async () => {
  const auditService = createAuditLogService({
    auditEventRepository: createInMemoryAuditLogRepository(),
    adminActorIds: ["admin_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const queueRepository = createInMemoryWorkflowQueueRepository({
    jobs: [
      createWorkflowQueueJobRecord({
        id: "queue_job_1",
        type: "workflow_execution",
        status: "dead_lettered",
        priority: 100,
        idempotency_key: "job_1",
        payload: {
          project_id: "project_1",
          workflow_id: "workflow_1",
          execution_id: "execution_1"
        },
        attempts: 3,
        max_attempts: 3,
        available_at: timestamp,
        failed_at: timestamp,
        last_error: { message: "Failed" },
        created_at: timestamp
      })
    ]
  });
  const queueService = createWorkflowQueueService({
    queueRepository,
    workerActorIds: ["admin_1"],
    clock: () => new Date(timestamp)
  });

  await auditService.recordAuditEvent({
    actor: { id: "owner_1" },
    action: "workspace.create",
    workspace_id: "workspace_1",
    resource_type: "workspace",
    resource_id: "workspace_1"
  });

  const dashboard = await createAdminDashboardService({
    countRepositories: {
      workspaces: async () => 1,
      projects: async () => 2,
      workflows: async () => 3
    },
    workflowQueueService: queueService,
    productionAdapterService: {
      async getProductionReadiness() {
        return {
          status: "ready",
          missing_required_adapters: []
        };
      }
    },
    auditLogService: auditService,
    adminActorIds: ["admin_1"],
    clock: () => new Date(timestamp)
  }).getAdminDashboard({
    actor: { id: "admin_1" }
  });

  assert.equal(dashboard.status, "action_required");
  assert.deepEqual(dashboard.counts, {
    workspaces: 1,
    projects: 2,
    workflows: 3
  });
  assert.equal(dashboard.queue_summary.dead_lettered_jobs, 1);
  assert.equal(dashboard.audit_summary.event_count, 1);
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
