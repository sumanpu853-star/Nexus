export const AUDIT_EVENT_STATUSES = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  BLOCKED: "blocked"
});

export function createAuditEventRecord({
  id,
  actor_id,
  action,
  status = AUDIT_EVENT_STATUSES.SUCCESS,
  project_id = null,
  workspace_id = null,
  resource_type,
  resource_id,
  metadata = {},
  occurred_at
} = {}) {
  return deepFreeze({
    id: normalizeRequiredString(id, "Audit event id"),
    actor_id: normalizeRequiredString(actor_id, "Audit event actor_id"),
    action: normalizeRequiredString(action, "Audit event action"),
    status: normalizeEnum(status, AUDIT_EVENT_STATUSES, "Audit event status"),
    project_id: normalizeNullableString(project_id, "Audit event project_id"),
    workspace_id: normalizeNullableString(workspace_id, "Audit event workspace_id"),
    resource_type: normalizeRequiredString(
      resource_type,
      "Audit event resource_type"
    ),
    resource_id: normalizeRequiredString(resource_id, "Audit event resource_id"),
    metadata: normalizePlainObject(metadata, "Audit event metadata"),
    occurred_at: normalizeTimestamp(occurred_at, "Audit event occurred_at")
  });
}

export function filterAuditEvents({
  events,
  project_id = null,
  workspace_id = null,
  actor_id = null,
  action = null,
  status = null,
  limit = 50
} = {}) {
  const normalizedLimit = normalizePositiveInteger(limit, "Audit event limit");
  const eventList = normalizeArray(events, "Audit events")
    .map((event) => createAuditEventRecord(event));

  return deepFreeze(
    eventList
      .filter((event) =>
        (project_id === null || event.project_id === project_id) &&
        (workspace_id === null || event.workspace_id === workspace_id) &&
        (actor_id === null || event.actor_id === actor_id) &&
        (action === null || event.action === action) &&
        (status === null || event.status === status)
      )
      .sort((left, right) =>
        Date.parse(right.occurred_at) - Date.parse(left.occurred_at) ||
        left.id.localeCompare(right.id)
      )
      .slice(0, normalizedLimit)
  );
}

export function createAuditSummary({
  events
} = {}) {
  const eventList = normalizeArray(events, "Audit events")
    .map((event) => createAuditEventRecord(event));

  return deepFreeze({
    event_count: eventList.length,
    status_counts: countBy(eventList, "status"),
    action_counts: countBy(eventList, "action"),
    actor_counts: countBy(eventList, "actor_id"),
    latest_event_at: eventList
      .map((event) => event.occurred_at)
      .sort()
      .at(-1) ?? null
  });
}

function countBy(records, field) {
  const counts = {};

  for (const record of records) {
    counts[record[field]] = (counts[record[field]] ?? 0) + 1;
  }

  return Object.freeze(counts);
}

function normalizeEnum(value, supported, field) {
  const values = Object.values(supported);

  if (!values.includes(value)) {
    throw new TypeError(`${field} is not supported.`);
  }

  return value;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableString(value, field) {
  if (value === null) {
    return null;
  }

  return normalizeRequiredString(value, field);
}

function normalizePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }

  return value;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO timestamp.`);
  }

  return normalized;
}

function normalizePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return deepClone(value);
}

function normalizeArray(value, field) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array.`);
  }

  return value.map((entry) => deepClone(entry));
}

function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
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
