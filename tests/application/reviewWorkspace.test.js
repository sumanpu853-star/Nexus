import assert from "node:assert/strict";
import test from "node:test";
import { reviewWorkspace } from "../../src/application/reviewWorkspace.js";

test("reviewWorkspace asks the reader for check targets and returns a report", async () => {
  const checks = [
    {
      id: "readme",
      title: "README exists",
      target: "README.md",
      kind: "fileExists",
      severity: "required",
      guidance: "Add a README."
    }
  ];
  let requestedTargets = [];
  const workspaceReader = {
    async readSnapshot({ targets }) {
      requestedTargets = targets;
      return {
        root: "/workspace/nexus",
        entries: {
          "README.md": { type: "file", content: "# Nexus" }
        }
      };
    }
  };

  const report = await reviewWorkspace({ workspaceReader, checks });

  assert.deepEqual(requestedTargets, ["README.md"]);
  assert.equal(report.root, "/workspace/nexus");
  assert.equal(report.status, "pass");
});

test("reviewWorkspace requires a workspace reader", async () => {
  await assert.rejects(
    () => reviewWorkspace(),
    /requires a workspaceReader/
  );
});
