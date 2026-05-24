import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getMini, logFeedback, replaceMiniSteps } from "./_shared/db";
import { MINI_LESSON_SKILL } from "./_shared/miniLessonSkill";
import { error, json } from "./_shared/response";
import type { MiniStep } from "./_shared/types";

type RevisionResult = {
  updateMini: boolean;
  steps: MiniStep[];
  response: string;
  summary: string;
};

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(context.params.id);
    if (!mini) return error("Mini not found", 404);
    const { prompt, history = [] } = (await req.json()) as { prompt?: string; history?: { role: string; content: string }[] };
    if (!prompt) return error("Prompt is required", 400);
    const result = await askAnthropicForJson<RevisionResult>(
      `You are the revision agent for Sidekick mini lessons. Return only valid JSON.

Preserve the writer's intent while applying this skill:
${MINI_LESSON_SKILL}`,
      `Respond to the writer request.

Important decision rule:
- If the writer is asking for ideas, critique, explanation, options, clarification, or a planning response, do not update the mini. Set updateMini to false, return the original steps unchanged, and offer to make a change if the writer chooses an option.
- If the writer clearly asks you to revise, use, apply, change, shorten, rewrite, add, remove, or otherwise alter the mini, set updateMini to true and return updated steps.
- Use recent chat history to resolve follow-ups like "use idea #4".
- If web search is available and useful, you may use it. If you use web search, include source URLs or short source labels in response.

Writer request: ${prompt}

Recent chat history:
${JSON.stringify(history, null, 2)}

Steps:
${JSON.stringify(mini.steps, null, 2)}

Return JSON:
{
  "updateMini": boolean,
  "steps": MiniStep[],
  "response": "short response to writer",
  "summary": "version history summary"
}

If updateMini is false, steps must be exactly the original steps and summary should be "No mini changes.".
Preserve step ids and math targets unless the request explicitly changes them.`,
      { enableWebSearch: true },
    );
    const beforeVersionId = mini.currentVersionId;
    const updated = result.updateMini ? await replaceMiniSteps(mini, result.steps, "agent", result.summary) : mini;
    await logFeedback({
      kc_id: mini.kcId,
      mini_id: mini.id,
      before_version_id: beforeVersionId,
      after_version_id: result.updateMini ? updated.currentVersionId : null,
      event_type: "agent_revision",
      writer_input: prompt,
      agent_response: result.response,
      payload: { updateMini: result.updateMini, history },
    });
    return json({ mini: updated, response: result.response });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/:id/revise",
};
