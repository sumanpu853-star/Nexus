import assert from "node:assert/strict";
import test from "node:test";
import { HELP_TEXT, parseArgs } from "../../src/interfaces/cliArgs.js";

test("parseArgs uses text output and current root by default", () => {
  const options = parseArgs([], { root: "/repo" });

  assert.deepEqual(options, {
    root: "/repo",
    format: "text",
    help: false
  });
});

test("parseArgs reads json format and root option", () => {
  const options = parseArgs(["--json", "--root", "/workspace/nexus"], { root: "/repo" });

  assert.deepEqual(options, {
    root: "/workspace/nexus",
    format: "json",
    help: false
  });
});

test("parseArgs reads help flags", () => {
  assert.equal(parseArgs(["--help"]).help, true);
  assert.equal(parseArgs(["-h"]).help, true);
});

test("parseArgs rejects missing root values and unknown arguments", () => {
  assert.throws(() => parseArgs(["--root"]), /--root requires a path/);
  assert.throws(() => parseArgs(["--root", "--json"]), /--root requires a path/);
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
});

test("help text documents the supported options", () => {
  assert.match(HELP_TEXT, /--root <path>/);
  assert.match(HELP_TEXT, /--json/);
});
