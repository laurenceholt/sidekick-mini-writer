import { makeStepId } from "./ids";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

const now = "2026-05-23T00:00:00.000Z";

export const seedKc: KnowledgeComponent = {
  id: "11111111-1111-4111-8111-111111111111",
  writerName: "Laurence",
  title: "Interpret Truth of Equation",
  slug: "interpret_true_false_equation",
  grade: 6,
  topic: 6,
  kcNumber: 1,
  condition: "Given an equation with numerical expressions on both sides.",
  response: "Determine whether the two sides are equal (true) or not equal (false).",
  workedExampleMd:
    "To decide whether 0.4x = 20 is true when x = 15, substitute 15 for x.\n\n0.4 x 15 = 6, and 6 is not equal to 20, so the equation is false.",
  standards: [
    {
      code: "6.EE.A.2c",
      label: "Evaluate expressions at values",
      description: "Evaluate expressions at specific values of their variables.",
    },
    {
      code: "6.EE.B.5",
      label: "Understand solving equations",
      description: "Understand solving an equation as answering which values make the equation true.",
    },
    {
      code: "6.EE.B.6",
      label: "Use variables",
      description: "Use variables to represent numbers and write expressions when solving problems.",
    },
  ],
  notesMd: "Seeded from the attached truth-of-equation KC and student task statement.",
  createdAt: now,
  updatedAt: now,
};

const rawStepRows: [string, string, string, string, string][] = [
  ["Is this equation true or false?", "Two expression cards: 3 + 4 and 7. User chooses True or False.", "True", "Evaluate the left side, then compare it to the right side.", ""],
  ["Is this equation true or false?", "Two expression cards: 9 - 2 and 8. User chooses True or False.", "False", "Evaluate the left side, then compare it to the right side.", ""],
  ["Both sides need the same value. Is this equation true or false?", "Show 6 x 3 on the left and 18 on the right. User chooses True or False.", "True", "Find the value of the left side first.", ""],
  ["Is this equation true or false?", "Show 0.4 x 15 = 20. User chooses True or False.", "False", "Evaluate the left side, then compare it to 20.", "Keep this close to the attached worked example."],
  ["Substitute 3/8 for y. Is this equation true or false?", "Show substitution; user chooses True or False.", "True", "Rewrite the fractions with the same denominator before comparing.", ""],
  ["Substitute 5 for n. Is 2n + 1 = 11 true or false?", "User enters value, then chooses True or False.", "11; True", "Replace n with 5.", ""],
  ["Substitute 4 for x. Is this equation true or false?", "User enters value, then chooses True or False.", "12; False", "Replace x with 4, then compare your result with 10.", ""],
  ["Which value makes a + 6 = 14 true: 7 or 8?", "Two choice buttons: 7 and 8.", "8", "The value must make the left side equal 14.", ""],
  ["Which value makes 0.4x = 20 true: 15 or 50?", "Two choice buttons: 15 and 50.", "50", "Try each value in the equation and see which one makes both sides match.", ""],
  ["Explain why 0.4 x 15 = 20 is false in one sentence.", "Short text response.", "Because 0.4 x 15 = 6, and 6 is not equal to 20.", "Start by evaluating the left side.", "This is the final reflection; keep it short."],
];

const rawSteps: MiniStep[] = rawStepRows.map(([instruction, interaction, targetResponse, hint, agentNotes], index) => ({
  id: makeStepId(seedKc, 1, index + 1),
  instruction,
  interaction,
  targetResponse,
  hint,
  agentNotes,
}));

const seedVersion: MiniVersion = {
  id: "33333333-3333-4333-8333-333333333333",
  miniId: "22222222-2222-4222-8222-222222222222",
  versionNumber: 1,
  source: "seed",
  summary: "Initial seed mini from attached truth-of-equation materials.",
  steps: rawSteps,
  createdAt: now,
};

export const seedMini: Mini = {
  id: "22222222-2222-4222-8222-222222222222",
  kcId: seedKc.id,
  miniIndex: 1,
  title: "Truth of equations",
  status: "writing",
  currentVersionId: seedVersion.id,
  steps: rawSteps,
  versions: [seedVersion],
  createdAt: now,
  updatedAt: now,
};
