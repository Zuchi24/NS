import { describe, expect, it } from "vitest";

import { apply } from "./apply";
import {
  AT_FRONT_TOLERANCE,
  CONTACT_LINE,
  FRONT_STOP,
  JACKET_STOP,
  MAX_UNTWIST,
  MIN_BODY,
  MIN_WORK,
  RELIEF_CLAMP,
  T568B,
} from "./constants";
import {
  hasContact,
  insertionBounds,
  jacketedLengthMm,
  makeEnd,
  nickActiveOn,
  rawEnd,
  tipInPlug,
  uniformTips,
} from "./geometry";
import { inspectEnd } from "./inspection";
import { wiremap } from "./wiremap";
import type { CableEnd, CableState, Plug, Scenario } from "./types";

/**
 * Every boundary in the frozen P0 table (§3.4), each pinned on both sides,
 * and record fixtures F24, F25 and F30–F34 at the model level.
 */

const SCENARIO: Scenario = {
  id: "boundaries",
  startLengthMm: 1000,
  plugs: 4,
  initialEnds: { A: rawEnd(0), B: rawEnd(0) },
  endpoints: [
    { id: "tester-main", kind: "tester-main" },
    { id: "tester-remote", kind: "tester-remote" },
  ],
};

const S2_GEOMETRY: Scenario = { ...SCENARIO, startLengthMm: 400, plugs: 3 };

const plug = (jacketInMm: number): Plug => ({ orientation: "contacts-up", jacketInMm, crimp: "full" });

/** A T568B end, J 30 unless said otherwise, with `exposedMm` conductor seated at `jacketIn`. */
function end(exposedMm: number, jacketInMm: number, J = 30, nicksAtMm: number[] = []): CableEnd {
  return makeEnd({ jacketEdgeMm: J, tipMm: J - exposedMm, fan: T568B, plug: plug(jacketInMm), nicksAtMm });
}

const GOOD_B = end(12, 9);

function cable(A: CableEnd, B: CableEnd = GOOD_B): CableState {
  return { ends: { A, B }, tray: { plugs: 4 }, connections: {} };
}

describe("the constants are the frozen defaults", () => {
  it("has not drifted", () => {
    expect({ FRONT_STOP, CONTACT_LINE, JACKET_STOP, RELIEF_CLAMP, MAX_UNTWIST, MIN_WORK, MIN_BODY, AT_FRONT_TOLERANCE }).toEqual({
      FRONT_STOP: 21,
      CONTACT_LINE: 19,
      JACKET_STOP: 10,
      RELIEF_CLAMP: 6,
      MAX_UNTWIST: 13,
      MIN_WORK: 20,
      MIN_BODY: 50,
      AT_FRONT_TOLERANCE: 1,
    });
  });
});

describe("defect activity", () => {
  const tipAt48 = makeEnd({ jacketEdgeMm: 60, tipMm: 48 });

  it("tip === toMm: inactive", () => {
    expect(nickActiveOn(tipAt48, 47, "orange")).toBe(false);
  });

  it("tip === fromMm: active", () => {
    expect(nickActiveOn(tipAt48, 48, "orange")).toBe(true);
  });

  it("F33/F33b: a nick one millimetre either side of the tip", () => {
    expect(inspectEnd(end(12, 9, 60, [47])).insulationIntact).toBe(true);
    expect(inspectEnd(end(12, 9, 60, [48])).insulationIntact).toBe(false);
  });
});

describe("contact line", () => {
  it("F30: tip === CONTACT_LINE makes contact, but is not at the front", () => {
    const A = end(9, 10);

    expect(tipInPlug(A, "brown")).toBe(CONTACT_LINE);
    expect(hasContact(A, "brown")).toBe(true);
    expect(wiremap(cable(A)).verdict).toBe("straight");
    expect(inspectEnd(A)).toEqual({
      jacketClamped: true,
      untwistOk: true,
      conductorsAtFront: false,
      insulationIntact: true,
    });
  });

  it("one millimetre short is an open", () => {
    const A = end(8, 10);

    expect(tipInPlug(A, "brown")).toBe(CONTACT_LINE - 1);
    expect(wiremap(cable(A)).verdict).toBe("open");
  });
});

describe("front face", () => {
  it("tip === FRONT_STOP is the most a tip can be — and it is at the front", () => {
    const A = end(12, 9);

    expect(tipInPlug(A, "brown")).toBe(FRONT_STOP);
    expect(insertionBounds(A).hi).toBe(9);
    expect(inspectEnd(A).conductorsAtFront).toBe(true);
  });

  it("tip === FRONT_STOP − AT_FRONT_TOLERANCE is still at the front", () => {
    const A = end(10, 10);

    expect(tipInPlug(A, "brown")).toBe(20);
    expect(inspectEnd(A).conductorsAtFront).toBe(true);
  });

  it("a push past the front face is clamped to hi", () => {
    const bare = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B });
    const result = apply(
      { ends: { A: bare, B: rawEnd(0) }, tray: { plugs: 1 }, connections: {} },
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
      SCENARIO,
    );

    expect("state" in result && result.state.ends.A.plug?.jacketInMm).toBe(9);
  });
});

describe("strain relief", () => {
  it("F32: jacketIn === RELIEF_CLAMP is clamped", () => {
    const A = end(13, 6);

    expect(inspectEnd(A).jacketClamped).toBe(true);
    expect(tipInPlug(A, "brown")).toBe(19);
    expect(inspectEnd(A).conductorsAtFront).toBe(false);
    expect(wiremap(cable(A)).verdict).toBe("straight");
  });

  it("F32b: one millimetre less is not — and 14 mm exposed is over-untwisted", () => {
    const A = end(14, 5);

    expect(inspectEnd(A)).toEqual({
      jacketClamped: false,
      untwistOk: false,
      conductorsAtFront: false,
      insulationIntact: true,
    });
    expect(wiremap(cable(A)).verdict).toBe("straight");
  });
});

describe("jacket stop", () => {
  it("jacketIn === JACKET_STOP is allowed when the conductors are short enough", () => {
    expect(insertionBounds(makeEnd({ jacketEdgeMm: 30, tipMm: 19, fan: T568B })).hi).toBe(JACKET_STOP);
    expect(insertionBounds(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B })).hi).toBe(JACKET_STOP - 1);
  });
});

describe("untwist limit", () => {
  it("F31: X === MAX_UNTWIST passes", () => {
    expect(inspectEnd(end(13, 8)).untwistOk).toBe(true);
    expect(inspectEnd(end(13, 8))).toEqual({
      jacketClamped: true,
      untwistOk: true,
      conductorsAtFront: true,
      insulationIntact: true,
    });
  });

  it("F31b: fourteen fails", () => {
    expect(inspectEnd(end(14, 7))).toEqual({
      jacketClamped: true,
      untwistOk: false,
      conductorsAtFront: true,
      insulationIntact: true,
    });
  });
});

describe("minimum work", () => {
  it("pair minX === MIN_WORK can be untwisted; one less cannot", () => {
    const at = { ends: { A: makeEnd({ jacketEdgeMm: MIN_WORK, tipMm: 0 }), B: rawEnd(0) }, tray: { plugs: 4 }, connections: {} };
    const under = { ...at, ends: { ...at.ends, A: makeEnd({ jacketEdgeMm: MIN_WORK - 1, tipMm: 0 }) } };

    expect("state" in apply(at, { type: "untwist", end: "A", pair: "blue" }, SCENARIO)).toBe(true);
    expect(apply(under, { type: "untwist", end: "A", pair: "blue" }, SCENARIO)).toEqual({ rejected: "too-short-to-grip" });
  });
});

describe("cut at the jacket edge", () => {
  it("P === J is a cut when it removes something, and nothing-to-cut when it does not", () => {
    const withConductor = { ends: { A: makeEnd({ jacketEdgeMm: 30, tipMm: 29 }), B: rawEnd(0) }, tray: { plugs: 4 }, connections: {} };
    const bare = { ends: { A: rawEnd(30), B: rawEnd(0) }, tray: { plugs: 4 }, connections: {} };

    expect("state" in apply(withConductor, { type: "cut", end: "A", atMm: 30 }, SCENARIO)).toBe(true);
    expect(apply(bare, { type: "cut", end: "A", atMm: 30 }, SCENARIO)).toEqual({ rejected: "nothing-to-cut" });
  });

  it("P === R is allowed; one less is through the plug", () => {
    const crimped = { ends: { A: end(12, 9), B: rawEnd(0) }, tray: { plugs: 4 }, connections: {} };

    expect("state" in apply(crimped, { type: "cut", end: "A", atMm: 39 }, SCENARIO)).toBe(true);
    expect(apply(crimped, { type: "cut", end: "A", atMm: 38 }, SCENARIO)).toEqual({ rejected: "cut-through-plug" });
  });
});

describe("minimum body", () => {
  it("J_A + J_B === L0 − MIN_BODY is allowed; one more is not", () => {
    const state = { ends: { A: rawEnd(0), B: rawEnd(1000 - MIN_BODY - 40) }, tray: { plugs: 4 }, connections: {} };

    expect("state" in apply(state, { type: "strip", end: "A", amountMm: 40, slot: "correct" }, SCENARIO)).toBe(true);
    expect(apply(state, { type: "strip", end: "A", amountMm: 41, slot: "correct" }, SCENARIO)).toEqual({
      rejected: "insufficient-cable",
    });
  });
});

describe("graded length", () => {
  it("F34: 80 + 30 on 400 leaves exactly the 290 minimum", () => {
    expect(jacketedLengthMm(cable(end(12, 9, 80)), S2_GEOMETRY)).toBe(290);
  });

  it("F24: one S2 repair leaves 301", () => {
    const A = makeEnd({ jacketEdgeMm: 69, tipMm: uniformTips(57), fan: T568B, plug: plug(9) });

    expect(jacketedLengthMm(cable(A), S2_GEOMETRY)).toBe(301);
    expect(wiremap(cable(A)).verdict).toBe("straight");
  });

  it("F25: two S2 repairs leave 262", () => {
    const A = makeEnd({ jacketEdgeMm: 108, tipMm: uniformTips(96), fan: T568B, plug: plug(9) });

    expect(jacketedLengthMm(cable(A), S2_GEOMETRY)).toBe(262);
    expect(wiremap(cable(A)).verdict).toBe("straight");
  });
});
