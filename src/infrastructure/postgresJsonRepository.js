const DEFAULT_TABLE_NAME = "nexus_records";

export function createPostgresJsonRepository({
  sqlClient,
  tableName = DEFAULT_TABLE_NAME,
  resource,
  idSelector = (record) => record.id
} = {}) {
  assertSqlClient(sqlClient);
  const table = normalizeSqlIdentifier(tableName, "Postgres tableName");
  const resourceName = normalizeRequiredString(resource, "Postgres repository resource");

  async function saveOne(record) {
    const normalized = clonePlainObject(record, "Postgres repository record");
    const id = normalizeRequiredString(
      idSelector(normalized),
      "Postgres repository record id"
    );

    await query(sqlClient, {
      text: [
        `insert into ${table} (resource, id, payload, created_at, updated_at)`,
        "values ($1, $2, $3::jsonb, now(), now())",
        "on conflict (resource, id)",
        "do update set payload = excluded.payload, updated_at = now()"
      ].join(" "),
      values: [resourceName, id, JSON.stringify(normalized)]
    });

    return clone(normalized);
  }

  return Object.freeze({
    async findById(id) {
      return findByPrimaryKey({
        sqlClient,
        table,
        resource: resourceName,
        id
      });
    },

    async findByProjectId(projectId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "project_id",
        value: projectId
      });
    },

    async findByWorkspaceId(workspaceId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "workspace_id",
        value: workspaceId
      });
    },

    async findByWorkflowId(workflowId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "workflow_id",
        value: workflowId
      });
    },

    async findByAgentId(agentId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "agent_id",
        value: agentId
      });
    },

    async findByKnowledgeBaseId(knowledgeBaseId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "knowledge_base_id",
        value: knowledgeBaseId
      });
    },

    async findByDocumentId(documentId) {
      return findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "document_id",
        value: documentId
      });
    },

    async findByEmail(email) {
      const results = await findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "email",
        value: email
      });

      return results[0] ?? null;
    },

    async findByVersion(version) {
      const results = await findByPayloadField({
        sqlClient,
        table,
        resource: resourceName,
        field: "version",
        value: version
      });

      return results[0] ?? null;
    },

    async findByIdentity(identity = {}) {
      const results = await findByPayloadFields({
        sqlClient,
        table,
        resource: resourceName,
        fields: identity
      });

      return results[0] ?? null;
    },

    async findAll() {
      const result = await query(sqlClient, {
        text: `select payload from ${table} where resource = $1 order by created_at asc`,
        values: [resourceName]
      });

      return result.rows.map((row) => normalizePayload(row.payload));
    },

    async save(record) {
      return saveOne(record);
    },

    async saveMany(records) {
      if (!Array.isArray(records)) {
        throw new TypeError("Postgres repository saveMany records must be an array.");
      }

      const saved = [];

      await transaction(sqlClient, async () => {
        for (const record of records) {
          saved.push(await saveOne(record));
        }
      });

      return Object.freeze(saved);
    }
  });
}

export function createPostgresRuntimeRepositories({
  sqlClient,
  tableName = DEFAULT_TABLE_NAME
} = {}) {
  const workspaceProjectLinksRepository = createPostgresJsonRepository({
    sqlClient,
    tableName,
    resource: "workspace_project_links",
    idSelector: (record) => `${record.workspace_id}:${record.project_id}`
  });

  return Object.freeze({
    users: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "users"
    }),
    projects: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "projects"
    }),
    memberships: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "memberships",
      idSelector: (record) => `${record.project_id}:${record.user_id}`
    }),
    workflows: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "workflows"
    }),
    executions: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "executions"
    }),
    credentials: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "credentials"
    }),
    workspaces: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "workspaces"
    }),
    workspaceMemberships: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "workspace_memberships",
      idSelector: (record) => `${record.workspace_id}:${record.user_id}`
    }),
    workspaceProjectLinks: Object.freeze({
      ...workspaceProjectLinksRepository,
      async findByProjectId(projectId) {
        const links = await workspaceProjectLinksRepository.findByProjectId(projectId);

        return links[0] ?? null;
      }
    }),
    workflowExports: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "workflow_exports"
    }),
    persistenceMigrations: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "persistence_migrations"
    }),
    auditEvents: createPostgresJsonRepository({
      sqlClient,
      tableName,
      resource: "audit_events"
    })
  });
}

async function findByPrimaryKey({
  sqlClient,
  table,
  resource,
  id
}) {
  const normalizedId = normalizeRequiredString(id, "Postgres repository id");
  const result = await query(sqlClient, {
    text: `select payload from ${table} where resource = $1 and id = $2 limit 1`,
    values: [resource, normalizedId]
  });

  return result.rows[0] ? normalizePayload(result.rows[0].payload) : null;
}

async function findByPayloadField({
  sqlClient,
  table,
  resource,
  field,
  value
}) {
  return findByPayloadFields({
    sqlClient,
    table,
    resource,
    fields: {
      [field]: value
    }
  });
}

async function findByPayloadFields({
  sqlClient,
  table,
  resource,
  fields
}) {
  const entries = Object.entries(clonePlainObject(fields, "Postgres repository fields"))
    .filter(([, value]) => value !== null && value !== undefined);
  const clauses = entries.map((_, index) =>
    `payload ->> $${(index * 2) + 2} = $${(index * 2) + 3}`
  );
  const values = entries.flatMap(([field, value]) => [
    normalizeRequiredString(field, "Postgres repository field"),
    String(value)
  ]);
  const result = await query(sqlClient, {
    text: [
      `select payload from ${table} where resource = $1`,
      clauses.length > 0 ? `and ${clauses.join(" and ")}` : "",
      "order by created_at asc"
    ].join(" ").trim(),
    values: [resource, ...values]
  });

  return result.rows.map((row) => normalizePayload(row.payload));
}

async function transaction(sqlClient, callback) {
  if (typeof sqlClient.transaction === "function") {
    return sqlClient.transaction(callback);
  }

  return callback();
}

async function query(sqlClient, statement) {
  const result = await sqlClient.query(statement);

  if (!result || !Array.isArray(result.rows)) {
    throw new TypeError("Postgres client query must return { rows }.");
  }

  return result;
}

function normalizePayload(payload) {
  if (typeof payload === "string") {
    return clonePlainObject(JSON.parse(payload), "Postgres repository payload");
  }

  return clonePlainObject(payload, "Postgres repository payload");
}

function normalizeSqlIdentifier(value, field) {
  const normalized = normalizeRequiredString(value, field);

  if (!/^[a-z_][a-z0-9_]*$/i.test(normalized)) {
    throw new TypeError(`${field} must be a safe SQL identifier.`);
  }

  return normalized;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function clonePlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object.`);
  }

  return clone(value);
}

function assertSqlClient(sqlClient) {
  if (!sqlClient || typeof sqlClient.query !== "function") {
    throw new TypeError("createPostgresJsonRepository requires sqlClient.query().");
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
