import { describe, expect, it } from "vitest";

import { DIFFICULTY_META, DIFFICULTY_ORDER } from "./difficulty";

/**
 * The band blurbs on the challenge page.
 *
 * Each one sits over a list the API decides, so it has to describe what is
 * actually in that band. The cable ladder puts cable work in every band — the
 * physical bench's straight-through, crossover, repair and link challenges —
 * so no band's blurb may read as topology alone.
 */
describe("difficulty band blurbs", () => {
  it("names every band, in order, with a blurb", () => {
    expect(DIFFICULTY_ORDER).toEqual(["beginner", "intermediate", "advanced"]);
    for (const band of DIFFICULTY_ORDER) expect(DIFFICULTY_META[band].blurb.trim()).not.toBe("");
  });

  it.each(DIFFICULTY_ORDER)("mentions the cable work in the %s band", (band) => {
    expect(DIFFICULTY_META[band].blurb).toMatch(/cable/i);
  });
});
