import { askAnthropicForText } from "./ai";
import { findFeedbackByRequestId, getMini, logFeedback, replaceMiniSteps, updateFeedbackLog } from "./db";
import { MINI_LESSON_SKILL } from "./miniLessonSkill";
import type { Mini, MiniStep } from "./types";

type RevisionResult = {
  updateMini: boolean;
  steps: MiniStep[];
  response: string;
  summary: string;
};

export type RevisionStatus =
  | { pending: true; requestId: string }
  | { pending?: false; mini: Mini; response: string };

export function createRevisionRequestId() {
  return crypto.randomUUID();
}

export async function ensureRevisionStarted(
  mini: Mini,
  prompt: string,
  history: { role: string; content: string }[],
  requestId: string,
) {
  const existing = await findFeedbackByRequestId(mini.id, requestId);
  if (existing) return existing;
  return logFeedback({
    kc_id: mini.kcId,
    mini_id: mini.id,
    before_version_id: mini.currentVersionId,
    after_version_id: null,
    event_type: "agent_revision",
    writer_input: prompt,
    agent_response: "",
    payload: { requestId, status: "started", history },
  });
}

export async function getRevisionStatus(miniId: string, requestId: string): Promise<RevisionStatus | null> {
  const existing = await findFeedbackByRequestId(miniId, requestId);
  if (!existing) return null;
  if (existing.payload?.status !== "completed") return { pending: true, requestId };
  const mini = await getMini(miniId);
  if (!mini) throw new Error("Mini not found");
  return { mini, response: existing.agent_response as string };
}

function parseRevisionResponse(text: string, originalSteps: MiniStep[]): RevisionResult {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = parseRevisionCandidate(cleaned);
  if (parsed) {
    return {
      updateMini: parsed.updateMini,
      steps: parsed.updateMini ? parsed.steps : originalSteps,
      response: parsed.response,
      summary: parsed.summary || (parsed.updateMini ? "Agent revision." : "No mini changes."),
    };
  }
  return {
    updateMini: false,
    steps: originalSteps,
    response: cleaned || "I could not format a response, but I did not change the mini.",
    summary: "No mini changes.",
  };
}

function parseRevisionCandidate(text: string): RevisionResult | null {
  const candidates = [text, ...extractJsonObjects(text)];
  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function parseCandidate(candidate: string): RevisionResult | null {
  try {
    const parsed = JSON.parse(candidate) as RevisionResult;
    if (typeof parsed.updateMini !== "boolean" || !Array.isArray(parsed.steps) || typeof parsed.response !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractJsonObjects(text: string) {
  const objects: string[] = [];
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        objects.push(text.slice(start, index + 1));
        break;
      }
    }
  }
  return objects.reverse();
}

export async function runAgentRevision(
  mini: Mini,
  prompt: string,
  history: { role: string; content: string }[],
  requestId: string,
) {
  const existingStatus = await getRevisionStatus(mini.id, requestId);
  if (existingStatus && !existingStatus.pending) return existingStatus;
  const pendingFeedback = await ensureRevisionStarted(mini, prompt, history, requestId);
  const beforeVersionId = mini.currentVersionId;

  const responseText = await askAnthropicForText(
    `You are the revision agent for Sidekick mini lessons. Return only valid JSON.

Preserve the writer's intent while applying this skill:
${MINI_LESSON_SKILL}`,
    `Respond to the writer request.

Important decision rule:
- If the writer is asking for ideas, critique, explanation, options, clarification, or a planning response, do not update the mini. Set updateMini to false, return the original steps unchanged, and offer to make a change if the writer chooses an option.
- When the writer asks for ideas, format the response as a numbered list so the writer can refer to each idea by number. Include concrete examples, not shorthand narrative.
- When any response includes a list of options, recommendations, hooks, examples, or possible revisions, use a numbered list so the writer can refer to items by number.
- If the writer clearly asks you to revise, use, apply, change, shorten, rewrite, add, remove, or otherwise alter the mini, set updateMini to true and return updated steps.
- Use recent chat history to resolve follow-ups like "use idea #4".
- If web search is available and useful, you may use it. If you use web search, include source URLs or short source labels in response.
- Format your response as short paragraphs and lists with blank lines between sections. Do not return one long narrative block.
- Treat writerNotes as the writer's per-step requests. Treat agentNotes as your brief status/rationale field.
- If you process a writerNotes request, clear writerNotes and append a short "**Done:** ..." note to agentNotes for that step.
- Do not use agentNotes for new writer requests.

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
  const result = parseRevisionResponse(responseText, mini.steps);
  const updated = result.updateMini ? await replaceMiniSteps(mini, result.steps, "agent", result.summary) : mini;
  const feedbackEntry = {
    kc_id: mini.kcId,
    mini_id: mini.id,
    before_version_id: beforeVersionId,
    after_version_id: result.updateMini ? updated.currentVersionId : null,
    event_type: "agent_revision",
    writer_input: prompt,
    agent_response: result.response,
    payload: { requestId, status: "completed", updateMini: result.updateMini, history },
  };
  if (pendingFeedback?.id) {
    await updateFeedbackLog(pendingFeedback.id, feedbackEntry);
  } else {
    await logFeedback(feedbackEntry);
  }
  return { mini: updated, response: result.response };
}
