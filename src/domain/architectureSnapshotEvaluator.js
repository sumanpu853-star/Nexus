import { DEFAULT_ARCHITECTURE_CHECKS } from "./architectureCheckDefinitions.js";
import { normalizeWorkspacePath } from "./workspacePath.js";

const CHECK_EVALUATORS = new Map([
  ["fileExists", evaluateFileExists],
  ["directoryExists", evaluateDirectoryExists],
  ["contentIncludes", evaluateContentIncludes]
]);

export function evaluateArchitectureSnapshot(snapshot, checks = DEFAULT_ARCHITECTURE_CHECKS) {
  const entries = normalizeEntries(snapshot?.entries ?? {});
  const results = checks.map((check) => evaluateCheck(check, entries));
  const summary = summarizeResults(results);

  return {
    status: resolveReportStatus(summary),
    score: {
      passed: summary.passed,
      total: results.length,
      percent: results.length === 0 ? 100 : Math.round((summary.passed / results.length) * 100)
    },
    summary,
    checks: results
  };
}

function normalizeEntries(entries) {
  const normalized = new Map();
  const pairs = entries instanceof Map ? entries.entries() : Object.entries(entries);

  for (const [target, entry] of pairs) {
    normalized.set(normalizeWorkspacePath(target), {
      type: entry.type,
      content: entry.content ?? ""
    });
  }

  return normalized;
}

function evaluateCheck(check, entries) {
  const target = normalizeWorkspacePath(check.target);
  const entry = entries.get(target);
  const evaluator = CHECK_EVALUATORS.get(check.kind);

  if (!evaluator) {
    throw new Error(`Unsupported architecture check kind: ${check.kind}`);
  }

  return evaluator(createResultBase(check, target), entry, check);
}

function createResultBase(check, target) {
  return {
    id: check.id,
    title: check.title,
    target,
    kind: check.kind,
    severity: check.severity,
    guidance: check.guidance
  };
}

function evaluateFileExists(base, entry) {
  const passed = entry?.type === "file";

  return {
    ...base,
    status: passed ? "pass" : "fail",
    message: passed
      ? `${base.target} exists as a file.`
      : `${base.target} is missing or is not a file.`
  };
}

function evaluateDirectoryExists(base, entry) {
  const passed = entry?.type === "directory";

  return {
    ...base,
    status: passed ? "pass" : "fail",
    message: passed
      ? `${base.target} exists as a directory.`
      : `${base.target} is missing or is not a directory.`
  };
}

function evaluateContentIncludes(base, entry, check) {
  if (entry?.type !== "file") {
    return {
      ...base,
      status: "fail",
      message: `Cannot inspect ${base.target} because it is missing or is not a file.`,
      missing: check.expected ?? []
    };
  }

  const content = entry.content.toLowerCase();
  const missing = (check.expected ?? []).filter(
    (expected) => !content.includes(expected.toLowerCase())
  );

  return {
    ...base,
    status: missing.length === 0 ? "pass" : "fail",
    message:
      missing.length === 0
        ? `${base.target} contains the expected architecture language.`
        : `${base.target} is missing expected text: ${missing.join(", ")}.`,
    missing
  };
}

function summarizeResults(results) {
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.length - passed;
  const requiredFailures = results.filter(
    (result) => result.status === "fail" && result.severity === "required"
  ).length;
  const recommendedFailures = results.filter(
    (result) => result.status === "fail" && result.severity === "recommended"
  ).length;

  return {
    passed,
    failed,
    requiredFailures,
    recommendedFailures
  };
}

function resolveReportStatus(summary) {
  if (summary.requiredFailures > 0) {
    return "fail";
  }

  return summary.recommendedFailures > 0 ? "warn" : "pass";
}
