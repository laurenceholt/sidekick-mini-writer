import type { Config } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { createMini, getKc, listMinis, logFeedback } from "./_shared/db";
import { fallbackSteps } from "./_shared/localAi";
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
    const fallback = { title: `${kc.title} mini ${miniIndex}`, steps: fallbackSteps(kc, miniIndex) };
    const generated = await askAnthropicForJson<{ title: string; steps: MiniStep[] }>(
      "You write Sidekick mini lessons for grades 3-8. Return only valid JSON.",
      `Create one mini lesson for this KC.

KC: ${kc.title}
Condition: ${kc.condition}
Response: ${kc.response}
Worked example: ${kc.workedExampleMd}

Return JSON:
{
  "title": string,
  "steps": [
    {
      "id": string,
      "instruction": string,
      "interaction": string,
      "targetResponse": string,
      "hint": string,
      "agentNotes": ""
    }
  ]
}

Use exactly 8-12 steps. Step ids must follow ${kc.grade}-${kc.unit}-${kc.lesson}-${miniIndex}-stepNumber. Keep learner instructions short.`,
      fallback,
    );
    const mini = await createMini(kc, miniIndex, generated.title, generated.steps, "generate", "Generated from KC.");
    await logFeedback({ kc_id: kc.id, mini_id: mini.id, event_type: "generate_mini", agent_response: "Generated mini.", after_version_id: mini.currentVersionId });
    return json(mini, { status: 201 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/generate",
};
