import type { Config, Context } from "@netlify/functions";
import { getMini } from "./_shared/db";
import { createRevisionRequestId, ensureRevisionStarted, getRevisionStatus } from "./_shared/reviseAgent";
import { error, json } from "./_shared/response";

type RevisionRequest = {
  prompt?: string;
  history?: { role: string; content: string }[];
  requestId?: string;
};

async function startBackgroundRevision(req: Request, miniId: string, body: Required<RevisionRequest>) {
  const backgroundUrl = new URL("/.netlify/functions/minis-revise-background", req.url);
  await fetch(backgroundUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ miniId, ...body }),
  });
}

export default async (req: Request, context: Context) => {
  try {
    const miniId = context.params.id;
    if (req.method === "GET") {
      const requestId = new URL(req.url).searchParams.get("requestId");
      if (!requestId) return error("requestId is required", 400);
      const status = await getRevisionStatus(miniId, requestId);
      return status ? json(status) : error("Revision request not found", 404);
    }
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(miniId);
    if (!mini) return error("Mini not found", 404);
    const { prompt, history = [], requestId = createRevisionRequestId() } = (await req.json()) as RevisionRequest;
    if (!prompt) return error("Prompt is required", 400);

    const existing = await getRevisionStatus(mini.id, requestId);
    if (existing) return json(existing, { status: existing.pending ? 202 : 200 });

    const body = { prompt, history, requestId };
    await ensureRevisionStarted(mini, prompt, history, requestId);
    context.waitUntil(startBackgroundRevision(req, mini.id, body));
    return json({ pending: true, requestId }, { status: 202 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/minis/:id/revise", "/api/minis/:id/revise-status"],
};
