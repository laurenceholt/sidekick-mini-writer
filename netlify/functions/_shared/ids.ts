import type { KnowledgeComponent, MiniStep } from "./types";

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function makeStepId(kc: Pick<KnowledgeComponent, "grade" | "unit" | "lesson">, miniIndex: number, stepIndex: number) {
  return `${kc.grade}-${kc.unit}-${kc.lesson}-${miniIndex}-${stepIndex}`;
}

export function renumberSteps(
  kc: Pick<KnowledgeComponent, "grade" | "unit" | "lesson">,
  miniIndex: number,
  steps: MiniStep[],
) {
  return steps.map((step, index) => ({ ...step, id: makeStepId(kc, miniIndex, index + 1) }));
}
