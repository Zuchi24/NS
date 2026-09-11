import { describe, expect, it } from "vitest";

import { T568B } from "./constants";
import { makeEnd } from "./geometry";
import { inspect, inspectEnd } from "./inspection";
import type { CableEnd, Crimp } from "./types";

/**
 * Inspection — what the magnifier shows and a continuity test cannot.
 * Record fixtures F15–F17, F21 and F23 at the inspection level.
 */

/** A plugged end with `exposed` mm of conductor, seated at `jacketIn`. */
function plugged(exposedMm: number, jacketInMm: number, extra: { nicksAtMm?: number[]; J?: number; crimp?: Crimp } = {}): CableEnd {
  const J = extra.J ?? 30;

  return makeEnd({
    jacketEdgeMm: J,
    tipMm: J - exposedMm,
    fan: T568B,
    plug: { orientation: "contacts-up", jacketInMm, crimp: extra.crimp ?? "full" },
    nicksAtMm: extra.nicksAtMm,
  });
}

const GOOD = { jacketClamped: true, untwistOk: true, conductorsAtFront: true, insulationIntact: true };

describe("inspectEnd", () => {
  it("passes a textbook termination", () => {
    expect(inspectEnd(plugged(12, 9))).toEqual(GOOD);
  });

  it("fails every check on an end with no plug", () => {
    expect(inspectEnd(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }))).toEqual({
      jacketClamped: false,
      untwistOk: false,
      conductorsAtFront: false,
      insulationIntact: false,
    });
  });

  it("F15: 17 mm exposed seats the jacket at 4 — unclamped and over-untwisted", () => {
    expect(inspectEnd(plugged(17, 4))).toEqual({ ...GOOD, jacketClamped: false, untwistOk: false });
  });

  it("F16: 24 mm exposed leaves the jacket outside the plug", () => {
    expect(inspectEnd(plugged(24, -3))).toEqual({ ...GOOD, jacketClamped: false, untwistOk: false });
  });

  it("F17: a plug not pushed home is unclamped and short of the front", () => {
    expect(inspectEnd(plugged(12, 5))).toEqual({ ...GOOD, jacketClamped: false, conductorsAtFront: false });
  });

  it("F21: a nick at the jacket edge is damaged insulation in the termination", () => {
    expect(inspectEnd(plugged(12, 9, { nicksAtMm: [30] }))).toEqual({ ...GOOD, insulationIntact: false });
  });

  it("F23: a nick trimmed away no longer counts, even if still listed", () => {
    // J 60, tips 48: the nick at 30 lies wholly outward of every tip.
    expect(inspectEnd(plugged(12, 9, { J: 60, nicksAtMm: [30] }))).toEqual(GOOD);
  });

  it("does not care about the crimp — that is a requirement, not an inspection", () => {
    expect(inspectEnd(plugged(12, 9, { crimp: "none" }))).toEqual(GOOD);
  });
});

describe("inspect", () => {
  it("inspects both ends", () => {
    const result = inspect({
      ends: { A: plugged(12, 9), B: makeEnd({ jacketEdgeMm: 0 }) },
      tray: { plugs: 0 },
      connections: {},
    });

    expect(result.A).toEqual(GOOD);
    expect(result.B.jacketClamped).toBe(false);
  });
});
