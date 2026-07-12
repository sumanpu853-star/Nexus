import assert from "node:assert/strict";
import test from "node:test";
import { HELP_TEXT, parseArgs } from "../../src/interfaces/cliArgs.js";

test("parseArgs uses text output and current root by default", () => {
  const options = parseArgs([], { root: "/repo" });

  assert.deepEqual(options, {
    root: "/repo",
    config: "nexus.config.json",
    format: "text",
    mode: "review",
    help: false
  });
});

test("parseArgs reads json format, root option, and config option", () => {
  const options = parseArgs(
    ["--json", "--root", "/workspace/nexus", "--config", "custom.config.json"],
    { root: "/repo" }
  );

  assert.deepEqual(options, {
    root: "/workspace/nexus",
    config: "custom.config.json",
    format: "json",
    mode: "review",
    help: false
  });
});

test("parseArgs reads command modes", () => {
  assert.equal(parseArgs(["--validate-config"]).mode, "validate-config");
  assert.equal(parseArgs(["--print-config-schema"]).mode, "print-config-schema");
});

test("parseArgs reads help flags", () => {
  assert.equal(parseArgs(["--help"]).help, true);
  assert.equal(parseArgs(["-h"]).help, true);
});

test("parseArgs rejects missing root values and unknown arguments", () => {
  assert.throws(() => parseArgs(["--root"]), /--root requires a path/);
  assert.throws(() => parseArgs(["--root", "--json"]), /--root requires a path/);
  assert.throws(() => parseArgs(["--config"]), /--config requires a path/);
  assert.throws(() => parseArgs(["--config", "--json"]), /--config requires a path/);
  assert.throws(
    () => parseArgs(["--validate-config", "--print-config-schema"]),
    /cannot be combined/
  );
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
});

test("help text documents the supported options", () => {
  assert.match(HELP_TEXT, /--root <path>/);
  assert.match(HELP_TEXT, /--config <path>/);
  assert.match(HELP_TEXT, /--validate-config/);
  assert.match(HELP_TEXT, /--print-config-schema/);
  assert.match(HELP_TEXT, /--json/);
});
