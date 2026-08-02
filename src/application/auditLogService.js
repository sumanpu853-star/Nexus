import {
  AuthorizationError
} from "../domain/securityPolicy.js";
import {
  createAuditEventRecord,
  createAuditSummary,
  filterAuditEvents
} from "../domain/auditPolicy.js";

export function createAuditLogService({
  auditEventRepository,
  adminActorIds = [],
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(auditEventRepository, "auditEventRepository", [
    "findAll",
    "save"
  ]);
  const admins = new Set(normalizeStringArray(adminActorIds, "adminActorIds"));

  return Object.freeze({
    async recordAuditEvent({
      actor,
      action,
      status,
      project_id = null,
      workspace_id = null,
      resource_type,
      resource_id,
      metadata = {}
    } = {}) {
      const actorId = resolveActorId(actor);
      const event = createAuditEventRecord({
        id: nextId(idGenerator, "audit_event"),
        actor_id: actorId,
        action,
        status,
        project_id,
        workspace_id,
        resource_type,
        resource_id,
        metadata,
        occurred_at: nowIso(clock)
      });

      return auditEventRepository.save(event);
    },

    async listAuditEvents({
      actor,
      project_id = null,
      workspace_id = null,
      actor_id = null,
      action = null,
      status = null,
      limit = 50
    } = {}) {
      requireAdminPermission({ actor, admins });

      return filterAuditEvents({
        events: await auditEventRepository.findAll(),
        project_id,
        workspace_id,
        actor_id,
        action,
        status,
        limit
      });
    },

    async getAuditSummary({
      actor
    } = {}) {
      requireAdminPermission({ actor, admins });

      return createAuditSummary({
        events: await auditEventRepository.findAll()
      });
    }
  });
}

function requireAdminPermission({
  actor,
  admins
}) {
  const actorId = resolveActorId(actor);

  if (admins.size === 0) {
    throw new AuthorizationError(
      "Audit log operations require configured admin actors.",
      "audit_admin_required"
    );
  }

  if (!admins.has(actorId)) {
    throw new AuthorizationError(
      "User does not have audit log admin permission.",
      "audit_admin_forbidden"
    );
  }

  return actorId;
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Audit log operations require an authenticated actor.");
  }

  return actor.id.trim();
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createAuditLogService requires ${name}.${method}().`);
    }
  }
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

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createAuditLogService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
