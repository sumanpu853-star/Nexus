import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_EVENT_STATUSES,
  createAuditEventRecord,
  createAuditSummary,
  filterAuditEvents
} from "../../src/domain/auditPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("audit policy records, filters, and summarizes audit events", () => {
  const events = [
    createAuditEventRecord({
      id: "audit_event_1",
      actor_id: "owner_1",
      action: "workflow.export",
      project_id: "project_1",
      resource_type: "workflow",
      resource_id: "workflow_1",
      occurred_at: timestamp
    }),
    createAuditEventRecord({
      id: "audit_event_2",
      actor_id: "viewer_1",
      action: "workspace.link_project",
      status: AUDIT_EVENT_STATUSES.BLOCKED,
      workspace_id: "workspace_1",
      resource_type: "project",
      resource_id: "project_1",
      occurred_at: "2026-07-26T00:01:00.000Z"
    })
  ];
  const filtered = filterAuditEvents({
    events,
    status: AUDIT_EVENT_STATUSES.BLOCKED
  });
  const summary = createAuditSummary({ events });

  assert.equal(filtered[0].id, "audit_event_2");
  assert.equal(summary.event_count, 2);
  assert.equal(summary.status_counts.success, 1);
  assert.equal(summary.status_counts.blocked, 1);
  assert.equal(summary.latest_event_at, "2026-07-26T00:01:00.000Z");
});
