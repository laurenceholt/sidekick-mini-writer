import { askAnthropicForJson } from "./ai";
import { getKc, logFeedback } from "./db";
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

const EVAL_DIMENSIONS = [
  "KC alignment",
  "Learning arc",
  "Step clarity",
  "Interaction quality",
  "Hint quality",
  "Math correctness",
  "Engagement and representation",
  "Implementation readiness",
];

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

Judge the mini on these dimensions:
${EVAL_DIMENSIONS.map((dimension) => `- ${dimension}`).join("\n")}

Use ratings only from: strong, mostly_strong, mixed, needs_work.
Give specific evidence with step IDs.
Suggestions must be numbered 1..n in priority order and written so the writer can later say "implement suggestions 1 and 3".
Each suggestion must include an implementationPrompt that can be sent to the revision agent later. The implementationPrompt should be explicit about what to change and what to preserve.
Do not suggest reteaching precursor skills unless the mini cannot work without a one-step reminder. A good suggestion should keep the mini focused on the KC.

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

export async function evaluateMini(mini: Mini) {
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

  await logFeedback({
    kc_id: mini.kcId,
    mini_id: mini.id,
    before_version_id: mini.currentVersionId,
    after_version_id: null,
    event_type: "mini_eval",
    writer_input: "Eval",
    agent_response: report.summary,
    payload: { status: "completed", report },
  });

  return report;
}
