import { renumberSteps, slugify } from "./ids";
import { standardsForTitle } from "./standards";
import type { KnowledgeComponent, MiniStep } from "./types";

export function fallbackKc(title: string) {
  return {
    title,
    slug: slugify(title),
    grade: 6,
    unit: 6,
    lesson: 1,
    condition: "Given an equation with numerical expressions or variables on both sides.",
    response: "Determine whether the equation is true or false after evaluating or substituting.",
    worked_example_md:
      "Substitute the given value and compare both sides.\n\nFor 0.4x = 20 when x = 15: 0.4 x 15 = 6, and 6 is not equal to 20, so the equation is false.",
    standards: standardsForTitle(title),
    notes_md: "",
  };
}

export function fallbackSteps(kc: KnowledgeComponent, miniIndex: number): MiniStep[] {
  const steps = [
    ["Evaluate `4 + 5 = 9`. Is it true or false?", "True/false choice with both sides shown.", "True", "`4 + 5` equals 9."],
    ["Evaluate `10 - 3 = 8`. Is it true or false?", "True/false choice with both sides shown.", "False", "`10 - 3` equals 7."],
    ["Substitute 2 for `x`. Is `x + 6 = 8` true?", "Choice after substitution preview.", "True", "Replace `x` with 2."],
    ["Substitute 5 for n. Is 3n = 15 true?", "Choice after multiplication preview.", "True", "3 x 5 = 15."],
    ["Substitute 4 for x. Is 3x = 10 true?", "User enters 3x, then chooses true/false.", "12; False", "3 x 4 = 12."],
    ["Which value makes `a + 6 = 14` true: 7 or 8?", "Two choice buttons with substitution preview.", "8", "The left side must equal 14."],
    ["Which value makes 0.4x = 20 true: 15 or 50?", "Two choice buttons with substitution preview.", "50", "0.4 x 50 = 20."],
    ["Explain why 0.4 x 15 = 20 is false.", "Short response.", "The left side is 6, not 20.", "Evaluate the left side first."],
  ].map(([instruction, interaction, targetResponse, hint]) => ({ id: "", instruction, interaction, targetResponse, hint, writerNotes: "", agentNotes: "" }));
  return renumberSteps(kc, miniIndex, steps);
}

export function fallbackRevision(steps: MiniStep[], prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("hint")) {
    return {
      steps: steps.map((step) => ({ ...step, hint: `${step.hint} Compare both sides before answering.` })),
      response: "Done.",
      summary: "Strengthened hints.",
    };
  }
  return {
    steps: steps.map((step) => ({ ...step, instruction: step.instruction.replace("Look at ", "").replace("Evaluate both sides of ", "Evaluate ") })),
    response: "Done. I tightened the learner-facing wording.",
    summary: "Tightened instructions.",
  };
}
