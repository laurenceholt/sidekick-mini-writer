import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getMini, logFeedback, replaceMiniSteps } from "./_shared/db";
import { MINI_LESSON_SKILL } from "./_shared/miniLessonSkill";
import { error, json } from "./_shared/response";
import type { MiniStep } from "./_shared/types";

function isDoneNote(note: string) {
  return /\*\*Done\*\*/i.test(note) || /(^|\s)-\s*Done\s*$/i.test(note);
}

function markProcessedNotes(steps: MiniStep[], originalNotes: MiniStep[]) {
  const processedIds = new Set(originalNotes.map((step) => step.id));
  const originalById = new Map(originalNotes.map((step) => [step.id, step.agentNotes.trim()]));
  return steps.map((step) => {
    if (!processedIds.has(step.id) || isDoneNote(step.agentNotes)) return step;
    const originalNote = originalById.get(step.id) ?? step.agentNotes.trim();
    return { ...step, agentNotes: `${originalNote} - **Done**` };
  });
}

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(context.params.id);
    if (!mini) return error("Mini not found", 404);
    const notes = mini.steps.filter((step) => step.agentNotes.trim() && !isDoneNote(step.agentNotes));
    if (!notes.length) {
      await logFeedback({
        kc_id: mini.kcId,
        mini_id: mini.id,
        before_version_id: mini.currentVersionId,
        after_version_id: null,
        event_type: "process_agent_notes",
        writer_input: "[]",
        agent_response: "No unprocessed agent notes.",
        payload: { skipped: true },
      });
      return json({ mini, response: "No unprocessed agent notes." });
    }
    const result = await askAnthropicForJson<{ steps: MiniStep[]; response: string; summary: string }>(
      `You process per-step writer notes for a math mini lesson. Return only valid JSON.

Apply writer notes using this lesson-writing skill:
${MINI_LESSON_SKILL}`,
      `Apply each unprocessed agentNotes field to its own step.

Rules:
- Process only agent notes that do not already contain **Done**.
- Do not reprocess notes that already contain **Done**.
- After applying a note, keep the note text in agentNotes and append " - **Done**".
- Do not clear agentNotes.
- If a note is already marked done, leave that step unchanged.

Unprocessed agent notes:
${JSON.stringify(notes.map((step) => ({ id: step.id, agentNotes: step.agentNotes })), null, 2)}

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
    const steps = markProcessedNotes(result.steps, notes);
    const updated = await replaceMiniSteps(mini, steps, "notes", result.summary);
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
