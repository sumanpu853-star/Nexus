import path from "node:path";
import { normalizeWorkspacePath } from "../domain/workspacePath.js";

export function resolveInsideRoot(root, workspacePath) {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  const absoluteTarget = path.resolve(root, ...normalizedPath.split("/"));
  const relative = path.relative(root, absoluteTarget);
  const isInsideRoot = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

  if (!isInsideRoot) {
    throw new Error(`Refusing to read outside workspace: ${workspacePath}`);
  }

  return absoluteTarget;
}
