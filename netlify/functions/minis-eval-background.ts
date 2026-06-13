import { runMiniEvalById } from "./_shared/evaluateMini";

type BackgroundEvalRequest = {
  miniId?: string;
  requestId?: string;
};

export default async (req: Request) => {
  const { miniId, requestId } = (await req.json()) as BackgroundEvalRequest;
  if (!miniId || !requestId) return;
  await runMiniEvalById(miniId, requestId).catch((error) => {
    console.error("Mini eval failed", error);
  });
};
