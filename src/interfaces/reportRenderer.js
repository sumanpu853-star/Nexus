export function renderReport(report, format = "text") {
  if (format === "json") {
    return renderJsonReport(report);
  }

  if (format === "text") {
    return renderTextReport(report);
  }

  throw new Error(`Unsupported report format: ${format}`);
}

export function renderJsonReport(report) {
  return JSON.stringify(report, null, 2);
}

export function renderTextReport(report) {
  const lines = [
    "Nexus Architecture Review",
    `Root: ${report.root ?? "(unknown)"}`,
    `Status: ${report.status}`,
    `Score: ${report.score.percent}% (${report.score.passed}/${report.score.total} checks passed)`,
    "",
    "Checks:"
  ];

  for (const check of report.checks) {
    lines.push(`- [${check.status}] ${check.title} (${check.severity})`);
    lines.push(`  ${check.message}`);

    if (check.status === "fail") {
      lines.push(...renderFailureDetails(check));
      lines.push(`  Next: ${check.guidance}`);
    }
  }

  return lines.join("\n");
}

function renderFailureDetails(check) {
  const details = [
    ...renderMissingTextDetails(check.missing),
    ...renderForbiddenImportDetails(check.violations)
  ];

  if (details.length === 0) {
    return [];
  }

  return ["  Details:", ...details.map((detail) => `  - ${detail}`)];
}

function renderMissingTextDetails(missing) {
  if (!Array.isArray(missing) || missing.length === 0) {
    return [];
  }

  return missing.map((text) => `Missing expected text: "${text}"`);
}

function renderForbiddenImportDetails(violations) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return [];
  }

  return violations.map(
    (violation) =>
      `${violation.file} imports "${violation.import}" (forbidden by "${violation.forbidden}")`
  );
}
