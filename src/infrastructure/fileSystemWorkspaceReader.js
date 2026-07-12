import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { normalizeWorkspacePath } from "../domain/architectureChecks.js";

export function createFileSystemWorkspaceReader(root) {
  const absoluteRoot = path.resolve(root ?? process.cwd());

  return {
    root: absoluteRoot,
    async readSnapshot({ targets = [] } = {}) {
      const entries = {};

      for (const target of [...new Set(targets)]) {
        const normalizedTarget = normalizeWorkspacePath(target);
        const absoluteTarget = resolveInsideRoot(absoluteRoot, normalizedTarget);
        const entry = await readEntry(absoluteTarget);

        if (entry) {
          entries[normalizedTarget] = entry;
        }
      }

      return {
        root: absoluteRoot,
        entries
      };
    }
  };
}

async function readEntry(absoluteTarget) {
  let metadata;

  try {
    metadata = await stat(absoluteTarget);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  if (metadata.isDirectory()) {
    return { type: "directory" };
  }

  if (!metadata.isFile()) {
    return null;
  }

  return {
    type: "file",
    content: await readFile(absoluteTarget, "utf8")
  };
}

function resolveInsideRoot(root, workspacePath) {
  const absoluteTarget = path.resolve(root, ...workspacePath.split("/"));
  const relative = path.relative(root, absoluteTarget);
  const isInsideRoot = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isInsideRoot) {
    throw new Error(`Refusing to read outside workspace: ${workspacePath}`);
  }

  return absoluteTarget;
}
