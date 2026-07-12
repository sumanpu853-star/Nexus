import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { normalizeWorkspacePath } from "../domain/workspacePath.js";
import { resolveInsideRoot } from "./resolveInsideRoot.js";

const SOURCE_FILE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);

export function createFileSystemWorkspaceReader(root) {
  const absoluteRoot = path.resolve(root ?? process.cwd());

  return {
    root: absoluteRoot,
    async readSnapshot({ targets = [] } = {}) {
      const entries = {};

      for (const target of [...new Set(targets)]) {
        const normalizedTarget = normalizeWorkspacePath(target);
        const absoluteTarget = resolveInsideRoot(absoluteRoot, normalizedTarget);
        const entry = await readEntry(absoluteTarget, absoluteRoot);

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

async function readEntry(absoluteTarget, root) {
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
    return {
      type: "directory",
      files: await readSourceFiles(absoluteTarget, root)
    };
  }

  if (!metadata.isFile()) {
    return null;
  }

  return {
    type: "file",
    content: await readFile(absoluteTarget, "utf8")
  };
}

async function readSourceFiles(directory, root) {
  const files = {};
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      Object.assign(files, await readSourceFiles(absolutePath, root));
      continue;
    }

    if (entry.isFile() && SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files[toWorkspacePath(path.relative(root, absolutePath))] = await readFile(absolutePath, "utf8");
    }
  }

  return files;
}

function toWorkspacePath(value) {
  return value.split(path.sep).join("/");
}
