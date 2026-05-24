import { seedWorkspace } from "./seed";
import type { WorkspaceData } from "./types";

const KEY = "mini-writer-workspace-v1";

function keyForWriter(writerName: string) {
  return `${KEY}:${writerName}`;
}

export function loadLocalWorkspace(writerName = "Laurence"): WorkspaceData {
  const stored = window.localStorage.getItem(keyForWriter(writerName)) ?? (writerName === "Laurence" ? window.localStorage.getItem(KEY) : null);
  if (!stored) return writerName === "Laurence" ? seedWorkspace : { kcs: [], minis: [] };
  try {
    return JSON.parse(stored) as WorkspaceData;
  } catch {
    return writerName === "Laurence" ? seedWorkspace : { kcs: [], minis: [] };
  }
}

export function saveLocalWorkspace(data: WorkspaceData, writerName = "Laurence") {
  window.localStorage.setItem(keyForWriter(writerName), JSON.stringify(data));
}
