export function renderConfigValidationReport(report, format = "text") {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format !== "text") {
    throw new Error(`Unsupported config validation format: ${format}`);
  }

  return [
    "Nexus Config Validation",
    `Root: ${report.root ?? "(unknown)"}`,
    `Path: ${report.path ?? "(unknown)"}`,
    `Status: ${report.status}`,
    `Checks: ${report.summary.checks}`
  ].join("\n");
}
