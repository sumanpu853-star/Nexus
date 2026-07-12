import { reviewWorkspace } from "../application/reviewWorkspace.js";
import { createFileSystemArchitectureConfigReader } from "../infrastructure/fileSystemArchitectureConfigReader.js";
import { createFileSystemWorkspaceReader } from "../infrastructure/fileSystemWorkspaceReader.js";
import { HELP_TEXT, parseArgs } from "./cliArgs.js";
import { renderReport } from "./reportRenderer.js";

export async function runArchitectureReviewCommand(
  argv = [],
  {
    createConfigReader = createFileSystemArchitectureConfigReader,
    createWorkspaceReader = createFileSystemWorkspaceReader,
    review = reviewWorkspace,
    stdout = console.log
  } = {}
) {
  const options = parseArgs(argv);

  if (options.help) {
    stdout(HELP_TEXT.trimEnd());
    return 0;
  }

  const configReader = createConfigReader(options.root);
  const config = await configReader.readConfig({ configPath: options.config });
  const workspaceReader = createWorkspaceReader(options.root);
  const report = await review({ workspaceReader, checks: config.checks });

  stdout(renderReport(report, options.format));

  return report.status === "fail" ? 1 : 0;
}
