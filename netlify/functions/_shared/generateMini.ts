import { askAnthropicForJson } from "./ai";
import { createMini, findFeedbackByKcRequestId, findPendingMiniGenerationByKc, getMini, listMinis, logFeedback, updateFeedbackLog } from "./db";
import { MINI_LESSON_SKILL } from "./miniLessonSkill";
import type { AgentMessage, KnowledgeComponent, Mini, MiniStep } from "./types";

type GeneratedMini = {
  title: string;
  rationale: string[];
  steps: MiniStep[];
};

export type GenerateMiniStatus =
  | { pending: true; requestId: string }
  | { failed: true; requestId: string; error: string }
  | { pending?: false; mini: Mini; response: string };

const GENERATION_STALE_MS = 20 * 60 * 1000;
const MAX_GENERATION_HISTORY_MESSAGES = 20;

export function createGenerateRequestId() {
  return crypto.randomUUID();
}

function cleanHistory(history: AgentMessage[]) {
  return history
    .filter((message) => message?.content?.trim())
    .slice(-MAX_GENERATION_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
}

function formatHistory(history: AgentMessage[]) {
  const recentHistory = cleanHistory(history);
  return recentHistory.length ? JSON.stringify(recentHistory, null, 2) : "[]";
}

export async function ensureMiniGenerationStarted(kc: KnowledgeComponent, requestId: string, history: AgentMessage[] = []) {
  const existing = await findFeedbackByKcRequestId(kc.id, requestId);
  if (existing) return existing;
  return logFeedback({
    kc_id: kc.id,
    mini_id: null,
    event_type: "generate_mini",
    writer_input: "Generate Mini",
    agent_response: "",
    payload: { requestId, status: "started", history: cleanHistory(history) },
  });
}

export async function getMiniGenerationStatus(kcId: string, requestId: string): Promise<GenerateMiniStatus | null> {
  const existing = await findFeedbackByKcRequestId(kcId, requestId);
  if (!existing) return null;
  if (existing.payload?.status === "failed") {
    return { failed: true, requestId, error: existing.payload?.error ?? "Mini generation failed." };
  }
  if (existing.payload?.status !== "completed") return { pending: true, requestId };
  if (!existing.mini_id) throw new Error("Generated mini not found");
  const mini = await getMini(existing.mini_id);
  if (!mini) throw new Error("Generated mini not found");
  return { mini, response: existing.agent_response as string };
}

function isStaleGeneration(row: Record<string, any>) {
  const createdAt = new Date(row.created_at ?? 0).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > GENERATION_STALE_MS;
}

export async function getActiveMiniGenerationStatus(kcId: string): Promise<GenerateMiniStatus | null> {
  const pending = await findPendingMiniGenerationByKc(kcId);
  if (!pending) return null;
  const requestId = pending.payload?.requestId;
  if (!requestId) return null;
  if (isStaleGeneration(pending)) {
    await updateFeedbackLog(pending.id, {
      agent_response: "Mini generation failed: the background job did not finish in time.",
      payload: { ...pending.payload, status: "failed", error: "Mini generation timed out before finishing." },
    });
    return { failed: true, requestId, error: "Mini generation timed out before finishing." };
  }
  return { pending: true, requestId };
}

export async function runMiniGeneration(kc: KnowledgeComponent, requestId: string, history: AgentMessage[] = []) {
  const existingStatus = await getMiniGenerationStatus(kc.id, requestId);
  if (existingStatus && (!("pending" in existingStatus) || !existingStatus.pending)) return existingStatus;
  const pendingFeedback = await ensureMiniGenerationStarted(kc, requestId, history);
  try {
    const existing = await listMinis(kc.id);
    const miniIndex = Math.min(existing.length + 1, 4);
    const generated = await askAnthropicForJson<GeneratedMini>(
      `You write Sidekick mini lessons for grades 3-8. Return only valid JSON.

Follow this skill exactly:
${MINI_LESSON_SKILL}`,
      `Create one mini lesson for this KC.

KC: ${kc.title}
Condition: ${kc.condition}
Response: ${kc.response}
Worked example: ${kc.workedExampleMd}
KC notes from writer: ${kc.notesMd?.trim() || "None"}

Recent KC chat history:
${formatHistory(history)}

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

Use exactly 8-12 steps. Step ids must follow ${kc.grade}-${kc.topic}-${kc.kcNumber}-${miniIndex}-stepNumber. Use the KC notes and recent chat history as writer intent/context, but do not quote them unless useful. Keep learner instructions short. Use plain text math, not math markup. Focus directly on the KC rather than teaching precursor skills. Build a warm-up to naming to stretching to synthesis arc, vary interaction types, and avoid hints that give away answers. Set writerNotes and agentNotes to empty strings on every generated step.

Write 3-5 short rationale bullets explaining the hook, sequencing, interaction choices, and how the mini follows the skill. Each rationale bullet should be a complete sentence, not shorthand.`,
      { enableWebSearch: true },
    );
    const mini = await createMini(kc, miniIndex, generated.title, generated.steps, "generate", "Generated from KC.");
    const rationale = Array.isArray(generated.rationale) && generated.rationale.length ? generated.rationale : ["Built a short practice arc from warm-up to synthesis."];
    const response = `Done. Claude generated a mini for this KC.\n\n**Rationale**\n${rationale.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
    const feedbackEntry = {
      kc_id: kc.id,
      mini_id: mini.id,
      event_type: "generate_mini",
      writer_input: "Generate Mini",
      agent_response: response,
      after_version_id: mini.currentVersionId,
      payload: { requestId, status: "completed", history: cleanHistory(history) },
    };
    if (pendingFeedback?.id) {
      await updateFeedbackLog(pendingFeedback.id, feedbackEntry);
    } else {
      await logFeedback(feedbackEntry);
    }
    return { mini, response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mini generation failed.";
    if (pendingFeedback?.id) {
      await updateFeedbackLog(pendingFeedback.id, {
        kc_id: kc.id,
        mini_id: null,
        event_type: "generate_mini",
        writer_input: "Generate Mini",
        agent_response: `Mini generation failed: ${message}`,
        payload: { requestId, status: "failed", error: message, history: cleanHistory(history) },
      });
    }
    throw error;
  }
}
