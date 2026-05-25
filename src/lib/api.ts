import { seedWorkspace } from "./seed";
import type { AgentMessage, KnowledgeComponent, Mini, WorkspaceData } from "./types";

export interface GenerateMiniResult {
  mini: Mini;
  response: string;
}

type RequestOptions = RequestInit & {
  networkRetries?: number;
};

function formatApiError(path: string, body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Fall through to the raw body.
  }
  return body || `Request failed: ${path}`;
}

function isNetworkFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("load failed") || message.includes("failed to fetch") || message.includes("networkerror");
}

function requestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { networkRetries = 0, ...fetchInit } = init ?? {};
  for (let attempt = 0; attempt <= networkRetries; attempt += 1) {
    try {
      const res = await fetch(path, {
        ...fetchInit,
        headers: {
          "content-type": "application/json",
          ...(fetchInit.headers ?? {}),
        },
      });
      const body = await res.text();
      if (!res.ok) throw new Error(formatApiError(path, body));
      const parsed = body ? JSON.parse(body) : null;
      if (parsed?.error) throw new Error(parsed.error);
      return parsed as T;
    } catch (error) {
      if (attempt >= networkRetries || !isNetworkFailure(error)) throw error;
      await wait(1_500 * (attempt + 1));
    }
  }
  throw new Error(`Request failed: ${path}`);
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
      networkRetries: 1,
      body: JSON.stringify({
        requestId: requestId(),
        prompt,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      }),
    }),
  processNotes: (miniId: string) => request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/process-notes`, { method: "POST" }),
  revertMini: (miniId: string, versionId: string) => request<Mini>(`/api/minis/${miniId}/revert`, { method: "POST", body: JSON.stringify({ versionId }) }),
};
