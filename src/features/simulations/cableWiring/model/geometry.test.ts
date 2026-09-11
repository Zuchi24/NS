import { describe, expect, it } from "vitest";

import { NATURAL_ORDER, T568B } from "./constants";
import {
  clamp,
  exposed,
  hasContact,
  insertionBounds,
  invariantViolations,
  jacketedLengthMm,
  makeEnd,
  maxExposed,
  minExposed,
  nickActive,
  nickActiveOn,
  normalizeNicks,
  otherEnd,
  plugFrontMm,
  plugRearMm,
  rawEnd,
  reachesContact,
  terminated,
  tipInPlug,
  uniformTips,
} from "./geometry";
import type { CableEnd, CableState, Plug, Scenario } from "./types";

/**
 * The frozen coordinate formulas (P0 §3.2) and the invariants (§2.3).
 */

const SCENARIO: Scenario = {
  id: "geometry",
  startLengthMm: 1000,
  plugs: 4,
  initialEnds: { A: rawEnd(0), B: rawEnd(0) },
  endpoints: [
    { id: "tester-main", kind: "tester-main" },
    { id: "tester-remote", kind: "tester-remote" },
  ],
};

const plug = (jacketInMm: number, crimp: Plug["crimp"] = "full"): Plug => ({
  orientation: "contacts-up",
  jacketInMm,
  crimp,
});

function state(A: CableEnd, B: CableEnd = rawEnd(0), extra: Partial<CableState> = {}): CableState {
  return { ends: { A, B }, tray: { plugs: 0 }, connections: {}, ...extra };
}

describe("exposed conductor", () => {
  it("is the distance from each tip to the jacket edge", () => {
    const end = makeEnd({ jacketEdgeMm: 30, tipMm: { ...uniformTips(18), brown: 21 } });

    expect(exposed(end, "white-orange")).toBe(12);
    expect(exposed(end, "brown")).toBe(9);
    expect(maxExposed(end)).toBe(12);
    expect(minExposed(end)).toBe(9);
  });

  it("is zero everywhere on a raw end", () => {
    expect(NATURAL_ORDER.map((c) => exposed(rawEnd(40), c))).toEqual(Array(8).fill(0));
  });
});

describe("the plug in the end frame", () => {
  it("puts the rear opening at J + jacketIn and the front face FRONT_STOP outward of it", () => {
    const end = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: plug(9) });

    expect(plugRearMm(end)).toBe(39);
    expect(plugFrontMm(end)).toBe(18);
  });

  it("puts the rear opening outward of the jacket edge when the jacket is outside", () => {
    const end = makeEnd({ jacketEdgeMm: 30, tipMm: 6, fan: T568B, plug: plug(-3) });

    expect(plugRearMm(end)).toBe(27);
    expect(plugFrontMm(end)).toBe(6);
  });

  it("keeps the front face at or outward of every tip", () => {
    for (const exposedMm of [1, 9, 12, 13, 17, 24, 40]) {
      const bare = makeEnd({ jacketEdgeMm: 60, tipMm: 60 - exposedMm, fan: T568B });
      const { lo, hi } = insertionBounds(bare);

      for (const jacketIn of [lo, hi]) {
        const end = { ...bare, plug: plug(jacketIn) };

        expect(plugFrontMm(end)!).toBeLessThanOrEqual(Math.min(...NATURAL_ORDER.map((c) => end.tipMm[c])));
      }
    }
  });

  it("has no plug geometry without a plug", () => {
    expect(plugRearMm(rawEnd(10))).toBeNull();
    expect(plugFrontMm(rawEnd(10))).toBeNull();
    expect(tipInPlug(rawEnd(10), "brown")).toBeNull();
  });
});

describe("tip depth in the plug frame", () => {
  it("is jacketIn + exposed", () => {
    const end = makeEnd({ jacketEdgeMm: 30, tipMm: { ...uniformTips(18), brown: 21 }, fan: T568B, plug: plug(9) });

    expect(tipInPlug(end, "orange")).toBe(21);
    expect(tipInPlug(end, "brown")).toBe(18);
  });
});

describe("insertion bounds", () => {
  it("lo engages the longest conductor by MIN_ENGAGE; hi stops at the jacket stop or the front face", () => {
    expect(insertionBounds(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }))).toEqual({ lo: -11, hi: 9 });
    expect(insertionBounds(makeEnd({ jacketEdgeMm: 30, tipMm: 22, fan: T568B }))).toEqual({ lo: -7, hi: 10 });
    expect(insertionBounds(makeEnd({ jacketEdgeMm: 30, tipMm: 6, fan: T568B }))).toEqual({ lo: -23, hi: -3 });
  });

  it("always has lo ≤ hi", () => {
    for (let longest = 1; longest <= 200; longest++) {
      const { lo, hi } = insertionBounds(makeEnd({ jacketEdgeMm: 200, tipMm: 200 - longest, fan: T568B }));

      expect(lo).toBeLessThanOrEqual(hi);
    }
  });

  it("clamps", () => {
    expect(clamp(99, -11, 9)).toBe(9);
    expect(clamp(-99, -11, 9)).toBe(-11);
    expect(clamp(4, -11, 9)).toBe(4);
  });
});

describe("contact", () => {
  it("reaching is geometry; contact also needs a full crimp", () => {
    const seated = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: plug(9, "partial") });

    expect(reachesContact(seated, "brown")).toBe(true);
    expect(hasContact(seated, "brown")).toBe(false);
    expect(hasContact({ ...seated, plug: plug(9, "full") }, "brown")).toBe(true);
  });

  it("counts an end as terminated once crimped at all", () => {
    expect(terminated(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: plug(9, "none") }))).toBe(false);
    expect(terminated(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: plug(9, "partial") }))).toBe(true);
    expect(terminated(rawEnd(0))).toBe(false);
  });
});

describe("graded length", () => {
  it("is L0 − J_A − J_B, and trimming does not touch it", () => {
    const stripped = state(makeEnd({ jacketEdgeMm: 30, tipMm: 0 }), rawEnd(12));
    const trimmed = state(makeEnd({ jacketEdgeMm: 30, tipMm: 18 }), rawEnd(12));

    expect(jacketedLengthMm(stripped, SCENARIO)).toBe(958);
    expect(jacketedLengthMm(trimmed, SCENARIO)).toBe(958);
  });
});

describe("nicks", () => {
  it("are active on a conductor while some of [n, n + 1) lies inward of its tip", () => {
    const end = makeEnd({ jacketEdgeMm: 60, tipMm: { ...uniformTips(48), brown: 30 } });

    expect(nickActiveOn(end, 47, "orange")).toBe(false); // tip === n + 1
    expect(nickActiveOn(end, 48, "orange")).toBe(true); // tip === n
    expect(nickActiveOn(end, 40, "brown")).toBe(true);
    expect(nickActive(end, 40)).toBe(true); // brown still carries it
    expect(nickActive(end, 29)).toBe(false);
  });

  it("normalise to sorted, unique and active", () => {
    const end = makeEnd({ jacketEdgeMm: 60, tipMm: 48, nicksAtMm: [55, 30, 55, 48, 47] });

    expect(normalizeNicks(end)).toEqual([48, 55]);
  });
});

describe("constructors", () => {
  it("rawEnd has every tip at the jacket edge and nothing else", () => {
    expect(rawEnd(7)).toEqual({
      jacketEdgeMm: 7,
      tipMm: uniformTips(7),
      fan: null,
      plug: null,
      nicksAtMm: [],
      untwisted: { orange: false, green: false, blue: false, brown: false },
    });
  });

  it("makeEnd marks a fanned end untwisted, and copies what it is given", () => {
    const fan = [...T568B];
    const end = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan });

    expect(end.untwisted).toEqual({ orange: true, green: true, blue: true, brown: true });
    expect(end.fan).not.toBe(fan);
  });

  it("otherEnd", () => {
    expect(otherEnd("A")).toBe("B");
    expect(otherEnd("B")).toBe("A");
  });
});

describe("invariantViolations", () => {
  const good = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: plug(9) });

  it("accepts a physically possible state", () => {
    expect(invariantViolations(state(good, good, { connections: { A: "tester-main" } }), SCENARIO)).toEqual([]);
  });

  it("catches a tip past the jacket edge", () => {
    expect(invariantViolations(state(makeEnd({ jacketEdgeMm: 10, tipMm: 11 })), SCENARIO)).not.toEqual([]);
  });

  it("catches a fan that is not a permutation, and a plug without a fan", () => {
    const duplicate = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: [...T568B.slice(0, 7), "white-orange"] });
    const noFan = makeEnd({ jacketEdgeMm: 30, tipMm: 18, plug: plug(9) });

    expect(invariantViolations(state(duplicate), SCENARIO)).not.toEqual([]);
    expect(invariantViolations(state(noFan), SCENARIO)).not.toEqual([]);
  });

  it("catches a plug seated outside its bounds", () => {
    expect(invariantViolations(state({ ...good, plug: plug(10) }), SCENARIO)).not.toEqual([]);
  });

  it("catches unnormalised nicks, a short body, and a shared endpoint", () => {
    expect(invariantViolations(state(makeEnd({ jacketEdgeMm: 30, tipMm: 18, nicksAtMm: [10] })), SCENARIO)).not.toEqual([]);
    expect(invariantViolations(state(rawEnd(500), rawEnd(451)), SCENARIO)).not.toEqual([]);
    expect(
      invariantViolations(state(good, good, { connections: { A: "tester-main", B: "tester-main" } }), SCENARIO),
    ).not.toEqual([]);
  });

  it("catches a connection with no plug, or to an unknown endpoint", () => {
    expect(invariantViolations(state(rawEnd(0), rawEnd(0), { connections: { A: "tester-main" } }), SCENARIO)).not.toEqual([]);
    expect(invariantViolations(state(good, good, { connections: { A: "pc-9:eth0" } }), SCENARIO)).not.toEqual([]);
  });
});
