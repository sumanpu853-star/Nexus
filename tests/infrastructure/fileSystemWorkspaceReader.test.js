import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createFileSystemWorkspaceReader } from "../../src/infrastructure/fileSystemWorkspaceReader.js";

test("reads requested files and directories from disk", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexus-reader-"));

  try {
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "docs", "ARCHITECTURE.md"), "# Architecture", "utf8");

    const reader = createFileSystemWorkspaceReader(root);
    const snapshot = await reader.readSnapshot({
      targets: ["docs", "docs/ARCHITECTURE.md", "missing.md"]
    });

    assert.equal(snapshot.root, root);
    assert.equal(snapshot.entries.docs.type, "directory");
    assert.equal(snapshot.entries["docs/ARCHITECTURE.md"].type, "file");
    assert.equal(snapshot.entries["docs/ARCHITECTURE.md"].content, "# Architecture");
    assert.equal(snapshot.entries["missing.md"], undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects paths outside the workspace root", async () => {
  const reader = createFileSystemWorkspaceReader(tmpdir());

  await assert.rejects(
    () => reader.readSnapshot({ targets: ["../outside.md"] }),
    /outside workspace/
  );
});
