import { getMini } from "./_shared/db";
import { runAgentRevision } from "./_shared/reviseAgent";

type BackgroundRevisionRequest = {
  miniId?: string;
  prompt?: string;
  history?: { role: string; content: string }[];
  requestId?: string;
};

export default async (req: Request) => {
  const { miniId, prompt, history = [], requestId } = (await req.json()) as BackgroundRevisionRequest;
  if (!miniId || !prompt || !requestId) return;
  const mini = await getMini(miniId);
  if (!mini) return;
  await runAgentRevision(mini, prompt, history, requestId);
};
