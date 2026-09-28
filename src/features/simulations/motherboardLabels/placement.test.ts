import { describe, expect, it } from "vitest";

import { clearSlot, placeChip, slotOf, unplaced } from "./placement";

/**
 * Moving name chips about a drag board: each chip in one place at a time, and
 * nothing lost when one lands on another.
 */

describe("placing a name chip", () => {
  it("puts a chip from the names on an empty slot", () => {
    expect(placeChip({}, "CPU socket", "m3")).toEqual({ m3: "CPU socket" });
  });

  it("moves a chip from one slot to another, leaving the first empty", () => {
    expect(placeChip({ m3: "CPU socket" }, "CPU socket", "m1")).toEqual({ m1: "CPU socket" });
  });

  it("swaps two chips when one is moved onto the other", () => {
    expect(placeChip({ m3: "RAM slots", m1: "CPU socket" }, "CPU socket", "m3")).toEqual({
      m3: "CPU socket",
      m1: "RAM slots",
    });
  });

  it("sends the chip it covers back to the names when the new one came from them", () => {
    const next = placeChip({ m3: "RAM slots" }, "CPU socket", "m3");

    expect(next).toEqual({ m3: "CPU socket" });
    expect(unplaced(["CPU socket", "RAM slots", "Chipset"], next)).toEqual(["RAM slots", "Chipset"]);
  });

  it("changes nothing when a chip is put back where it was", () => {
    const placement = { m3: "CPU socket" };

    expect(placeChip(placement, "CPU socket", "m3")).toBe(placement);
  });

  it("never leaves a chip on two slots", () => {
    let placement = {};

    for (const [chip, to] of [["A", "m1"], ["B", "m2"], ["A", "m2"], ["C", "m1"], ["B", "m3"], ["C", "m3"]] as const) {
      placement = placeChip(placement, chip, to);

      const chips = Object.values(placement);
      expect(new Set(chips).size, JSON.stringify(placement)).toBe(chips.length);
    }
  });
});

describe("taking a chip off", () => {
  it("empties the slot and returns the chip to the names", () => {
    const next = clearSlot({ m3: "CPU socket", m1: "RAM slots" }, "m3");

    expect(next).toEqual({ m1: "RAM slots" });
    expect(unplaced(["CPU socket", "RAM slots"], next)).toEqual(["CPU socket"]);
  });

  it("changes nothing on an empty slot", () => {
    const placement = { m1: "RAM slots" };

    expect(clearSlot(placement, "m3")).toBe(placement);
  });

  it("knows where a chip is, or that it is on none", () => {
    expect(slotOf({ m3: "CPU socket" }, "CPU socket")).toBe("m3");
    expect(slotOf({ m3: "CPU socket" }, "RAM slots")).toBeNull();
  });
});
