import { createId } from "./ids";
import type { AgentSource, Mini, MiniStep, MiniVersion } from "./types";

export function addVersion(mini: Mini, steps: MiniStep[], source: AgentSource, summary: string): Mini {
  const version: MiniVersion = {
    id: createId("version"),
    miniId: mini.id,
    versionNumber: mini.versions.length + 1,
    source,
    summary,
    steps,
    createdAt: new Date().toISOString(),
  };
  return {
    ...mini,
    steps,
    currentVersionId: version.id,
    versions: [...mini.versions, version],
    updatedAt: version.createdAt,
  };
}

export function revertMini(mini: Mini, versionId: string) {
  const target = mini.versions.find((version) => version.id === versionId);
  if (!target) return mini;
  return addVersion(mini, target.steps, "revert", `Reverted to version ${target.versionNumber}.`);
}
