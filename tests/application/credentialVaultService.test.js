import assert from "node:assert/strict";
import test from "node:test";
import { createCredentialVaultService } from "../../src/application/credentialVaultService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { PROJECT_ROLES } from "../../src/domain/securityPolicy.js";
import { createInMemoryExternalSecretProvider } from "../../src/infrastructure/inMemoryExternalSecretProvider.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("createCredential encrypts secrets and returns safe metadata only", async () => {
  const { repositories, vault } = await setupVault();
  const credential = await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "GitHub Token",
    type: "github",
    secret: {
      token: "ghp_secret"
    },
    metadata: {
      scopes: ["repo"]
    }
  });
  const stored = await repositories.credentials.findById("credential_1");

  assert.equal(credential.encrypted_secret, undefined);
  assert.match(stored.encrypted_secret, /^encrypted:/);
  assert.equal(stored.encrypted_secret.includes("ghp_secret"), false);
});

test("createCredential blocks project viewers from managing credentials", async () => {
  const { vault, projectService } = await setupVault();
  await projectService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: "project_1",
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });

  await assert.rejects(
    () =>
      vault.createCredential({
        actor: { id: "viewer_1" },
        project_id: "project_1",
        name: "GitHub Token",
        type: "github",
        secret: { token: "ghp_secret" }
      }),
    /required project permission/
  );
});

test("listProjectCredentials returns project-scoped safe credential records", async () => {
  const { vault } = await setupVault();
  await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "GitHub Token",
    type: "github",
    secret: { token: "ghp_secret" }
  });

  const credentials = await vault.listProjectCredentials({
    actor: { id: "owner_1" },
    project_id: "project_1"
  });

  assert.equal(credentials.length, 1);
  assert.equal(credentials[0].name, "GitHub Token");
  assert.equal(credentials[0].encrypted_secret, undefined);
});

test("getCredentialSecret decrypts only for owners, managers, and shared users", async () => {
  const { vault, projectService } = await setupVault();
  await projectService.addProjectMember({
    actor: { id: "owner_1" },
    project_id: "project_1",
    user_id: "viewer_1",
    role: PROJECT_ROLES.VIEWER
  });
  await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "GitHub Token",
    type: "github",
    secret: { token: "ghp_secret" }
  });

  await assert.rejects(
    () =>
      vault.getCredentialSecret({
        actor: { id: "viewer_1" },
        project_id: "project_1",
        credential_id: "credential_1"
      }),
    /access to this credential secret/
  );

  await vault.shareCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    credential_id: "credential_1",
    user_id: "viewer_1"
  });
  const resolved = await vault.getCredentialSecret({
    actor: { id: "viewer_1" },
    project_id: "project_1",
    credential_id: "credential_1"
  });

  assert.deepEqual(resolved.secret, { token: "ghp_secret" });
});

test("getCredentialSecret blocks cross-project credential access", async () => {
  const { vault, projectService } = await setupVault();
  await projectService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "Second Project"
  });
  await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "GitHub Token",
    type: "github",
    secret: { token: "ghp_secret" }
  });

  await assert.rejects(
    () =>
      vault.getCredentialSecret({
        actor: { id: "owner_1" },
        project_id: "project_2",
        credential_id: "credential_1"
      }),
    /not available/
  );
});

test("createCredential can record external secret references without local ciphertext", async () => {
  const { vault, repositories } = await setupVault();
  const credential = await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "Production GitHub Token",
    type: "external",
    external_ref: {
      provider: "aws-secrets-manager",
      ref: "prod/nexus/github"
    }
  });
  const resolved = await vault.getCredentialSecret({
    actor: { id: "owner_1" },
    project_id: "project_1",
    credential_id: "credential_1"
  });

  assert.equal((await repositories.credentials.findById("credential_1")).encrypted_secret, null);
  assert.equal(credential.external_ref.provider, "aws-secrets-manager");
  assert.equal(resolved.secret, null);
  assert.deepEqual(resolved.external_ref, {
    provider: "aws-secrets-manager",
    ref: "prod/nexus/github"
  });
});

test("getCredentialSecret can resolve external secrets through a provider boundary", async () => {
  const { vault } = await setupVault({
    externalSecretProvider: createInMemoryExternalSecretProvider([
      {
        provider: "aws-secrets-manager",
        ref: "prod/nexus/github",
        secret: { token: "ghp_external_secret" }
      }
    ])
  });

  await vault.createCredential({
    actor: { id: "owner_1" },
    project_id: "project_1",
    name: "Production GitHub Token",
    type: "external",
    external_ref: {
      provider: "aws-secrets-manager",
      ref: "prod/nexus/github"
    }
  });
  const resolved = await vault.getCredentialSecret({
    actor: { id: "owner_1" },
    project_id: "project_1",
    credential_id: "credential_1"
  });

  assert.deepEqual(resolved.secret, { token: "ghp_external_secret" });
});

async function setupVault({
  externalSecretProvider = null
} = {}) {
  const repositories = createInMemorySecurityRepositories();
  const idGenerator = sequenceIds();
  const projectService = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const vault = createCredentialVaultService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    credentialRepository: repositories.credentials,
    secretCipher: fakeSecretCipher(),
    externalSecretProvider,
    idGenerator,
    clock: () => new Date(timestamp)
  });

  await projectService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });

  return { repositories, projectService, vault };
}

function fakeSecretCipher() {
  return {
    async encrypt(secret) {
      return `encrypted:${Buffer.from(JSON.stringify(secret), "utf8").toString("base64url")}`;
    },

    async decrypt(encryptedSecret) {
      return JSON.parse(
        Buffer.from(encryptedSecret.replace(/^encrypted:/, ""), "base64url").toString("utf8")
      );
    }
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
