import { seedWorkspace } from "./seed";
import type { WorkspaceData } from "./types";

const KEY = "mini-writer-workspace-v1";

export function loadLocalWorkspace(): WorkspaceData {
  const stored = window.localStorage.getItem(KEY);
  if (!stored) return seedWorkspace;
  try {
    return JSON.parse(stored) as WorkspaceData;
  } catch {
    return seedWorkspace;
  }
}

export function saveLocalWorkspace(data: WorkspaceData) {
  window.localStorage.setItem(KEY, JSON.stringify(data));
}
