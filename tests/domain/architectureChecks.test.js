import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArchitectureSnapshot } from "../../src/domain/architectureChecks.js";

test("passes checks when required entries exist", () => {
  const checks = [
    {
      id: "readme",
      title: "README exists",
      target: "README.md",
      kind: "fileExists",
      severity: "required",
      guidance: "Add a README."
    },
    {
      id: "src",
      title: "Source exists",
      target: "src",
      kind: "directoryExists",
      severity: "required",
      guidance: "Add src."
    }
  ];
  const report = evaluateArchitectureSnapshot({
    entries: {
      "README.md": { type: "file", content: "# Nexus" },
      src: { type: "directory" }
    }
  }, checks);

  assert.equal(report.status, "pass");
  assert.equal(report.score.percent, 100);
  assert.equal(report.summary.requiredFailures, 0);
});

test("fails when a required check is missing", () => {
  const checks = [
    {
      id: "architecture",
      title: "Architecture exists",
      target: "docs/ARCHITECTURE.md",
      kind: "fileExists",
      severity: "required",
      guidance: "Add architecture docs."
    }
  ];
  const report = evaluateArchitectureSnapshot({ entries: {} }, checks);

  assert.equal(report.status, "fail");
  assert.equal(report.summary.requiredFailures, 1);
  assert.match(report.checks[0].message, /missing/);
});

test("warns when only recommended checks fail", () => {
  const checks = [
    {
      id: "template",
      title: "ADR template exists",
      target: "docs/decisions/TEMPLATE.md",
      kind: "fileExists",
      severity: "recommended",
      guidance: "Add an ADR template."
    }
  ];
  const report = evaluateArchitectureSnapshot({ entries: {} }, checks);

  assert.equal(report.status, "warn");
  assert.equal(report.summary.recommendedFailures, 1);
});

test("reports missing expected architecture text", () => {
  const checks = [
    {
      id: "dependency-direction",
      title: "Dependency direction exists",
      target: "docs/ARCHITECTURE.md",
      kind: "contentIncludes",
      severity: "required",
      expected: ["Dependencies should point inward"],
      guidance: "Document dependency direction."
    }
  ];
  const report = evaluateArchitectureSnapshot({
    entries: {
      "docs/ARCHITECTURE.md": { type: "file", content: "# Architecture" }
    }
  }, checks);

  assert.equal(report.status, "fail");
  assert.deepEqual(report.checks[0].missing, ["Dependencies should point inward"]);
});
