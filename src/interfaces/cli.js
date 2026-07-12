#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { reviewWorkspace } from "../application/reviewWorkspace.js";
import { createFileSystemWorkspaceReader } from "../infrastructure/fileSystemWorkspaceReader.js";

export const HELP_TEXT = `Usage: nexus [options]

Review a workspace against the Nexus architecture baseline.

Options:
  --root <path>  Workspace root to review. Defaults to the current directory.
  --json         Print the report as JSON.
  -h, --help     Show this help text.
`;

export function parseArgs(args, defaults = {}) {
  const options = {
    root: defaults.root ?? process.cwd(),
    format: "text",
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.format = "json";
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--root") {
      const root = args[index + 1];

      if (!root || root.startsWith("--")) {
        throw new Error("--root requires a path.");
      }

      options.root = root;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function renderTextReport(report) {
  const lines = [
    "Nexus Architecture Review",
    `Root: ${report.root ?? "(unknown)"}`,
    `Status: ${report.status}`,
    `Score: ${report.score.percent}% (${report.score.passed}/${report.score.total} checks passed)`,
    "",
    "Checks:"
  ];

  for (const check of report.checks) {
    lines.push(`- [${check.status}] ${check.title} (${check.severity})`);
    lines.push(`  ${check.message}`);

    if (check.status === "fail") {
      lines.push(`  Guidance: ${check.guidance}`);
    }
  }

  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(HELP_TEXT.trimEnd());
    return 0;
  }

  const workspaceReader = createFileSystemWorkspaceReader(options.root);
  const report = await reviewWorkspace({ workspaceReader });

  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderTextReport(report));
  }

  return report.status === "fail" ? 1 : 0;
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
