import type { KnowledgeComponent, MiniStep } from "./types";

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function makeStepId(kc: Pick<KnowledgeComponent, "grade" | "topic" | "kcNumber">, miniIndex: number, stepIndex: number) {
  return `${kc.grade}-${kc.topic}-${kc.kcNumber}-${miniIndex}-${stepIndex}`;
}

export function renumberSteps(
  kc: Pick<KnowledgeComponent, "grade" | "topic" | "kcNumber">,
  miniIndex: number,
  steps: MiniStep[],
) {
  return steps.map((step, index) => ({
    ...step,
    id: makeStepId(kc, miniIndex, index + 1),
  }));
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
