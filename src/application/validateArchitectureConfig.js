export async function validateArchitectureConfig({ configReader, configPath } = {}) {
  if (!configReader || typeof configReader.readConfig !== "function") {
    throw new TypeError("validateArchitectureConfig requires a configReader with readConfig().");
  }

  const config = await configReader.readConfig({ configPath });

  return {
    root: config.root ?? null,
    path: config.path ?? configPath ?? null,
    status: "pass",
    summary: {
      checks: config.checks.length
    }
  };
}
