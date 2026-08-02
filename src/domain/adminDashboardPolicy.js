export const ADMIN_DASHBOARD_STATUSES = Object.freeze({
  READY: "ready",
  ACTION_REQUIRED: "action_required"
});

export function createAdminDashboardSnapshot({
  counts = {},
  queue_summary = null,
  production_readiness = null,
  audit_summary = null,
  generated_at
} = {}) {
  const normalizedCounts = normalizeCounts(counts);
  const readinessStatus = production_readiness?.status ?? "unknown";
  const queueBlocked = Number(queue_summary?.dead_lettered_jobs ?? 0) > 0;
  const status = queueBlocked || ["blocked", "degraded"].includes(readinessStatus)
    ? ADMIN_DASHBOARD_STATUSES.ACTION_REQUIRED
    : ADMIN_DASHBOARD_STATUSES.READY;

  return deepFreeze({
    status,
    counts: normalizedCounts,
    queue_summary: queue_summary ? normalizePlainObject(queue_summary, "Queue summary") : null,
    production_readiness: production_readiness
      ? normalizePlainObject(production_readiness, "Production readiness")
      : null,
    audit_summary: audit_summary
      ? normalizePlainObject(audit_summary, "Audit summary")
      : null,
    generated_at: normalizeTimestamp(generated_at, "Admin dashboard generated_at")
  });
}

function normalizeCounts(counts) {
  const normalized = normalizePlainObject(counts, "Admin dashboard counts");

  return Object.freeze(
    Object.fromEntries(
      Object.entries(normalized).map(([name, value]) => {
        if (!Number.isInteger(value) || value < 0) {
          throw new TypeError("Admin dashboard counts must be non-negative integers.");
        }

        return [name, value];
      })
    )
  );
}

function normalizeTimestamp(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  const normalized = value.trim();

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
