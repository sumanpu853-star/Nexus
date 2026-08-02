import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  createAdminDashboardSnapshot
} from "../domain/adminDashboardPolicy.js";

export function createAdminDashboardService({
  countRepositories = {},
  workflowQueueService = null,
  productionAdapterService = null,
  auditLogService = null,
  adminActorIds = [],
  clock = () => new Date()
} = {}) {
  const admins = new Set(normalizeStringArray(adminActorIds, "adminActorIds"));

  return Object.freeze({
    async getAdminDashboard({
      actor
    } = {}) {
      requireAdminPermission({ actor, admins });

      return createAdminDashboardSnapshot({
        counts: await collectCounts(countRepositories),
        queue_summary: workflowQueueService
          ? await workflowQueueService.getQueueSummary({ actor })
          : null,
        production_readiness: productionAdapterService
          ? await productionAdapterService.getProductionReadiness({ actor })
          : null,
        audit_summary: auditLogService
          ? await auditLogService.getAuditSummary({ actor })
          : null,
        generated_at: nowIso(clock)
      });
    }
  });
}

async function collectCounts(countRepositories) {
  const counts = {};

  for (const [name, repository] of Object.entries(countRepositories)) {
    if (typeof repository === "function") {
      counts[name] = normalizeCount(await repository(), name);
      continue;
    }

    if (!repository || typeof repository.findAll !== "function") {
      throw new TypeError(
        `Admin dashboard count source "${name}" requires findAll().`
      );
    }

    counts[name] = normalizeCount((await repository.findAll()).length, name);
  }

  return counts;
}

function normalizeCount(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`Admin dashboard count "${name}" must be a non-negative integer.`);
  }

  return value;
}

function requireAdminPermission({
  actor,
  admins
}) {
  const actorId = resolveActorId(actor);

  if (admins.size === 0) {
    throw new AuthorizationError(
      "Admin dashboard operations require configured admin actors.",
      "admin_dashboard_admin_required"
    );
  }

  if (!admins.has(actorId)) {
    throw new AuthorizationError(
      "User does not have admin dashboard permission.",
      "admin_dashboard_admin_forbidden"
    );
  }

  return actorId;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Admin dashboard operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new TypeError(`${field} entries must be non-empty strings.`);
    }

    return entry.trim();
  });
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
