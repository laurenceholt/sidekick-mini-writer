import { getKc } from "./_shared/db";
import { runMiniGeneration } from "./_shared/generateMini";
import type { AgentMessage } from "./_shared/types";

type BackgroundGenerateRequest = {
  kcId?: string;
  requestId?: string;
  history?: AgentMessage[];
};

export default async (req: Request) => {
  const { kcId, requestId, history = [] } = (await req.json()) as BackgroundGenerateRequest;
  if (!kcId || !requestId) return;
  const kc = await getKc(kcId);
  if (!kc) return;
  await runMiniGeneration(kc, requestId, history).catch((error) => {
    console.error("Mini generation failed", error);
  });
};
