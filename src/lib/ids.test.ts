import { describe, expect, it } from "vitest";
import { makeStepId, renumberSteps, slugify } from "./ids";

describe("step ids", () => {
  it("formats Grade-Unit-Lesson-Mini-Step ids", () => {
    expect(makeStepId({ grade: 6, topic: 6, kcNumber: 1 }, 1, 1)).toBe("6-6-1-1-1");
  });

  it("renumbers steps after structural edits", () => {
    const steps = renumberSteps({ grade: 6, topic: 8, kcNumber: 9 }, 1, [
      { id: "old", instruction: "", interaction: "", targetResponse: "", hint: "", agentNotes: "" },
      { id: "old2", instruction: "", interaction: "", targetResponse: "", hint: "", agentNotes: "" },
    ]);
    expect(steps.map((step) => step.id)).toEqual(["6-8-9-1-1", "6-8-9-1-2"]);
  });
});

describe("slugify", () => {
  it("normalizes KC titles", () => {
    expect(slugify("Find the Median of a Set of Values.")).toBe("find_the_median_of_a_set_of_values");
  });
});
