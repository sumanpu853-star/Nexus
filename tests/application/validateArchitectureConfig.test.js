import assert from "node:assert/strict";
import test from "node:test";
import { validateArchitectureConfig } from "../../src/application/validateArchitectureConfig.js";

test("validateArchitectureConfig returns a config-only validation report", async () => {
  const configReader = {
    async readConfig({ configPath }) {
      return {
        root: "/repo",
        path: configPath,
        checks: [{ id: "readme" }, { id: "ci" }]
      };
    }
  };

  const report = await validateArchitectureConfig({
    configReader,
    configPath: "custom.config.json"
  });

  assert.deepEqual(report, {
    root: "/repo",
    path: "custom.config.json",
    status: "pass",
    summary: {
      checks: 2
    }
  });
});

test("validateArchitectureConfig requires a config reader", async () => {
  await assert.rejects(
    () => validateArchitectureConfig(),
    /requires a configReader/
  );
});
