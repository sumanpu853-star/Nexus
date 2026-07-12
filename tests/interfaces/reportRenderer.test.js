import assert from "node:assert/strict";
import test from "node:test";
import { renderJsonReport, renderReport, renderTextReport } from "../../src/interfaces/reportRenderer.js";

const passingReport = {
  root: "/repo",
  status: "pass",
  score: {
    passed: 1,
    total: 1,
    percent: 100
  },
  checks: [
    {
      status: "pass",
      title: "Architecture document exists",
      severity: "required",
      message: "docs/ARCHITECTURE.md exists as a file."
    }
  ]
};

test("renderTextReport renders the summary and check details", () => {
  const output = renderTextReport(passingReport);

  assert.match(output, /Nexus Architecture Review/);
  assert.match(output, /Status: pass/);
  assert.match(output, /Score: 100% \(1\/1 checks passed\)/);
  assert.match(output, /\[pass\] Architecture document exists/);
});

test("renderTextReport includes next actions for failed checks", () => {
  const output = renderTextReport({
    ...passingReport,
    status: "fail",
    checks: [
      {
        status: "fail",
        title: "Boundary rules exist",
        severity: "required",
        message: "docs/BOUNDARIES.md is missing or is not a file.",
        guidance: "Document boundary rules."
      }
    ]
  });

  assert.match(output, /Next: Document boundary rules/);
});

test("renderTextReport includes file-level failure details", () => {
  const output = renderTextReport({
    ...passingReport,
    status: "fail",
    checks: [
      {
        status: "fail",
        title: "Domain layer does not import outward layers",
        severity: "required",
        message: "src/domain imports forbidden dependencies in 2 place(s).",
        guidance: "Keep src/domain independent.",
        violations: [
          {
            file: "src/domain/order.js",
            import: "../infrastructure/orderStore.js",
            forbidden: "../infrastructure"
          },
          {
            file: "src/domain/loader.cjs",
            import: "../interfaces/api.js",
            forbidden: "../interfaces"
          }
        ]
      },
      {
        status: "fail",
        title: "Architecture doc states dependency direction",
        severity: "required",
        message: "docs/ARCHITECTURE.md is missing expected text.",
        guidance: "Document dependency direction.",
        missing: ["Dependencies should point inward"]
      }
    ]
  });

  assert.match(output, /Details:/);
  assert.match(
    output,
    /src\/domain\/order\.js imports "\.\.\/infrastructure\/orderStore\.js" \(forbidden by "\.\.\/infrastructure"\)/
  );
  assert.match(output, /Missing expected text: "Dependencies should point inward"/);
});

test("renderJsonReport renders pretty JSON", () => {
  assert.equal(renderJsonReport(passingReport), JSON.stringify(passingReport, null, 2));
});

test("renderReport dispatches supported formats", () => {
  assert.equal(renderReport(passingReport, "json"), renderJsonReport(passingReport));
  assert.equal(renderReport(passingReport, "text"), renderTextReport(passingReport));
});

test("renderReport rejects unsupported formats", () => {
  assert.throws(() => renderReport(passingReport, "xml"), /Unsupported report format/);
});
