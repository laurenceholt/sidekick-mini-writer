import { seedWorkspace } from "./seed";
import type { AgentMessage, KnowledgeComponent, Mini, WorkspaceData } from "./types";

export interface GenerateMiniResult {
  mini: Mini;
  response: string;
}

function formatApiError(path: string, body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Fall through to the raw body.
  }
  return body || `Request failed: ${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(formatApiError(path, await res.text()));
  return res.json() as Promise<T>;
}

export async function fetchWorkspace(writerName: string): Promise<WorkspaceData> {
  try {
    const kcs = await request<KnowledgeComponent[]>(`/api/kcs?writer=${encodeURIComponent(writerName)}`);
    const minis = await Promise.all(
      kcs.map((kc) => request<Mini[]>(`/api/minis?kcId=${encodeURIComponent(kc.id)}`)),
    );
    return { kcs, minis: minis.flat() };
  } catch {
    return writerName === "Laurence" ? seedWorkspace : { kcs: [], minis: [] };
  }
}

export const api = {
  listWriters: () => request<string[]>("/api/writers"),
  createKc: (title: string, writerName: string) => request<KnowledgeComponent>("/api/generate-kc", { method: "POST", body: JSON.stringify({ title, writerName }) }),
  updateKc: (kc: KnowledgeComponent) => request<KnowledgeComponent>(`/api/kcs/${kc.id}`, { method: "PATCH", body: JSON.stringify(kc) }),
  generateMini: (kcId: string) => request<GenerateMiniResult>("/api/generate-mini", { method: "POST", body: JSON.stringify({ kcId }) }),
  updateMini: (mini: Mini) => request<Mini>(`/api/minis/${mini.id}`, { method: "PATCH", body: JSON.stringify(mini) }),
  reviseMini: (miniId: string, prompt: string, history: AgentMessage[]) =>
    request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/revise`, {
      method: "POST",
      body: JSON.stringify({
        prompt,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      }),
    }),
  processNotes: (miniId: string) => request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/process-notes`, { method: "POST" }),
  revertMini: (miniId: string, versionId: string) => request<Mini>(`/api/minis/${miniId}/revert`, { method: "POST", body: JSON.stringify({ versionId }) }),
};
