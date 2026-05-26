import type { Config, Context } from "@netlify/functions";
import { getKc } from "./_shared/db";
import { createGenerateRequestId, ensureMiniGenerationStarted, getMiniGenerationStatus, runMiniGeneration } from "./_shared/generateMini";
import { error, json } from "./_shared/response";

type GenerateMiniRequest = {
  kcId?: string;
  requestId?: string;
};

async function startBackgroundGeneration(req: Request, kcId: string, requestId: string) {
  const backgroundUrl = new URL("/.netlify/functions/minis-generate-background", req.url);
  await fetch(backgroundUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kcId, requestId }),
  });
}

export default async (req: Request, context: Context) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const kcId = url.searchParams.get("kcId");
      const requestId = url.searchParams.get("requestId");
      if (!kcId) return error("kcId is required", 400);
      if (!requestId) return error("requestId is required", 400);
      const status = await getMiniGenerationStatus(kcId, requestId);
      return status ? json(status) : error("Mini generation request not found", 404);
    }
    if (req.method !== "POST") return error("Method not allowed", 405);
    const { kcId, requestId = createGenerateRequestId() } = (await req.json()) as GenerateMiniRequest;
    if (!kcId) return error("kcId is required", 400);
    const kc = await getKc(kcId);
    if (!kc) return error("KC not found", 404);

    const existing = await getMiniGenerationStatus(kc.id, requestId);
    if (existing) return json(existing, { status: existing.pending ? 202 : 200 });

    const started = await ensureMiniGenerationStarted(kc, requestId);
    if (!started) {
      return json(await runMiniGeneration(kc, requestId), { status: 201 });
    }
    context.waitUntil(startBackgroundGeneration(req, kc.id, requestId));
    return json({ pending: true, requestId }, { status: 202 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/generate-mini", "/api/generate-mini-status"],
};
