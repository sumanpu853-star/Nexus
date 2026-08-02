export function createEnvironmentExternalSecretProvider({
  env = process.env,
  provider = "env",
  prefix = "NEXUS_SECRET_"
} = {}) {
  const normalizedProvider = normalizeRequiredString(provider, "Environment secret provider");
  const normalizedPrefix = normalizeOptionalString(prefix, "Environment secret prefix");

  return Object.freeze({
    async getSecret(externalRef) {
      const normalizedRef = normalizeExternalRef(externalRef);

      if (normalizedRef.provider !== normalizedProvider) {
        return null;
      }

      const key = `${normalizedPrefix}${toEnvKey(normalizedRef.ref)}`;

      if (!Object.hasOwn(env, key)) {
        return null;
      }

      return parseSecretValue(env[key]);
    }
  });
}

export function createChainedExternalSecretProvider(providers = []) {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new TypeError("External secret provider chain must be a non-empty array.");
  }

  for (const provider of providers) {
    if (!provider || typeof provider.getSecret !== "function") {
      throw new TypeError("External secret providers require getSecret().");
    }
  }

  return Object.freeze({
    async getSecret(externalRef) {
      for (const provider of providers) {
        const secret = await provider.getSecret(externalRef);

        if (secret !== null && secret !== undefined) {
          return clone(secret);
        }
      }

      return null;
    }
  });
}

function parseSecretValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toEnvKey(ref) {
  return normalizeRequiredString(ref, "Environment secret ref")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeExternalRef(externalRef) {
  if (!externalRef || typeof externalRef !== "object" || Array.isArray(externalRef)) {
    throw new TypeError("External secret reference must be an object.");
  }

  return Object.freeze({
    provider: normalizeRequiredString(externalRef.provider, "External secret provider"),
    ref: normalizeRequiredString(externalRef.ref, "External secret ref")
  });
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value, field) {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string.`);
  }

  return value;
}

function clone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}
