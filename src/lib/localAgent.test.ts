import { describe, expect, it } from "vitest";
import { applyAgentNotes } from "./localAgent";
import { seedSteps } from "./seed";

describe("agent note processing", () => {
  it("applies notes and clears them", () => {
    const result = applyAgentNotes([
      { ...seedSteps[0], agentNotes: "make shorter" },
      { ...seedSteps[1], agentNotes: "improve hint" },
    ]);
    expect(result.steps[0].agentNotes).toBe("");
    expect(result.steps[1].hint).toContain("Compare both sides");
    expect(result.response).toContain(seedSteps[0].id);
  });
});
