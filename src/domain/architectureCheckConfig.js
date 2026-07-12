const CHECK_KINDS = new Set([
  "fileExists",
  "directoryExists",
  "contentIncludes",
  "forbiddenImports"
]);
const CHECK_SEVERITIES = new Set(["required", "recommended"]);
const CHECK_FIELDS = new Set([
  "id",
  "title",
  "target",
  "kind",
  "severity",
  "expected",
  "forbidden",
  "guidance"
]);

export function parseArchitectureCheckConfig(config) {
  const checks = config?.architecture?.checks;

  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("Architecture config must define architecture.checks.");
  }

  return Object.freeze(checks.map((check, index) => normalizeCheck(check, index)));
}

function normalizeCheck(check, index) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new Error(`Architecture check at index ${index} must be an object.`);
  }

  rejectUnknownFields(check, index);

  const normalized = {
    id: requiredString(check.id, "id", index),
    title: requiredString(check.title, "title", index),
    target: requiredString(check.target, "target", index),
    kind: requiredString(check.kind, "kind", index),
    severity: requiredString(check.severity, "severity", index),
    guidance: requiredString(check.guidance, "guidance", index)
  };

  if (!CHECK_KINDS.has(normalized.kind)) {
    throw new Error(`Architecture check ${normalized.id} has unsupported kind: ${normalized.kind}.`);
  }

  if (!CHECK_SEVERITIES.has(normalized.severity)) {
    throw new Error(
      `Architecture check ${normalized.id} has unsupported severity: ${normalized.severity}.`
    );
  }

  if (normalized.kind === "contentIncludes") {
    normalized.expected = normalizeExpected(check.expected, normalized.id);
  }

  if (normalized.kind === "forbiddenImports") {
    normalized.forbidden = normalizeForbidden(check.forbidden, normalized.id);
  }

  return Object.freeze(normalized);
}

function rejectUnknownFields(check, index) {
  for (const field of Object.keys(check)) {
    if (!CHECK_FIELDS.has(field)) {
      throw new Error(`Architecture check at index ${index} has unsupported field: ${field}.`);
    }
  }
}

function requiredString(value, field, index) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Architecture check at index ${index} must define ${field}.`);
  }

  return value;
}

function normalizeExpected(expected, id) {
  if (!Array.isArray(expected) || expected.length === 0) {
    throw new Error(`Architecture check ${id} must define expected text.`);
  }

  for (const value of expected) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Architecture check ${id} has invalid expected text.`);
    }
  }

  return Object.freeze([...expected]);
}

function normalizeForbidden(forbidden, id) {
  if (!Array.isArray(forbidden) || forbidden.length === 0) {
    throw new Error(`Architecture check ${id} must define forbidden imports.`);
  }

  for (const value of forbidden) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Architecture check ${id} has invalid forbidden import.`);
    }
  }

  return Object.freeze([...forbidden]);
}
