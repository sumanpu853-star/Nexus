export function createInMemoryExternalSecretProvider(initialSecrets = []) {
  const secretsByKey = new Map();

  for (const entry of initialSecrets) {
    saveSecret(entry);
  }

  return Object.freeze({
    async getSecret(externalRef) {
      return cloneOrNull(secretsByKey.get(resolveKey(externalRef)));
    },

    async saveSecret(entry) {
      saveSecret(entry);

      return cloneOrNull(entry.secret);
    }
  });

  function saveSecret({
    provider,
    ref,
    secret
  } = {}) {
    if (secret === undefined) {
      throw new TypeError("External secret value is required.");
    }

    secretsByKey.set(
      resolveKey({
        provider,
        ref
      }),
      clone(secret)
    );
  }
}

function resolveKey(externalRef) {
  if (!externalRef || typeof externalRef !== "object" || Array.isArray(externalRef)) {
    throw new TypeError("External secret reference must be an object.");
  }

  return `${normalizeRequiredString(externalRef.provider, "External secret provider")}:${normalizeRequiredString(externalRef.ref, "External secret ref")}`;
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function cloneOrNull(value) {
  return value === undefined ? null : clone(value);
}

function clone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}
