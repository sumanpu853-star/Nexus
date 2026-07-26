import assert from "node:assert/strict";
import test from "node:test";
import {
  getRedactedPlaceholder,
  redactCredentialSecret,
  redactSecrets
} from "../../src/domain/secretRedaction.js";

test("redactSecrets removes sensitive keys from nested snapshots", () => {
  const snapshot = {
    headers: {
      Authorization: "Bearer abc"
    },
    body: {
      nested: [
        {
          password: "super-secret",
          safe: "visible"
        }
      ]
    }
  };

  assert.deepEqual(redactSecrets(snapshot), {
    headers: {
      Authorization: getRedactedPlaceholder()
    },
    body: {
      nested: [
        {
          password: getRedactedPlaceholder(),
          safe: "visible"
        }
      ]
    }
  });
});

test("redactSecrets removes known secret values from strings", () => {
  const snapshot = {
    message: "Calling API with token abc123 and key abc",
    safe: "abc1234 should keep the non-secret suffix"
  };

  assert.deepEqual(
    redactSecrets(snapshot, {
      secretValues: ["abc123", "abc"]
    }),
    {
      message: "Calling API with token [REDACTED] and key [REDACTED]",
      safe: "[REDACTED]4 should keep the non-secret suffix"
    }
  );
});

test("redactCredentialSecret redacts all string values inside a credential secret", () => {
  assert.deepEqual(
    redactCredentialSecret({
      username: "nexus",
      password: "correct horse battery",
      nested: {
        token: "token-value"
      }
    }),
    {
      username: getRedactedPlaceholder(),
      password: getRedactedPlaceholder(),
      nested: {
        token: getRedactedPlaceholder()
      }
    }
  );
});
