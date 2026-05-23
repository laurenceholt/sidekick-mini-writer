import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getMini, logFeedback, replaceMiniSteps } from "./_shared/db";
import { fallbackRevision } from "./_shared/localAi";
import { error, json } from "./_shared/response";
import type { MiniStep } from "./_shared/types";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(context.params.id);
    if (!mini) return error("Mini not found", 404);
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt) return error("Prompt is required", 400);
    const fallback = fallbackRevision(mini.steps, prompt);
    const result = await askAnthropicForJson<{ steps: MiniStep[]; response: string; summary: string }>(
      "You revise Sidekick mini lesson steps. Return only valid JSON.",
      `Revise these mini lesson steps according to the writer request.

Writer request: ${prompt}

Steps:
${JSON.stringify(mini.steps, null, 2)}

Return JSON:
{
  "steps": MiniStep[],
  "response": "short response to writer",
  "summary": "version history summary"
}

Preserve step ids and math targets unless the request explicitly changes them.`,
      fallback,
    );
    const beforeVersionId = mini.currentVersionId;
    const updated = await replaceMiniSteps(mini, result.steps, "agent", result.summary);
    await logFeedback({
      kc_id: mini.kcId,
      mini_id: mini.id,
      before_version_id: beforeVersionId,
      after_version_id: updated.currentVersionId,
      event_type: "agent_revision",
      writer_input: prompt,
      agent_response: result.response,
    });
    return json({ mini: updated, response: result.response });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/:id/revise",
};
