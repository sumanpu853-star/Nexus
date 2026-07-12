import { validateArchitectureConfig } from "../application/validateArchitectureConfig.js";
import { getArchitectureConfigSchema } from "../domain/architectureConfigSchema.js";
import { reviewWorkspace } from "../application/reviewWorkspace.js";
import { createFileSystemArchitectureConfigReader } from "../infrastructure/fileSystemArchitectureConfigReader.js";
import { createFileSystemWorkspaceReader } from "../infrastructure/fileSystemWorkspaceReader.js";
import { HELP_TEXT, parseArgs } from "./cliArgs.js";
import { renderConfigValidationReport } from "./configValidationRenderer.js";
import { renderReport } from "./reportRenderer.js";

export async function runArchitectureReviewCommand(
  argv = [],
  {
    createConfigReader = createFileSystemArchitectureConfigReader,
    createWorkspaceReader = createFileSystemWorkspaceReader,
    getConfigSchema = getArchitectureConfigSchema,
    review = reviewWorkspace,
    validateConfig = validateArchitectureConfig,
    stdout = console.log
  } = {}
) {
  const options = parseArgs(argv);

  if (options.help) {
    stdout(HELP_TEXT.trimEnd());
    return 0;
  }

  if (options.mode === "print-config-schema") {
    stdout(JSON.stringify(getConfigSchema(), null, 2));
    return 0;
  }

  const configReader = createConfigReader(options.root);

  if (options.mode === "validate-config") {
    const report = await validateConfig({
      configReader,
      configPath: options.config
    });

    stdout(renderConfigValidationReport(report, options.format));
    return 0;
  }

  const config = await configReader.readConfig({ configPath: options.config });
  const workspaceReader = createWorkspaceReader(options.root);
  const report = await review({ workspaceReader, checks: config.checks });

  stdout(renderReport(report, options.format));

  return report.status === "fail" ? 1 : 0;
}
