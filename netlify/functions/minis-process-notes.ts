import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getMini, logFeedback, replaceMiniSteps } from "./_shared/db";
import { MINI_LESSON_SKILL } from "./_shared/miniLessonSkill";
import { error, json } from "./_shared/response";
import type { MiniStep } from "./_shared/types";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(context.params.id);
    if (!mini) return error("Mini not found", 404);
    const notes = mini.steps.filter((step) => step.agentNotes.trim());
    const result = await askAnthropicForJson<{ steps: MiniStep[]; response: string; summary: string }>(
      `You process per-step writer notes for a math mini lesson. Return only valid JSON.

Apply writer notes using this lesson-writing skill:
${MINI_LESSON_SKILL}`,
      `Apply each agentNotes field to its own step. Clear agentNotes after applying.

Steps:
${JSON.stringify(mini.steps, null, 2)}

Return JSON:
{
  "steps": MiniStep[],
  "response": "brief per-step response for the writer",
  "summary": "version history summary"
}`,
    );
    const beforeVersionId = mini.currentVersionId;
    const updated = await replaceMiniSteps(mini, result.steps, "notes", result.summary);
    await logFeedback({
      kc_id: mini.kcId,
      mini_id: mini.id,
      before_version_id: beforeVersionId,
      after_version_id: updated.currentVersionId,
      event_type: "process_agent_notes",
      writer_input: JSON.stringify(notes),
      agent_response: result.response,
    });
    return json({ mini: updated, response: result.response });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/:id/process-notes",
};
