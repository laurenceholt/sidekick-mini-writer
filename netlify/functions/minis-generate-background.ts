import { getKc } from "./_shared/db";
import { runMiniGeneration } from "./_shared/generateMini";

type BackgroundGenerateRequest = {
  kcId?: string;
  requestId?: string;
};

export default async (req: Request) => {
  const { kcId, requestId } = (await req.json()) as BackgroundGenerateRequest;
  if (!kcId || !requestId) return;
  const kc = await getKc(kcId);
  if (!kc) return;
  await runMiniGeneration(kc, requestId).catch((error) => {
    console.error("Mini generation failed", error);
  });
};
