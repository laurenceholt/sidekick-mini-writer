import type { Standard } from "./types";

export const standards: Standard[] = [
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
  {
    code: "6.EE.B.7",
    label: "Solve one-step equations",
    description: "Solve real-world and mathematical problems by writing and solving equations.",
  },
  {
    code: "7.EE.B.4",
    label: "Solve equations from problems",
    description: "Use variables to represent quantities and construct equations to solve problems.",
  },
];

export function standardsForTitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("equation") || lower.includes("solution") || lower.includes("true")) {
    return standards.filter((standard) => standard.code.startsWith("6.EE"));
  }
  return standards.slice(0, 3);
}
