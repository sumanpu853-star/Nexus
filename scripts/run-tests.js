import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const testRoot = path.resolve(process.cwd(), "tests");
const testFiles = await findTestFiles(testRoot);

if (testFiles.length === 0) {
  console.error("No test files found under tests/.");
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ["--test", ...testFiles], {
    stdio: "inherit",
    windowsHide: true
  });

  process.exitCode = await waitForExit(child);
}

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(toCliPath(path.relative(process.cwd(), absolutePath)));
    }
  }

  return files.sort();
}

function toCliPath(value) {
  return value.split(path.sep).join("/");
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
