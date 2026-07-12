import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArchitectureCheckConfig } from "../domain/architectureCheckConfig.js";
import { resolveInsideRoot } from "./resolveInsideRoot.js";

export const DEFAULT_ARCHITECTURE_CONFIG_PATH = "nexus.config.json";

export function createFileSystemArchitectureConfigReader(root) {
  const absoluteRoot = path.resolve(root ?? process.cwd());

  return {
    root: absoluteRoot,
    async readConfig({ configPath = DEFAULT_ARCHITECTURE_CONFIG_PATH } = {}) {
      const absoluteConfigPath = resolveInsideRoot(absoluteRoot, configPath);
      const content = await readFile(absoluteConfigPath, "utf8");
      const parsed = parseJson(content, configPath);

      return {
        root: absoluteRoot,
        path: configPath,
        checks: parseArchitectureCheckConfig(parsed)
      };
    }
  };
}

function parseJson(content, configPath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Unable to parse architecture config ${configPath}: ${error.message}`);
  }
}
