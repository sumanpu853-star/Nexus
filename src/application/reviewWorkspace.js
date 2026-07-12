import { evaluateArchitectureSnapshot } from "../domain/architectureSnapshotEvaluator.js";

export async function reviewWorkspace({
  workspaceReader,
  checks
} = {}) {
  if (!workspaceReader || typeof workspaceReader.readSnapshot !== "function") {
    throw new TypeError("reviewWorkspace requires a workspaceReader with readSnapshot().");
  }

  if (!Array.isArray(checks) || checks.length === 0) {
    throw new TypeError("reviewWorkspace requires at least one architecture check.");
  }

  const targets = [...new Set(checks.map((check) => check.target))];
  const snapshot = await workspaceReader.readSnapshot({ targets });
  const report = evaluateArchitectureSnapshot(snapshot, checks);

  return {
    root: snapshot.root ?? null,
    ...report
  };
}
