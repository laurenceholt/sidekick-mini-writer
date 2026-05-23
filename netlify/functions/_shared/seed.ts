import { makeStepId } from "./ids";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

const now = "2026-05-23T00:00:00.000Z";

export const seedKc: KnowledgeComponent = {
  id: "kc_truth_equation",
  title: "Interpret Truth of Equation",
  slug: "interpret_true_false_equation",
  grade: 6,
  unit: 6,
  lesson: 1,
  condition: "Given an equation with numerical expressions on both sides.",
  response: "Determine whether the two sides are equal (true) or not equal (false).",
  workedExampleMd:
    "To decide whether $0.4x = 20$ is true when $x = 15$, substitute 15 for $x$.\n\n$0.4 \\times 15 = 6$, and $6 \\ne 20$, so the equation is **false**.",
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
  ["Look at $3 + 4 = 7$. Is this equation true or false?", "Two expression cards: $3 + 4$ and $7$. User chooses True or False.", "True", "Evaluate the left side. $3 + 4$ equals 7.", ""],
  ["Look at $9 - 2 = 8$. Is this equation true or false?", "Two expression cards: $9 - 2$ and $8$. User chooses True or False.", "False", "$9 - 2$ equals 7, not 8.", ""],
  ["An equation is true when both sides have the same value. Is $6 \\times 3 = 18$ true or false?", "User chooses True or False.", "True", "Find the value of the left side first.", ""],
  ["Is $0.4 \\times 15 = 20$ true or false?", "User chooses True or False.", "False", "$0.4 \\times 15 = 6$. Does 6 equal 20?", "Keep this close to the attached worked example."],
  ["Substitute $\\frac{3}{8}$ for $y$. Is $y + \\frac{1}{2} = \\frac{7}{8}$ true or false?", "Show substitution; user chooses True or False.", "True", "$\\frac{1}{2}$ is the same as $\\frac{4}{8}$.", ""],
  ["Substitute 5 for $n$. Is $2n + 1 = 11$ true or false?", "User enters value, then chooses True or False.", "11; True", "Replace $n$ with 5.", ""],
  ["Substitute 4 for $x$. Is $3x = 10$ true or false?", "User enters value, then chooses True or False.", "12; False", "$3 \\times 4 = 12$.", ""],
  ["Which value makes $a + 6 = 14$ true: 7 or 8?", "Two choice buttons: 7 and 8.", "8", "The value must make the left side equal 14.", ""],
  ["Which value makes $0.4x = 20$ true: 15 or 50?", "Two choice buttons: 15 and 50.", "50", "$0.4 \\times 50 = 20$.", ""],
  ["Explain why $0.4 \\times 15 = 20$ is false in one sentence.", "Short text response.", "Because $0.4 \\times 15 = 6$, and $6 \\ne 20$.", "Start by evaluating the left side.", "This is the final reflection; keep it short."],
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
  id: "version_truth_equation_1",
  miniId: "mini_truth_equation_1",
  versionNumber: 1,
  source: "seed",
  summary: "Initial seed mini from attached truth-of-equation materials.",
  steps: rawSteps,
  createdAt: now,
};

export const seedMini: Mini = {
  id: "mini_truth_equation_1",
  kcId: seedKc.id,
  miniIndex: 1,
  title: "Truth of equations",
  currentVersionId: seedVersion.id,
  steps: rawSteps,
  versions: [seedVersion],
  createdAt: now,
  updatedAt: now,
};
