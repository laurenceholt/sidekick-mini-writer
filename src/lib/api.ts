import { seedWorkspace } from "./seed";
import type { KnowledgeComponent, Mini, WorkspaceData } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function fetchWorkspace(): Promise<WorkspaceData> {
  try {
    const kcs = await request<KnowledgeComponent[]>("/api/kcs");
    const minis = await Promise.all(
      kcs.map((kc) => request<Mini[]>(`/api/minis?kcId=${encodeURIComponent(kc.id)}`)),
    );
    return { kcs, minis: minis.flat() };
  } catch {
    return seedWorkspace;
  }
}

export const api = {
  createKc: (title: string) => request<KnowledgeComponent>("/api/kcs/generate", { method: "POST", body: JSON.stringify({ title }) }),
  updateKc: (kc: KnowledgeComponent) => request<KnowledgeComponent>(`/api/kcs/${kc.id}`, { method: "PATCH", body: JSON.stringify(kc) }),
  generateMini: (kcId: string) => request<Mini>("/api/minis/generate", { method: "POST", body: JSON.stringify({ kcId }) }),
  updateMini: (mini: Mini) => request<Mini>(`/api/minis/${mini.id}`, { method: "PATCH", body: JSON.stringify(mini) }),
  reviseMini: (miniId: string, prompt: string) => request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/revise`, { method: "POST", body: JSON.stringify({ prompt }) }),
  processNotes: (miniId: string) => request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/process-notes`, { method: "POST" }),
  revertMini: (miniId: string, versionId: string) => request<Mini>(`/api/minis/${miniId}/revert`, { method: "POST", body: JSON.stringify({ versionId }) }),
};
