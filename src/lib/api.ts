import { seedWorkspace } from "./seed";
import type { AgentMessage, KnowledgeComponent, Mini, NewKcInput, WorkspaceData } from "./types";

export interface GenerateMiniResult {
  mini: Mini;
  response: string;
}

type RevisionResult = {
  mini: Mini;
  response: string;
};

type PendingRequest = {
  pending: true;
  requestId: string;
};

type FailedRequest = {
  failed: true;
  requestId: string;
  error: string;
};

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

function isPendingRequest(value: RevisionResult | GenerateMiniResult | PendingRequest | FailedRequest | null): value is PendingRequest {
  return Boolean(value && "pending" in value && value.pending);
}

function isFailedRequest(value: RevisionResult | GenerateMiniResult | PendingRequest | FailedRequest | null): value is FailedRequest {
  return Boolean(value && "failed" in value && value.failed);
}

async function pollRevision(miniId: string, id: string): Promise<RevisionResult> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180_000) {
    await wait(2_000);
    const status = await request<RevisionResult | PendingRequest>(
      `/api/minis/${miniId}/revise-status?requestId=${encodeURIComponent(id)}`,
      { networkRetries: 2 },
    );
    if (!isPendingRequest(status)) return status;
  }
  throw new Error("Claude is still working. Try Send again in a moment.");
}

async function pollMiniGeneration(kcId: string, id: string): Promise<GenerateMiniResult> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 14 * 60_000) {
    await wait(2_000);
    const status = await request<GenerateMiniResult | PendingRequest | FailedRequest>(
      `/api/generate-mini-status?kcId=${encodeURIComponent(kcId)}&requestId=${encodeURIComponent(id)}`,
      { networkRetries: 2 },
    );
    if (isFailedRequest(status)) throw new Error(status.error);
    if (!isPendingRequest(status)) return status;
  }
  throw new Error("Claude is still generating. Refresh this KC to reconnect to the pending job.");
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
  listAgentMessages: (kcId: string) => request<AgentMessage[]>(`/api/agent-messages?kcId=${encodeURIComponent(kcId)}`),
  createKc: (input: NewKcInput, writerName: string) => request<KnowledgeComponent>("/api/generate-kc", { method: "POST", body: JSON.stringify({ ...input, writerName }) }),
  updateKc: (kc: KnowledgeComponent) => request<KnowledgeComponent>(`/api/kcs/${kc.id}`, { method: "PATCH", body: JSON.stringify(kc) }),
  deleteKc: (kcId: string) => request<{ ok: true }>(`/api/kcs/${kcId}`, { method: "DELETE" }),
  getActiveMiniGeneration: (kcId: string) =>
    request<PendingRequest | FailedRequest | null>(`/api/generate-mini-status?kcId=${encodeURIComponent(kcId)}`, { networkRetries: 2 }),
  waitForMiniGeneration: pollMiniGeneration,
  generateMini: async (kcId: string, history: AgentMessage[]) => {
    const id = requestId();
    const started = await request<GenerateMiniResult | PendingRequest | FailedRequest>("/api/generate-mini", {
      method: "POST",
      networkRetries: 1,
      body: JSON.stringify({ kcId, requestId: id, history }),
    });
    if (isFailedRequest(started)) throw new Error(started.error);
    return isPendingRequest(started) ? pollMiniGeneration(kcId, started.requestId) : started;
  },
  updateMini: (mini: Mini) => request<Mini>(`/api/minis/${mini.id}`, { method: "PATCH", body: JSON.stringify(mini) }),
  reviseMini: async (miniId: string, prompt: string, history: AgentMessage[]) => {
    const id = requestId();
    const started = await request<RevisionResult | PendingRequest>(`/api/minis/${miniId}/revise`, {
      method: "POST",
      networkRetries: 1,
      body: JSON.stringify({
        requestId: id,
        prompt,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      }),
    });
    return isPendingRequest(started) ? pollRevision(miniId, started.requestId) : started;
  },
  processNotes: (miniId: string) => request<{ mini: Mini; response: string }>(`/api/minis/${miniId}/process-notes`, { method: "POST" }),
  revertMini: (miniId: string, versionId: string) => request<Mini>(`/api/minis/${miniId}/revert`, { method: "POST", body: JSON.stringify({ versionId }) }),
};
