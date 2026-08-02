import assert from "node:assert/strict";
import test from "node:test";
import { createAdminDashboardService } from "../../src/application/adminDashboardService.js";
import { createAuditLogService } from "../../src/application/auditLogService.js";
import { createInMemoryAuditLogRepository } from "../../src/infrastructure/inMemoryAuditLogRepository.js";
import {
  createAdminDashboardHttpHandler
} from "../../src/interfaces/adminDashboardHttpHandler.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("admin dashboard http handler records and lists audit events", async () => {
  const { handler } = createAdminHttpFixture();

  const created = await handler.handle({
    method: "POST",
    path: "/audit-events",
    actor: { id: "owner_1" },
    body: {
      action: "workflow.export",
      project_id: "project_1",
      resource_type: "workflow",
      resource_id: "workflow_1"
    }
  });
  const events = await handler.handle({
    method: "GET",
    path: "/audit-events",
    actor: { id: "admin_1" },
    query: { project_id: "project_1" }
  });
  const dashboard = await handler.handle({
    method: "GET",
    path: "/admin-dashboard",
    actor: { id: "admin_1" }
  });

  assert.equal(created.status, 201);
  assert.equal(events.body.events.length, 1);
  assert.equal(dashboard.body.dashboard.audit_summary.event_count, 1);
});

test("admin dashboard http handler gates admin views", async () => {
  const { handler } = createAdminHttpFixture();
  const response = await handler.handle({
    method: "GET",
    path: "/admin-dashboard",
    actor: { id: "viewer_1" }
  });

  assert.equal(response.status, 403);
});

function createAdminHttpFixture() {
  const auditLogService = createAuditLogService({
    auditEventRepository: createInMemoryAuditLogRepository(),
    adminActorIds: ["admin_1"],
    idGenerator: sequenceIds(),
    clock: () => new Date(timestamp)
  });
  const adminDashboardService = createAdminDashboardService({
    countRepositories: {
      projects: async () => 0,
      workflows: async () => 0
    },
    auditLogService,
    adminActorIds: ["admin_1"],
    clock: () => new Date(timestamp)
  });

  return {
    handler: createAdminDashboardHttpHandler({
      adminDashboardService,
      auditLogService
    })
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
