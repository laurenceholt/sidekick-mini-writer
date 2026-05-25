import { createId, renumberSteps, slugify } from "./ids";
import { standardsForTitle } from "./standards";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

export function generateKcDraft(title: string): KnowledgeComponent {
  const createdAt = new Date().toISOString();
  const standards = standardsForTitle(title);
  return {
    id: createId("kc"),
    writerName: "Laurence",
    title,
    slug: slugify(title),
    grade: 6,
    unit: 6,
    lesson: 1,
    condition: "Given an equation with numerical expressions or variables on both sides.",
    response: "Determine whether a value makes the equation true, or whether the two sides are equal.",
    workedExampleMd:
      "Substitute the given value and compare both sides.\n\nFor 0.4x = 20 when x = 15: 0.4 x 15 = 6, and 6 is not equal to 20, so the equation is false.",
    standards,
    notesMd: "",
    createdAt,
    updatedAt: createdAt,
  };
}

export function generateMiniForKc(kc: KnowledgeComponent, miniIndex: number): Mini {
  const createdAt = new Date().toISOString();
  const baseSteps: Omit<MiniStep, "id">[] = [
    ["Evaluate both sides of `4 + 5 = 9`. Is it true or false?", "True/false choice with both sides shown.", "True", "`4 + 5` equals 9."],
    ["Evaluate both sides of `10 - 3 = 8`. Is it true or false?", "True/false choice with both sides shown.", "False", "`10 - 3` equals 7, not 8."],
    ["Substitute 2 for `x`. Is `x + 6 = 8` true?", "Choice after substitution preview.", "True", "Replace `x` with 2."],
    ["Substitute 5 for n. Is 3n = 15 true?", "Choice after multiplication preview.", "True", "3 x 5 = 15."],
    ["Substitute 4 for x. Is 3x = 10 true?", "User enters 3x, then chooses true/false.", "12; False", "3 x 4 = 12."],
    ["Which value makes `a + 6 = 14` true: 7 or 8?", "Two choice buttons with substitution preview.", "8", "The left side must equal 14."],
    ["Which value makes 0.4x = 20 true: 15 or 50?", "Two choice buttons with substitution preview.", "50", "0.4 x 50 = 20."],
    ["Explain why 0.4 x 15 = 20 is false.", "Short response.", "The left side is 6, not 20.", "Evaluate the left side first."],
  ].map(([instruction, interaction, targetResponse, hint]) => ({
    instruction,
    interaction,
    targetResponse,
    hint,
    writerNotes: "",
    agentNotes: "",
  }));
  const steps = renumberSteps(kc, miniIndex, baseSteps as MiniStep[]);
  const miniId = createId("mini");
  const version: MiniVersion = {
    id: createId("version"),
    miniId,
    versionNumber: 1,
    source: "generate",
    summary: "Generated from the selected KC.",
    steps,
    createdAt,
  };
  return {
    id: miniId,
    kcId: kc.id,
    miniIndex,
    title: `${kc.title} mini ${miniIndex}`,
    currentVersionId: version.id,
    steps,
    versions: [version],
    createdAt,
    updatedAt: createdAt,
  };
}

export function reviseStepsFromPrompt(steps: MiniStep[], prompt: string) {
  const lower = prompt.toLowerCase();
  let summary = "Applied requested revision.";
  const revised = steps.map((step) => {
    if (lower.includes("shorter") || lower.includes("concise")) {
      summary = "Shortened learner-facing instructions.";
      return {
        ...step,
        instruction: step.instruction.replace(/^Look at /, "").replace(/^Evaluate both sides of /, "Evaluate "),
      };
    }
    if (lower.includes("hint")) {
      summary = "Strengthened hints.";
      return {
        ...step,
        hint: step.hint ? `${step.hint} Compare the value on the left with the value on the right.` : "Compare the value on the left with the value on the right.",
      };
    }
    return step;
  });
  return { steps: revised, summary, response: summary === "Applied requested revision." ? "Done. I made a light revision while preserving the math target." : "Done." };
}

export function applyAgentNotes(steps: MiniStep[]) {
  const responses: string[] = [];
  const nextSteps = steps.map((step) => {
    if (!step.writerNotes?.trim()) return step;
    const note = step.writerNotes.toLowerCase();
    responses.push(`${step.id}: Done`);
    const agentNotes = `${step.agentNotes ? `${step.agentNotes}\n` : ""}**Done:** ${step.writerNotes.trim()}`;
    if (note.includes("short")) {
      return { ...step, instruction: step.instruction.replace("Look at ", "").replace("Evaluate both sides of ", "Evaluate "), writerNotes: "", agentNotes };
    }
    if (note.includes("hint")) {
      return { ...step, hint: `${step.hint} Compare both sides before answering.`, writerNotes: "", agentNotes };
    }
    return { ...step, writerNotes: "", agentNotes };
  });
  return {
    steps: nextSteps,
    response: responses.length ? responses.join("\n") : "No agent notes to process.",
  };
}
