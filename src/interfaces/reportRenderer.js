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
      lines.push(`  Guidance: ${check.guidance}`);
    }
  }

  return lines.join("\n");
}
