import { describe, expect, it } from "vitest";
import { seedMini } from "./seed";
import { addVersion, revertMini } from "./versions";

describe("versions", () => {
  it("creates immutable snapshots", () => {
    const mini = addVersion(seedMini, [{ ...seedMini.steps[0], instruction: "Changed" }], "agent", "Changed one step.");
    expect(mini.versions).toHaveLength(2);
    expect(mini.versions[0].steps[0].instruction).not.toBe("Changed");
    expect(mini.steps[0].instruction).toBe("Changed");
  });

  it("reverts by creating a new version", () => {
    const changed = addVersion(seedMini, [{ ...seedMini.steps[0], instruction: "Changed" }], "agent", "Changed one step.");
    const reverted = revertMini(changed, seedMini.versions[0].id);
    expect(reverted.versions).toHaveLength(3);
    expect(reverted.steps[0].instruction).toBe(seedMini.steps[0].instruction);
    expect(reverted.versions.at(-1)?.source).toBe("revert");
  });
});
