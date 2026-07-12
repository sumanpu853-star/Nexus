#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { runArchitectureReviewCommand } from "./architectureReviewCommand.js";

export { runArchitectureReviewCommand } from "./architectureReviewCommand.js";
export { HELP_TEXT, parseArgs } from "./cliArgs.js";
export { renderConfigValidationReport } from "./configValidationRenderer.js";
export { renderJsonReport, renderReport, renderTextReport } from "./reportRenderer.js";

export async function main(argv = process.argv.slice(2)) {
  return runArchitectureReviewCommand(argv);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    }
  );
}
