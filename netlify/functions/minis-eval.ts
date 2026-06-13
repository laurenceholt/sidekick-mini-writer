import type { Config, Context } from "@netlify/functions";
import { getMini } from "./_shared/db";
import { createEvalRequestId, ensureEvalStarted, getEvalStatus, runMiniEval } from "./_shared/evaluateMini";
import { error, json } from "./_shared/response";

type EvalRequest = {
  requestId?: string;
};

async function startBackgroundEval(req: Request, miniId: string, requestId: string) {
  const backgroundUrl = new URL("/.netlify/functions/minis-eval-background", req.url);
  await fetch(backgroundUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ miniId, requestId }),
  });
}

export default async (req: Request, context: Context) => {
  try {
    const id = context.params.id;
    if (!id) return error("Mini id is required", 400);

    if (req.method === "GET") {
      const requestId = new URL(req.url).searchParams.get("requestId");
      if (!requestId) return error("requestId is required", 400);
      const status = await getEvalStatus(id, requestId);
      return status ? json(status, { status: "pending" in status && status.pending ? 202 : 200 }) : error("Mini eval request not found", 404);
    }

    if (req.method !== "POST") return error("Method not allowed", 405);
    const { requestId = createEvalRequestId() } = (await req.json().catch(() => ({}))) as EvalRequest;
    const mini = await getMini(id);
    if (!mini) return error("Mini not found", 404);

    const existing = await getEvalStatus(mini.id, requestId);
    if (existing) return json(existing, { status: "pending" in existing && existing.pending ? 202 : 200 });

    const started = await ensureEvalStarted(mini, requestId);
    if (!started) {
      return json(await runMiniEval(mini, requestId), { status: 201 });
    }
    context.waitUntil(startBackgroundEval(req, mini.id, requestId));
    return json({ pending: true, requestId }, { status: 202 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/minis/:id/eval", "/api/minis/:id/eval-status"],
};
