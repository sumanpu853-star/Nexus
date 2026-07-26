import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCredentialBelongsToProject,
  assertCredentialSecretAccess,
  createCredentialRecord,
  getDefaultRedactionKeys,
  shareCredentialWithUser,
  toSafeCredential
} from "../../src/domain/credentialPolicy.js";
import {
  PROJECT_ROLES,
  createProjectMembership
} from "../../src/domain/securityPolicy.js";

const timestamp = "2026-07-26T00:00:00.000Z";

test("createCredentialRecord normalizes encrypted credential metadata", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    metadata: { scopes: ["repo"] },
    created_at: timestamp
  });

  assert.equal(credential.name, "GitHub Token");
  assert.equal(credential.shared_with_user_ids.length, 0);
  assert.equal(credential.external_ref, null);
  assert.equal(Object.isFrozen(credential.metadata.scopes), true);
});

test("createCredentialRecord supports external secret references", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "Vault Secret",
    type: "external",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: null,
    external_ref: {
      provider: " aws-secrets-manager ",
      ref: " prod/nexus/github "
    },
    created_at: timestamp
  });

  assert.deepEqual(credential.external_ref, {
    provider: "aws-secrets-manager",
    ref: "prod/nexus/github"
  });
});

test("createCredentialRecord requires local ciphertext or an external reference", () => {
  assert.throws(
    () =>
      createCredentialRecord({
        id: "credential_1",
        name: "Vault Secret",
        type: "external",
        owner_id: "owner_1",
        project_id: "project_1",
        created_at: timestamp
      }),
    /encrypted_secret or external_ref/
  );
});

test("toSafeCredential removes encrypted secret material", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    created_at: timestamp
  });

  assert.deepEqual(toSafeCredential(credential), {
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    metadata: {},
    redaction_keys: getDefaultRedactionKeys(),
    shared_with_user_ids: [],
    external_ref: null,
    created_at: timestamp,
    updated_at: timestamp
  });
});

test("assertCredentialBelongsToProject blocks cross-project credentials", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    created_at: timestamp
  });

  assert.equal(
    assertCredentialBelongsToProject({ credential, project_id: "project_1" }),
    credential
  );
  assert.throws(
    () => assertCredentialBelongsToProject({ credential, project_id: "project_2" }),
    /not available/
  );
});

test("assertCredentialSecretAccess allows owners, managers, and shared users", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    shared_with_user_ids: ["shared_1"],
    created_at: timestamp
  });
  const memberships = [
    createProjectMembership({
      project_id: "project_1",
      user_id: "admin_1",
      role: PROJECT_ROLES.ADMIN,
      created_at: timestamp
    }),
    createProjectMembership({
      project_id: "project_1",
      user_id: "viewer_1",
      role: PROJECT_ROLES.VIEWER,
      created_at: timestamp
    })
  ];

  assert.equal(
    assertCredentialSecretAccess({ actor_id: "owner_1", credential, memberships }),
    credential
  );
  assert.equal(
    assertCredentialSecretAccess({ actor_id: "admin_1", credential, memberships }),
    credential
  );
  assert.equal(
    assertCredentialSecretAccess({ actor_id: "shared_1", credential, memberships }),
    credential
  );
  assert.throws(
    () =>
      assertCredentialSecretAccess({
        actor_id: "viewer_1",
        credential,
        memberships
      }),
    /access to this credential secret/
  );
});

test("shareCredentialWithUser records explicit sorted sharing", () => {
  const credential = createCredentialRecord({
    id: "credential_1",
    name: "GitHub Token",
    type: "github",
    owner_id: "owner_1",
    project_id: "project_1",
    encrypted_secret: "v1.iv.tag.ciphertext",
    shared_with_user_ids: ["user_b"],
    created_at: timestamp
  });
  const shared = shareCredentialWithUser({
    credential,
    user_id: "user_a",
    updated_at: "2026-07-26T01:00:00.000Z"
  });

  assert.deepEqual(shared.shared_with_user_ids, ["user_a", "user_b"]);
  assert.equal(shared.updated_at, "2026-07-26T01:00:00.000Z");
});
