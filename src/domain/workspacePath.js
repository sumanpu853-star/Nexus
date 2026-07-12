export function normalizeWorkspacePath(value) {
  if (typeof value !== "string") {
    throw new TypeError("Workspace paths must be strings.");
  }

  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/g, "");
}
