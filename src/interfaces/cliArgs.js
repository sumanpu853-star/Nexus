export const HELP_TEXT = `Usage: nexus [options]

Review a workspace against the Nexus architecture baseline.

Options:
  --root <path>  Workspace root to review. Defaults to the current directory.
  --config <path>
                 Architecture config path. Defaults to nexus.config.json.
  --validate-config
                 Validate the config without running the workspace review.
  --print-config-schema
                 Print the Nexus config JSON Schema.
  --json         Print the report as JSON.
  -h, --help     Show this help text.
`;

export function parseArgs(args, defaults = {}) {
  const options = {
    root: defaults.root ?? process.cwd(),
    config: defaults.config ?? "nexus.config.json",
    format: "text",
    mode: "review",
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

    if (arg === "--validate-config") {
      setMode(options, "validate-config", arg);
      continue;
    }

    if (arg === "--print-config-schema") {
      setMode(options, "print-config-schema", arg);
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

    if (arg === "--config") {
      const config = args[index + 1];

      if (!config || config.startsWith("--")) {
        throw new Error("--config requires a path.");
      }

      options.config = config;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function setMode(options, mode, arg) {
  if (options.mode !== "review" && options.mode !== mode) {
    throw new Error(`${arg} cannot be combined with another command mode.`);
  }

  options.mode = mode;
}
