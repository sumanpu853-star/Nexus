import assert from "node:assert/strict";
import test from "node:test";
import { parseArchitectureCheckConfig } from "../../src/domain/architectureCheckConfig.js";

const baseCheck = {
  id: "readme",
  title: "README exists",
  target: "README.md",
  kind: "fileExists",
  severity: "required",
  guidance: "Add README."
};

test("parseArchitectureCheckConfig returns immutable checks", () => {
  const checks = parseArchitectureCheckConfig({
    architecture: {
      checks: [baseCheck]
    }
  });

  assert.equal(checks.length, 1);
  assert.deepEqual(checks[0], baseCheck);
  assert.equal(Object.isFrozen(checks), true);
  assert.equal(Object.isFrozen(checks[0]), true);
});

test("parseArchitectureCheckConfig supports content includes expected text", () => {
  const checks = parseArchitectureCheckConfig({
    architecture: {
      checks: [
        {
          ...baseCheck,
          kind: "contentIncludes",
          expected: ["Nexus"]
        }
      ]
    }
  });

  assert.deepEqual(checks[0].expected, ["Nexus"]);
  assert.equal(Object.isFrozen(checks[0].expected), true);
});

test("parseArchitectureCheckConfig rejects missing checks", () => {
  assert.throws(
    () => parseArchitectureCheckConfig({ architecture: { checks: [] } }),
    /must define architecture\.checks/
  );
});

test("parseArchitectureCheckConfig rejects unsupported kinds and severities", () => {
  assert.throws(
    () =>
      parseArchitectureCheckConfig({
        architecture: {
          checks: [{ ...baseCheck, kind: "unknown" }]
        }
      }),
    /unsupported kind/
  );

  assert.throws(
    () =>
      parseArchitectureCheckConfig({
        architecture: {
          checks: [{ ...baseCheck, severity: "optional" }]
        }
      }),
    /unsupported severity/
  );
});

test("parseArchitectureCheckConfig requires expected text for content checks", () => {
  assert.throws(
    () =>
      parseArchitectureCheckConfig({
        architecture: {
          checks: [{ ...baseCheck, kind: "contentIncludes" }]
        }
      }),
    /must define expected text/
  );
});
