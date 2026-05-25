import { makeStepId } from "./ids";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion, WorkspaceData } from "./types";

const now = "2026-05-23T00:00:00.000Z";

export const seedKc: KnowledgeComponent = {
  id: "11111111-1111-4111-8111-111111111111",
  writerName: "Laurence",
  title: "Interpret Truth of Equation",
  slug: "interpret_true_false_equation",
  grade: 6,
  unit: 6,
  lesson: 1,
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

const rawSteps: Omit<MiniStep, "id">[] = [
  {
    instruction: "Is this equation true or false?",
    interaction: "Two expression cards: 3 + 4 and 7. User chooses True or False.",
    targetResponse: "True",
    hint: "Evaluate the left side, then compare it to the right side.",
    agentNotes: "",
  },
  {
    instruction: "Is this equation true or false?",
    interaction: "Two expression cards: 9 - 2 and 8. User chooses True or False.",
    targetResponse: "False",
    hint: "Evaluate the left side, then compare it to the right side.",
    agentNotes: "",
  },
  {
    instruction: "Both sides need the same value. Is this equation true or false?",
    interaction: "User chooses True or False. Show 6 x 3 on the left and 18 on the right.",
    targetResponse: "True",
    hint: "Find the value of the left side first.",
    agentNotes: "",
  },
  {
    instruction: "Is this equation true or false?",
    interaction: "Show 0.4 x 15 = 20. User chooses True or False. Include a small calculator-style evaluation area for the left side.",
    targetResponse: "False",
    hint: "Evaluate the left side, then compare it to 20.",
    agentNotes: "Keep this close to the attached worked example.",
  },
  {
    instruction: "Substitute 3/8 for y. Is this equation true or false?",
    interaction: "Show substitution: blank + 1/2 = 7/8; user chooses True or False.",
    targetResponse: "True",
    hint: "Rewrite the fractions with the same denominator before comparing.",
    agentNotes: "",
  },
  {
    instruction: "Substitute 5 for n. Is 2n + 1 = 11 true or false?",
    interaction: "User enters the value of `2n + 1`, then chooses True or False.",
    targetResponse: "11; True",
    hint: "Replace n with 5, then compute 2 x 5 + 1.",
    agentNotes: "",
  },
  {
    instruction: "Substitute 4 for x. Is this equation true or false?",
    interaction: "User enters the value of `3x`, then chooses True or False.",
    targetResponse: "12; False",
    hint: "Replace x with 4, then compare your result with 10.",
    agentNotes: "",
  },
  {
    instruction: "Which value makes a + 6 = 14 true: 7 or 8?",
    interaction: "Two choice buttons: 7 and 8. Show equation after selection.",
    targetResponse: "8",
    hint: "The value must make the left side equal 14.",
    agentNotes: "",
  },
  {
    instruction: "Which value makes 0.4x = 20 true: 15 or 50?",
    interaction: "Two choice buttons: 15 and 50. User can preview each substitution.",
    targetResponse: "50",
    hint: "Try each value in the equation and see which one makes both sides match.",
    agentNotes: "",
  },
  {
    instruction: "Explain why 0.4 x 15 = 20 is false in one sentence.",
    interaction: "Short text response. Target should mention that the left side equals 6, not 20.",
    targetResponse: "Because 0.4 x 15 = 6, and 6 is not equal to 20.",
    hint: "Start by evaluating the left side.",
    agentNotes: "This is the final reflection; keep it short.",
  },
];

export const seedSteps = rawSteps.map((step, index) => ({
  ...step,
  id: makeStepId(seedKc, 1, index + 1),
}));

const seedVersion: MiniVersion = {
  id: "33333333-3333-4333-8333-333333333333",
  miniId: "22222222-2222-4222-8222-222222222222",
  versionNumber: 1,
  source: "seed",
  summary: "Initial seed mini from attached truth-of-equation materials.",
  steps: seedSteps,
  createdAt: now,
};

export const seedMini: Mini = {
  id: "22222222-2222-4222-8222-222222222222",
  kcId: seedKc.id,
  miniIndex: 1,
  title: "Truth of equations",
  status: "writing",
  currentVersionId: seedVersion.id,
  steps: seedSteps,
  versions: [seedVersion],
  createdAt: now,
  updatedAt: now,
};

export const seedWorkspace: WorkspaceData = {
  kcs: [seedKc],
  minis: [seedMini],
};
