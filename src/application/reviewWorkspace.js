import {
  DEFAULT_ARCHITECTURE_CHECKS
} from "../domain/architectureCheckDefinitions.js";
import { evaluateArchitectureSnapshot } from "../domain/architectureSnapshotEvaluator.js";

export async function reviewWorkspace({
  workspaceReader,
  checks = DEFAULT_ARCHITECTURE_CHECKS
} = {}) {
  if (!workspaceReader || typeof workspaceReader.readSnapshot !== "function") {
    throw new TypeError("reviewWorkspace requires a workspaceReader with readSnapshot().");
  }

  const targets = [...new Set(checks.map((check) => check.target))];
  const snapshot = await workspaceReader.readSnapshot({ targets });
  const report = evaluateArchitectureSnapshot(snapshot, checks);

  return {
    root: snapshot.root ?? null,
    ...report
  };
}
