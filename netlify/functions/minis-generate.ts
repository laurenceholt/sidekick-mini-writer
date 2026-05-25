import type { Config } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { createMini, getKc, listMinis, logFeedback } from "./_shared/db";
import { MINI_LESSON_SKILL } from "./_shared/miniLessonSkill";
import { error, json } from "./_shared/response";
import type { MiniStep } from "./_shared/types";

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const { kcId } = (await req.json()) as { kcId?: string };
    if (!kcId) return error("kcId is required", 400);
    const kc = await getKc(kcId);
    if (!kc) return error("KC not found", 404);
    const existing = await listMinis(kcId);
    const miniIndex = Math.min(existing.length + 1, 4);
    const generated = await askAnthropicForJson<{ title: string; rationale: string[]; steps: MiniStep[] }>(
      `You write Sidekick mini lessons for grades 3-8. Return only valid JSON.

Follow this skill exactly:
${MINI_LESSON_SKILL}`,
      `Create one mini lesson for this KC.

KC: ${kc.title}
Condition: ${kc.condition}
Response: ${kc.response}
Worked example: ${kc.workedExampleMd}

Return JSON:
{
  "title": string,
  "rationale": [
    string
  ],
  "steps": [
    {
      "id": string,
      "instruction": string,
      "interaction": string,
      "targetResponse": string,
      "hint": string,
      "writerNotes": "",
      "agentNotes": ""
    }
  ]
}

Use exactly 8-12 steps. Step ids must follow ${kc.grade}-${kc.topic}-${kc.kcNumber}-${miniIndex}-stepNumber. Keep learner instructions short. Use plain text math, not math markup. Build a warm-up to naming to stretching to synthesis arc, vary interaction types, and avoid hints that give away answers. Set writerNotes and agentNotes to empty strings on every generated step.

Write 3-5 short rationale bullets explaining the hook, sequencing, interaction choices, and how the mini follows the skill. Each rationale bullet should be a complete sentence, not shorthand.`,
      { enableWebSearch: true },
    );
    const mini = await createMini(kc, miniIndex, generated.title, generated.steps, "generate", "Generated from KC.");
    const rationale = Array.isArray(generated.rationale) && generated.rationale.length ? generated.rationale : ["Built a short practice arc from warm-up to synthesis."];
    const response = `Done. Claude generated a mini for this KC.\n\n**Rationale**\n${rationale.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
    await logFeedback({ kc_id: kc.id, mini_id: mini.id, event_type: "generate_mini", agent_response: response, after_version_id: mini.currentVersionId });
    return json({ mini, response }, { status: 201 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/generate-mini",
};
