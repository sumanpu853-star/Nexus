import { getDefaultRedactionKeys } from "./credentialPolicy.js";

const REDACTED = "[REDACTED]";

export function redactSecrets(value, {
  secretValues = [],
  sensitiveKeys = getDefaultRedactionKeys()
} = {}) {
  const normalizedSecrets = normalizeSecretValues(secretValues);
  const normalizedKeys = new Set(sensitiveKeys.map((key) => normalizeKey(key)));

  return redactValue(value, {
    secretValues: normalizedSecrets,
    sensitiveKeys: normalizedKeys
  });
}

export function redactCredentialSecret(secret, {
  sensitiveKeys = getDefaultRedactionKeys()
} = {}) {
  return redactSecrets(secret, {
    secretValues: collectStringValues(secret),
    sensitiveKeys
  });
}

export function getRedactedPlaceholder() {
  return REDACTED;
}

function redactValue(value, context) {
  if (typeof value === "string") {
    return redactString(value, context.secretValues);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, context));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      context.sensitiveKeys.has(normalizeKey(key))
        ? REDACTED
        : redactValue(child, context)
    ])
  );
}

function redactString(value, secretValues) {
  let redacted = value;

  for (const secret of secretValues) {
    redacted = redacted.split(secret).join(REDACTED);
  }

  return redacted;
}

function normalizeSecretValues(values) {
  if (!Array.isArray(values)) {
    throw new TypeError("secretValues must be an array.");
  }

  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string" && value.length > 0)
        .sort((left, right) => right.length - left.length)
    )
  ];
}

function collectStringValues(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringValues(entry));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectStringValues(entry));
}

function normalizeKey(key) {
  if (typeof key !== "string") {
    throw new TypeError("Sensitive keys must be strings.");
  }

  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
