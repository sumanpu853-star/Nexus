export const DEFAULT_ARCHITECTURE_CHECKS = Object.freeze([
  {
    id: "architecture-doc",
    title: "Architecture document exists",
    target: "docs/ARCHITECTURE.md",
    kind: "fileExists",
    severity: "required",
    guidance: "Keep the current architecture overview in docs/ARCHITECTURE.md."
  },
  {
    id: "boundary-doc",
    title: "Boundary rules exist",
    target: "docs/BOUNDARIES.md",
    kind: "fileExists",
    severity: "required",
    guidance: "Document dependency direction and layer ownership before adding more code."
  },
  {
    id: "refactoring-plan",
    title: "Refactoring plan exists",
    target: "docs/REFACTORING_PLAN.md",
    kind: "fileExists",
    severity: "required",
    guidance: "Keep step-by-step refactoring guidance visible in docs/REFACTORING_PLAN.md."
  },
  {
    id: "decisions-directory",
    title: "Decision records directory exists",
    target: "docs/decisions",
    kind: "directoryExists",
    severity: "required",
    guidance: "Use docs/decisions for architecture decision records."
  },
  {
    id: "architecture-baseline-adr",
    title: "Architecture baseline ADR exists",
    target: "docs/decisions/0001-architecture-baseline.md",
    kind: "fileExists",
    severity: "required",
    guidance: "Keep the initial architecture decision record."
  },
  {
    id: "adr-template",
    title: "ADR template exists",
    target: "docs/decisions/TEMPLATE.md",
    kind: "fileExists",
    severity: "recommended",
    guidance: "Provide a template so future decisions stay consistent."
  },
  {
    id: "domain-layer",
    title: "Domain layer directory exists",
    target: "src/domain",
    kind: "directoryExists",
    severity: "required",
    guidance: "Keep domain rules independent from frameworks and infrastructure."
  },
  {
    id: "application-layer",
    title: "Application layer directory exists",
    target: "src/application",
    kind: "directoryExists",
    severity: "required",
    guidance: "Use the application layer for use cases and workflow orchestration."
  },
  {
    id: "interfaces-layer",
    title: "Interfaces layer directory exists",
    target: "src/interfaces",
    kind: "directoryExists",
    severity: "required",
    guidance: "Keep delivery mechanisms at the edge of the system."
  },
  {
    id: "infrastructure-layer",
    title: "Infrastructure layer directory exists",
    target: "src/infrastructure",
    kind: "directoryExists",
    severity: "required",
    guidance: "Keep concrete integrations behind adapters."
  },
  {
    id: "tests-directory",
    title: "Tests directory exists",
    target: "tests",
    kind: "directoryExists",
    severity: "required",
    guidance: "Add behavior-focused tests as implementation grows."
  },
  {
    id: "pr-template",
    title: "Pull request template exists",
    target: ".github/pull_request_template.md",
    kind: "fileExists",
    severity: "recommended",
    guidance: "Use a PR template to make architecture checks part of code review."
  },
  {
    id: "architecture-dependency-direction",
    title: "Architecture doc states dependency direction",
    target: "docs/ARCHITECTURE.md",
    kind: "contentIncludes",
    severity: "required",
    expected: ["Dependencies should point inward", "src/domain"],
    guidance: "The architecture doc should describe dependency direction and the domain boundary."
  },
  {
    id: "boundaries-layer-ownership",
    title: "Boundary doc states layer ownership",
    target: "docs/BOUNDARIES.md",
    kind: "contentIncludes",
    severity: "required",
    expected: ["src/domain", "src/application", "src/infrastructure"],
    guidance: "The boundary doc should identify ownership for the core layers."
  },
  {
    id: "pr-template-architecture-check",
    title: "PR template includes architecture check",
    target: ".github/pull_request_template.md",
    kind: "contentIncludes",
    severity: "recommended",
    expected: ["Architecture Check"],
    guidance: "The PR template should remind reviewers to check architecture boundaries."
  }
].map(Object.freeze));

export function normalizeWorkspacePath(value) {
  if (typeof value !== "string") {
    throw new TypeError("Workspace paths must be strings.");
  }

  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/g, "");
}

export function evaluateArchitectureSnapshot(snapshot, checks = DEFAULT_ARCHITECTURE_CHECKS) {
  const entries = normalizeEntries(snapshot?.entries ?? {});
  const results = checks.map((check) => evaluateCheck(check, entries));
  const passed = results.filter((result) => result.status === "pass").length;
  const total = results.length;
  const requiredFailures = results.filter(
    (result) => result.status === "fail" && result.severity === "required"
  ).length;
  const recommendedFailures = results.filter(
    (result) => result.status === "fail" && result.severity === "recommended"
  ).length;

  return {
    status: requiredFailures > 0 ? "fail" : recommendedFailures > 0 ? "warn" : "pass",
    score: {
      passed,
      total,
      percent: total === 0 ? 100 : Math.round((passed / total) * 100)
    },
    summary: {
      passed,
      failed: total - passed,
      requiredFailures,
      recommendedFailures
    },
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
  const base = {
    id: check.id,
    title: check.title,
    target,
    kind: check.kind,
    severity: check.severity,
    guidance: check.guidance
  };

  if (check.kind === "fileExists") {
    const passed = entry?.type === "file";
    return {
      ...base,
      status: passed ? "pass" : "fail",
      message: passed ? `${target} exists as a file.` : `${target} is missing or is not a file.`
    };
  }

  if (check.kind === "directoryExists") {
    const passed = entry?.type === "directory";
    return {
      ...base,
      status: passed ? "pass" : "fail",
      message: passed
        ? `${target} exists as a directory.`
        : `${target} is missing or is not a directory.`
    };
  }

  if (check.kind === "contentIncludes") {
    if (entry?.type !== "file") {
      return {
        ...base,
        status: "fail",
        message: `Cannot inspect ${target} because it is missing or is not a file.`,
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
          ? `${target} contains the expected architecture language.`
          : `${target} is missing expected text: ${missing.join(", ")}.`,
      missing
    };
  }

  throw new Error(`Unsupported architecture check kind: ${check.kind}`);
}
