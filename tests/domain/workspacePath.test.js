import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWorkspacePath } from "../../src/domain/workspacePath.js";

test("normalizes workspace paths to repository-relative forward slashes", () => {
  assert.equal(normalizeWorkspacePath(".\\docs\\ARCHITECTURE.md"), "docs/ARCHITECTURE.md");
  assert.equal(normalizeWorkspacePath("./src/domain/"), "src/domain");
});

test("rejects non-string workspace paths", () => {
  assert.throws(() => normalizeWorkspacePath(null), /Workspace paths must be strings/);
});
