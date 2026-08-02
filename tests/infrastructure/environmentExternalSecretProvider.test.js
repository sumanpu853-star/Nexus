import assert from "node:assert/strict";
import test from "node:test";
import { createCredentialVaultService } from "../../src/application/credentialVaultService.js";
import { createProjectWorkflowSecurityService } from "../../src/application/projectWorkflowSecurityService.js";
import { createAesGcmSecretCipher } from "../../src/infrastructure/aesGcmSecretCipher.js";
import {
  createChainedExternalSecretProvider,
  createEnvironmentExternalSecretProvider
} from "../../src/infrastructure/environmentExternalSecretProvider.js";
import { createInMemoryExternalSecretProvider } from "../../src/infrastructure/inMemoryExternalSecretProvider.js";
import { createInMemorySecurityRepositories } from "../../src/infrastructure/inMemorySecurityRepositories.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("environment external secret provider resolves JSON and string secrets", async () => {
  const provider = createEnvironmentExternalSecretProvider({
    env: {
      NEXUS_SECRET_SLACK_BOT: JSON.stringify({ token: "xoxb-secret" }),
      NEXUS_SECRET_GITHUB_TOKEN: "ghp_secret"
    }
  });

  assert.deepEqual(
    await provider.getSecret({ provider: "env", ref: "slack/bot" }),
    { token: "xoxb-secret" }
  );
  assert.equal(
    await provider.getSecret({ provider: "env", ref: "github-token" }),
    "ghp_secret"
  );
  assert.equal(await provider.getSecret({ provider: "vault", ref: "missing" }), null);
});

test("chained external secret provider works with credential vault external refs", async () => {
  const repositories = createInMemorySecurityRepositories();
  const idGenerator = sequenceIds();
  const workflowService = createProjectWorkflowSecurityService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    workflowRepository: repositories.workflows,
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const { project } = await workflowService.createProjectForUser({
    actor: { id: "owner_1" },
    name: "AI Workflows"
  });
  const credentialService = createCredentialVaultService({
    projectRepository: repositories.projects,
    membershipRepository: repositories.memberships,
    credentialRepository: repositories.credentials,
    secretCipher: createAesGcmSecretCipher({
      secretKey: "0123456789abcdef0123456789abcdef",
      randomBytesProvider: () => Buffer.alloc(12, 1)
    }),
    externalSecretProvider: createChainedExternalSecretProvider([
      createEnvironmentExternalSecretProvider({
        env: {
          NEXUS_SECRET_DATABASE_PRIMARY: JSON.stringify({ password: "db-secret" })
        }
      }),
      createInMemoryExternalSecretProvider()
    ]),
    idGenerator,
    clock: () => new Date(timestamp)
  });
  const credential = await credentialService.createCredential({
    actor: { id: "owner_1" },
    project_id: project.id,
    name: "Primary DB",
    type: "database_connection",
    external_ref: {
      provider: "env",
      ref: "database-primary"
    }
  });
  const resolved = await credentialService.getCredentialSecret({
    actor: { id: "owner_1" },
    project_id: project.id,
    credential_id: credential.id
  });

  assert.equal(credential.encrypted_secret, undefined);
  assert.deepEqual(resolved.secret, { password: "db-secret" });
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
