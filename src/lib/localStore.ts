import { seedWorkspace } from "./seed";
import type { KnowledgeComponent, WorkspaceData } from "./types";

const KEY = "mini-writer-workspace-v1";

function keyForWriter(writerName: string) {
  return `${KEY}:${writerName}`;
}

function normalizeKc(kc: KnowledgeComponent & { unit?: number; lesson?: number; kc_number?: number }): KnowledgeComponent {
  return {
    ...kc,
    topic: kc.topic ?? kc.unit ?? 6,
    kcNumber: kc.kcNumber ?? kc.kc_number ?? kc.lesson ?? 1,
  };
}

function normalizeWorkspace(data: WorkspaceData): WorkspaceData {
  return {
    ...data,
    kcs: data.kcs.map((kc) => normalizeKc(kc)),
  };
}

export function loadLocalWorkspace(writerName = "Laurence"): WorkspaceData {
  const stored = window.localStorage.getItem(keyForWriter(writerName)) ?? (writerName === "Laurence" ? window.localStorage.getItem(KEY) : null);
  if (!stored) return writerName === "Laurence" ? seedWorkspace : { kcs: [], minis: [] };
  try {
    return normalizeWorkspace(JSON.parse(stored) as WorkspaceData);
  } catch {
    return writerName === "Laurence" ? seedWorkspace : { kcs: [], minis: [] };
  }
}

export function saveLocalWorkspace(data: WorkspaceData, writerName = "Laurence") {
  window.localStorage.setItem(keyForWriter(writerName), JSON.stringify(data));
}
