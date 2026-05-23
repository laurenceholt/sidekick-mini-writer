import type { Standard } from "./types";

export const CCSS_MATH_3_8: Standard[] = [
  {
    code: "3.OA.D.8",
    label: "Solve two-step word problems",
    description: "Solve two-step word problems using the four operations and assess reasonableness of answers.",
  },
  {
    code: "4.OA.A.3",
    label: "Multi-step problem solving",
    description: "Solve multistep word problems with whole numbers and interpret remainders.",
  },
  {
    code: "5.OA.A.1",
    label: "Use parentheses and brackets",
    description: "Use parentheses, brackets, or braces in numerical expressions and evaluate expressions with these symbols.",
  },
  {
    code: "5.OA.A.2",
    label: "Write and interpret expressions",
    description: "Write simple expressions and interpret numerical expressions without evaluating them.",
  },
  {
    code: "6.EE.A.2",
    label: "Write and evaluate expressions",
    description: "Write, read, and evaluate expressions in which letters stand for numbers.",
  },
  {
    code: "6.EE.A.2c",
    label: "Evaluate expressions at values",
    description: "Evaluate expressions at specific values of their variables and include formulas from real-world problems.",
  },
  {
    code: "6.EE.B.5",
    label: "Understand solving equations",
    description: "Understand solving an equation or inequality as answering which values make it true.",
  },
  {
    code: "6.EE.B.6",
    label: "Use variables",
    description: "Use variables to represent numbers and write expressions when solving a real-world or mathematical problem.",
  },
  {
    code: "6.EE.B.7",
    label: "Solve one-step equations",
    description: "Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q.",
  },
  {
    code: "7.EE.B.4",
    label: "Solve equations from problems",
    description: "Use variables to represent quantities in a problem and construct equations and inequalities to solve problems.",
  },
  {
    code: "8.EE.C.7",
    label: "Solve linear equations",
    description: "Solve linear equations in one variable.",
  },
];

export function standardsForTitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("equation") || lower.includes("solution") || lower.includes("true")) {
    return CCSS_MATH_3_8.filter((standard) =>
      ["6.EE.A.2c", "6.EE.B.5", "6.EE.B.6", "6.EE.B.7"].includes(standard.code),
    );
  }
  return CCSS_MATH_3_8.slice(0, 3);
}
