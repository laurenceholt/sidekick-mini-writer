import { describe, expect, it } from "vitest";
import { applyAgentNotes } from "./localAgent";
import { seedSteps } from "./seed";

describe("agent note processing", () => {
  it("applies writer notes, clears them, and marks agent notes done", () => {
    const result = applyAgentNotes([
      { ...seedSteps[0], writerNotes: "make shorter" },
      { ...seedSteps[1], writerNotes: "improve hint" },
    ]);
    expect(result.steps[0].writerNotes).toBe("");
    expect(result.steps[0].agentNotes).toContain("**Done:**");
    expect(result.steps[1].hint).toContain("Compare both sides");
    expect(result.response).toContain(seedSteps[0].id);
  });
});
