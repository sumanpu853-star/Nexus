import {
  assertCredentialBelongsToProject,
  assertCredentialManagementPermission,
  assertCredentialSecretAccess,
  createCredentialRecord,
  shareCredentialWithUser,
  toSafeCredential
} from "../domain/credentialPolicy.js";

export function createCredentialVaultService({
  projectRepository,
  membershipRepository,
  credentialRepository,
  secretCipher,
  idGenerator,
  clock = () => new Date()
} = {}) {
  assertRepository(projectRepository, "projectRepository", ["findById"]);
  assertRepository(membershipRepository, "membershipRepository", ["findByProjectId"]);
  assertRepository(credentialRepository, "credentialRepository", [
    "findById",
    "findByProjectId",
    "save"
  ]);
  assertSecretCipher(secretCipher);

  return Object.freeze({
    async createCredential({
      actor,
      project_id,
      name,
      type,
      secret,
      metadata = {},
      redaction_keys,
      external_ref = null
    } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertCredentialManagementPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships
      });

      const timestamp = nowIso(clock);
      const credential = createCredentialRecord({
        id: nextId(idGenerator, "credential"),
        name,
        type,
        owner_id: actorId,
        project_id: project.id,
        encrypted_secret: external_ref ? null : await encryptSecret(secretCipher, secret),
        metadata,
        redaction_keys,
        external_ref,
        created_at: timestamp,
        updated_at: timestamp
      });
      const saved = await credentialRepository.save(credential);

      return toSafeCredential(saved);
    },

    async listProjectCredentials({ actor, project_id } = {}) {
      const actorId = resolveActorId(actor);
      const project = await requireProject(projectRepository, project_id);
      const memberships = await membershipRepository.findByProjectId(project.id);

      assertCredentialManagementPermission({
        actor_id: actorId,
        project_id: project.id,
        memberships
      });

      return (await credentialRepository.findByProjectId(project.id)).map((credential) =>
        toSafeCredential(credential)
      );
    },

    async shareCredential({ actor, project_id, credential_id, user_id } = {}) {
      const actorId = resolveActorId(actor);
      const credential = await getProjectCredential({
        actor_id: actorId,
        project_id,
        credential_id,
        projectRepository,
        membershipRepository,
        credentialRepository,
        requireManagement: true
      });
      const updated = shareCredentialWithUser({
        credential,
        user_id,
        updated_at: nowIso(clock)
      });

      return toSafeCredential(await credentialRepository.save(updated));
    },

    async getCredentialSecret({ actor, project_id, credential_id } = {}) {
      const actorId = resolveActorId(actor);
      const { credential, memberships } = await getProjectCredentialContext({
        project_id,
        credential_id,
        projectRepository,
        membershipRepository,
        credentialRepository
      });

      assertCredentialSecretAccess({
        actor_id: actorId,
        credential,
        memberships
      });

      if (credential.external_ref) {
        return Object.freeze({
          credential: toSafeCredential(credential),
          external_ref: credential.external_ref,
          secret: null
        });
      }

      return Object.freeze({
        credential: toSafeCredential(credential),
        external_ref: null,
        secret: await secretCipher.decrypt(credential.encrypted_secret)
      });
    }
  });
}

async function getProjectCredential({
  actor_id,
  project_id,
  credential_id,
  projectRepository,
  membershipRepository,
  credentialRepository,
  requireManagement
}) {
  const { project, credential, memberships } = await getProjectCredentialContext({
    project_id,
    credential_id,
    projectRepository,
    membershipRepository,
    credentialRepository
  });

  if (requireManagement) {
    assertCredentialManagementPermission({
      actor_id,
      project_id: project.id,
      memberships
    });
  }

  return credential;
}

async function getProjectCredentialContext({
  project_id,
  credential_id,
  projectRepository,
  membershipRepository,
  credentialRepository
}) {
  const project = await requireProject(projectRepository, project_id);
  const [memberships, credential] = await Promise.all([
    membershipRepository.findByProjectId(project.id),
    credentialRepository.findById(credential_id)
  ]);

  return {
    project,
    memberships,
    credential: assertCredentialBelongsToProject({
      credential,
      project_id: project.id
    })
  };
}

async function encryptSecret(secretCipher, secret) {
  if (secret === undefined) {
    throw new TypeError("Credential secret is required unless external_ref is provided.");
  }

  return secretCipher.encrypt(secret);
}

function resolveActorId(actor) {
  if (!actor || typeof actor.id !== "string" || actor.id.trim() === "") {
    throw new TypeError("Credential vault operations require an authenticated actor.");
  }

  return actor.id.trim();
}

async function requireProject(projectRepository, projectId) {
  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new TypeError("Project id must be a non-empty string.");
  }

  const project = await projectRepository.findById(projectId.trim());

  if (!project) {
    throw new TypeError("Project was not found.");
  }

  return project;
}

function assertRepository(repository, name, methods) {
  for (const method of methods) {
    if (!repository || typeof repository[method] !== "function") {
      throw new TypeError(`createCredentialVaultService requires ${name}.${method}().`);
    }
  }
}

function assertSecretCipher(secretCipher) {
  if (
    !secretCipher ||
    typeof secretCipher.encrypt !== "function" ||
    typeof secretCipher.decrypt !== "function"
  ) {
    throw new TypeError("createCredentialVaultService requires a secretCipher.");
  }
}

function nextId(idGenerator, prefix) {
  if (typeof idGenerator === "function") {
    return idGenerator(prefix);
  }

  if (idGenerator && typeof idGenerator.nextId === "function") {
    return idGenerator.nextId(prefix);
  }

  throw new TypeError("createCredentialVaultService requires an idGenerator.");
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : clock.now();
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
}
