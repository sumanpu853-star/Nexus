import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createFileSystemArchitectureConfigReader,
  DEFAULT_ARCHITECTURE_CONFIG_PATH
} from "../../src/infrastructure/fileSystemArchitectureConfigReader.js";

const validConfig = {
  architecture: {
    checks: [
      {
        id: "readme",
        title: "README exists",
        target: "README.md",
        kind: "fileExists",
        severity: "required",
        guidance: "Add README."
      }
    ]
  }
};

test("reads architecture checks from the default config path", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexus-config-"));

  try {
    await writeFile(
      path.join(root, DEFAULT_ARCHITECTURE_CONFIG_PATH),
      JSON.stringify(validConfig),
      "utf8"
    );

    const reader = createFileSystemArchitectureConfigReader(root);
    const config = await reader.readConfig();

    assert.equal(config.root, root);
    assert.equal(config.path, DEFAULT_ARCHITECTURE_CONFIG_PATH);
    assert.equal(config.checks[0].id, "readme");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reads architecture checks from a custom config path", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexus-config-"));

  try {
    await writeFile(path.join(root, "custom.json"), JSON.stringify(validConfig), "utf8");

    const reader = createFileSystemArchitectureConfigReader(root);
    const config = await reader.readConfig({ configPath: "custom.json" });

    assert.equal(config.path, "custom.json");
    assert.equal(config.checks.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects invalid JSON and paths outside the workspace root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nexus-config-"));

  try {
    await writeFile(path.join(root, "invalid.json"), "{", "utf8");
    const reader = createFileSystemArchitectureConfigReader(root);

    await assert.rejects(
      () => reader.readConfig({ configPath: "invalid.json" }),
      /Unable to parse architecture config/
    );
    await assert.rejects(
      () => reader.readConfig({ configPath: "../outside.json" }),
      /outside workspace/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
