import { askAnthropicForJson } from "./ai";
import { findFeedbackByRequestId, getKc, getMini, logFeedback, updateFeedbackLog } from "./db";
import { MINI_LESSON_SKILL } from "./miniLessonSkill";
import type { KnowledgeComponent, Mini } from "./types";

export type EvalRating = "strong" | "mostly_strong" | "mixed" | "needs_work";
export type EvalPriority = "high" | "medium" | "low";

export type MiniEvalDimension = {
  key: string;
  label: string;
  rating: EvalRating;
  evidence: string;
};

export type MiniEvalSuggestion = {
  number: number;
  priority: EvalPriority;
  title: string;
  steps: string[];
  issue: string;
  suggestion: string;
  implementationPrompt: string;
};

export type MiniEvalReport = {
  miniId: string;
  kcId: string;
  title: string;
  overallRating: EvalRating;
  summary: string;
  dimensions: MiniEvalDimension[];
  suggestions: MiniEvalSuggestion[];
  readyForReview: boolean;
};

export type MiniEvalStatus =
  | { pending: true; requestId: string }
  | { failed: true; requestId: string; error: string }
  | { pending?: false; report: MiniEvalReport };

const EVAL_DIMENSIONS = [
  "Math accuracy",
  "KC focus",
  "Age-appropriate examples",
  "Learning arc",
  "Step clarity",
  "Hint quality",
  "Engagement and representation",
  "Implementation readiness",
];

export function createEvalRequestId() {
  return crypto.randomUUID();
}

function evalPrompt(kc: KnowledgeComponent, mini: Mini) {
  return `Evaluate this math mini lesson. Do not revise it. Return only valid JSON.

KC:
${JSON.stringify(
  {
    id: kc.id,
    code: `${kc.grade}-${kc.topic}-${kc.kcNumber}`,
    title: kc.title,
    condition: kc.condition,
    response: kc.response,
    workedExampleMd: kc.workedExampleMd,
    notesMd: kc.notesMd,
    standards: kc.standards,
  },
  null,
  2,
)}

Mini:
${JSON.stringify(
  {
    id: mini.id,
    miniIndex: mini.miniIndex,
    title: mini.title,
    status: mini.status,
    steps: mini.steps,
  },
  null,
  2,
)}

Judge the mini on these dimensions, in this priority order:
${EVAL_DIMENSIONS.map((dimension) => `- ${dimension}`).join("\n")}

Math accuracy and KC focus are the most important dimensions. Put them first in the returned dimensions array. If either one is mixed or needs_work, the mini should usually not be ready for review.
Implementation readiness is one grouped dimension. Put all build/spec issues there: ID problems, unclear target responses, unclear interaction specs, field hygiene, export readiness, and engineering ambiguity. Do not split those into separate dimensions.
Age-appropriate examples should judge whether contexts feel appropriate and engaging for the target grade. Avoid babyish examples like "one apple plus two apples" or plain pizza-slicing unless there is a very brief teen-engaging backstory, purpose, or stake.

Use ratings only from: strong, mostly_strong, mixed, needs_work.
Give specific evidence with step IDs.
Suggestions must be numbered 1..n in priority order and written so the writer can later say "implement suggestions 1 and 3".
Each suggestion must include an implementationPrompt that can be sent to the revision agent later. The implementationPrompt should be explicit about what to change and what to preserve.
Do not suggest reteaching precursor skills unless the mini cannot work without a one-step reminder. A good suggestion should keep the mini focused on the KC.
Prioritize suggestions that fix math accuracy or KC-focus problems before style, engagement, or implementation polish.

Return JSON:
{
  "miniId": "${mini.id}",
  "kcId": "${kc.id}",
  "title": string,
  "overallRating": "strong" | "mostly_strong" | "mixed" | "needs_work",
  "summary": string,
  "dimensions": [
    {
      "key": string,
      "label": string,
      "rating": "strong" | "mostly_strong" | "mixed" | "needs_work",
      "evidence": string
    }
  ],
  "suggestions": [
    {
      "number": number,
      "priority": "high" | "medium" | "low",
      "title": string,
      "steps": [string],
      "issue": string,
      "suggestion": string,
      "implementationPrompt": string
    }
  ],
  "readyForReview": boolean
}`;
}

function normalizeReport(report: MiniEvalReport, mini: Mini, kc: KnowledgeComponent): MiniEvalReport {
  return {
    ...report,
    miniId: mini.id,
    kcId: kc.id,
    dimensions: report.dimensions ?? [],
    suggestions: (report.suggestions ?? []).map((suggestion, index) => ({
      ...suggestion,
      number: index + 1,
      steps: Array.isArray(suggestion.steps) ? suggestion.steps : [],
    })),
    readyForReview: Boolean(report.readyForReview),
  };
}

export async function ensureEvalStarted(mini: Mini, requestId: string) {
  const existing = await findFeedbackByRequestId(mini.id, requestId);
  if (existing) return existing;
  return logFeedback({
    kc_id: mini.kcId,
    mini_id: mini.id,
    before_version_id: mini.currentVersionId,
    after_version_id: null,
    event_type: "mini_eval",
    writer_input: "Eval",
    agent_response: "",
    payload: { requestId, status: "started" },
  });
}

export async function getEvalStatus(miniId: string, requestId: string): Promise<MiniEvalStatus | null> {
  const existing = await findFeedbackByRequestId(miniId, requestId);
  if (!existing) return null;
  if (existing.payload?.status === "failed") {
    return { failed: true, requestId, error: existing.payload?.error ?? "Mini eval failed." };
  }
  if (existing.payload?.status !== "completed") return { pending: true, requestId };
  const report = existing.payload?.report as MiniEvalReport | undefined;
  if (!report) throw new Error("Mini eval report not found.");
  return { report };
}

export async function runMiniEval(mini: Mini, requestId: string) {
  const existingStatus = await getEvalStatus(mini.id, requestId);
  if (existingStatus && !("pending" in existingStatus && existingStatus.pending)) return existingStatus;
  const pendingFeedback = await ensureEvalStarted(mini, requestId);
  try {
    const report = await evaluateMini(mini);
    const feedbackEntry = {
      kc_id: mini.kcId,
      mini_id: mini.id,
      before_version_id: mini.currentVersionId,
      after_version_id: null,
      event_type: "mini_eval",
      writer_input: "Eval",
      agent_response: report.summary,
      payload: { requestId, status: "completed", report },
    };
    if (pendingFeedback?.id) {
      await updateFeedbackLog(pendingFeedback.id, feedbackEntry);
    } else {
      await logFeedback(feedbackEntry);
    }
    return { report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mini eval failed.";
    if (pendingFeedback?.id) {
      await updateFeedbackLog(pendingFeedback.id, {
        kc_id: mini.kcId,
        mini_id: mini.id,
        before_version_id: mini.currentVersionId,
        after_version_id: null,
        event_type: "mini_eval",
        writer_input: "Eval",
        agent_response: `Mini eval failed: ${message}`,
        payload: { requestId, status: "failed", error: message },
      });
    }
    throw error;
  }
}

async function evaluateMini(mini: Mini) {
  const kc = await getKc(mini.kcId);
  if (!kc) throw new Error("KC not found for mini.");

  const report = normalizeReport(
    await askAnthropicForJson<MiniEvalReport>(
      `You are an expert evaluator of grades 3-8 math mini lessons. Return only valid JSON.

Follow this lesson-writing skill as the quality standard:
${MINI_LESSON_SKILL}`,
      evalPrompt(kc, mini),
    ),
    mini,
    kc,
  );

  return report;
}

export async function runMiniEvalById(miniId: string, requestId: string) {
  const mini = await getMini(miniId);
  if (!mini) throw new Error("Mini not found.");
  return runMiniEval(mini, requestId);
}
