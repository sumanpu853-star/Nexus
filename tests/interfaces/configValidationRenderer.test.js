import assert from "node:assert/strict";
import test from "node:test";
import { renderConfigValidationReport } from "../../src/interfaces/configValidationRenderer.js";

const report = {
  root: "/repo",
  path: "nexus.config.json",
  status: "pass",
  summary: {
    checks: 18
  }
};

test("renderConfigValidationReport renders text", () => {
  const output = renderConfigValidationReport(report);

  assert.match(output, /Nexus Config Validation/);
  assert.match(output, /Path: nexus\.config\.json/);
  assert.match(output, /Checks: 18/);
});

test("renderConfigValidationReport renders JSON", () => {
  assert.equal(renderConfigValidationReport(report, "json"), JSON.stringify(report, null, 2));
});

test("renderConfigValidationReport rejects unsupported formats", () => {
  assert.throws(
    () => renderConfigValidationReport(report, "xml"),
    /Unsupported config validation format/
  );
});
