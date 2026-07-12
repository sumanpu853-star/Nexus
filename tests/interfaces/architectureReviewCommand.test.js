import assert from "node:assert/strict";
import test from "node:test";
import { runArchitectureReviewCommand } from "../../src/interfaces/architectureReviewCommand.js";

function createReport(status) {
  return {
    root: "/repo",
    status,
    score: {
      passed: status === "fail" ? 0 : 1,
      total: 1,
      percent: status === "fail" ? 0 : 100
    },
    summary: {
      passed: status === "fail" ? 0 : 1,
      failed: status === "fail" ? 1 : 0,
      requiredFailures: status === "fail" ? 1 : 0,
      recommendedFailures: 0
    },
    checks: []
  };
}

test("runArchitectureReviewCommand prints help without creating a reader", async () => {
  const output = [];
  let readerCreated = false;

  const exitCode = await runArchitectureReviewCommand(["--help"], {
    stdout: (value) => output.push(value),
    createWorkspaceReader() {
      readerCreated = true;
      return {};
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(readerCreated, false);
  assert.match(output[0], /Usage: nexus/);
});

test("runArchitectureReviewCommand reviews the requested root and prints text", async () => {
  const output = [];
  let requestedRoot;

  const exitCode = await runArchitectureReviewCommand(["--root", "/workspace"], {
    stdout: (value) => output.push(value),
    createWorkspaceReader(root) {
      requestedRoot = root;
      return { root };
    },
    async review({ workspaceReader }) {
      assert.deepEqual(workspaceReader, { root: "/workspace" });
      return createReport("pass");
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(requestedRoot, "/workspace");
  assert.match(output[0], /Status: pass/);
});

test("runArchitectureReviewCommand prints JSON and returns failure exit code", async () => {
  const output = [];

  const exitCode = await runArchitectureReviewCommand(["--json"], {
    stdout: (value) => output.push(value),
    createWorkspaceReader(root) {
      return { root };
    },
    async review() {
      return createReport("fail");
    }
  });

  assert.equal(exitCode, 1);
  assert.equal(JSON.parse(output[0]).status, "fail");
});
