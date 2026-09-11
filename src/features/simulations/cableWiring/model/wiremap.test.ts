import { describe, expect, it } from "vitest";

import { NATURAL_ORDER, T568A, T568B } from "./constants";
import { makeEnd, uniformTips } from "./geometry";
import { pinsAt, standardOf, structuralSplitPairs, testerReadout, wiremap, wiremapFrom } from "./wiremap";
import type { CableEnd, CableState, Conductor, Crimp, Orientation, Scenario } from "./types";

/**
 * The electrical picture: pins, standards, split pairs, the frozen precedence
 * and the tester's readout. Record fixtures F01–F20, F27/F28 and F35 at the
 * electrical level (their requirement outcomes belong to the P2 evaluator),
 * and model fixture M21.
 */

/** G(std, orientation): J 30, tips 18 (12 exposed), seated 9, fully crimped. */
function G(fan: readonly Conductor[], orientation: Orientation = "contacts-up", crimp: Crimp = "full"): CableEnd {
  return makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan, plug: { orientation, jacketInMm: 9, crimp } });
}

function cable(A: CableEnd, B: CableEnd, connections: CableState["connections"] = {}): CableState {
  return { ends: { A, B }, tray: { plugs: 0 }, connections };
}

const reversed = (fan: readonly Conductor[]) => [...fan].reverse();
const GIGABIT_B: Conductor[] = [
  "white-green", "green", "white-orange", "white-brown", "brown", "orange", "blue", "white-blue",
];

const BENCH: Scenario = {
  id: "bench",
  startLengthMm: 1000,
  plugs: 0,
  initialEnds: { A: makeEnd({ jacketEdgeMm: 0 }), B: makeEnd({ jacketEdgeMm: 0 }) },
  endpoints: [
    { id: "tester-main", kind: "tester-main" },
    { id: "tester-remote", kind: "tester-remote" },
  ],
};

describe("pinsAt and orientation", () => {
  it("reads the fan straight across when the contacts face the reading face", () => {
    expect(pinsAt(G(T568B))).toEqual([...T568B]);
  });

  it("reverses it when the plug is turned over", () => {
    expect(pinsAt(G(T568B, "contacts-down"))).toEqual(reversed(T568B));
  });

  it("has no pins without a plug", () => {
    expect(pinsAt(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }))).toBeNull();
  });
});

describe("standardOf", () => {
  it("names only an exact match", () => {
    expect(standardOf([...T568A])).toBe("T568A");
    expect(standardOf([...T568B])).toBe("T568B");
    expect(standardOf(reversed(T568B))).toBeNull(); // reversed-B is a diagnosis, never a standard
    expect(standardOf([...NATURAL_ORDER])).toBeNull();
    expect(standardOf(null)).toBeNull();
  });
});

describe("structural split pairs", () => {
  it("F11: natural order splits 3/6 and 4/5", () => {
    const state = cable(G(NATURAL_ORDER), G(NATURAL_ORDER));

    expect(structuralSplitPairs(state, "A")).toEqual([
      { end: "A", pins: [3, 6], conductors: ["white-green", "white-blue"] },
      { end: "A", pins: [4, 5], conductors: ["green", "blue"] },
    ]);
  });

  it("F12: T568B has no splits; natural order at B does", () => {
    const state = cable(G(T568B), G(NATURAL_ORDER));

    expect(structuralSplitPairs(state, "A")).toEqual([]);
    expect(structuralSplitPairs(state, "B").map((f) => f.pins)).toEqual([[3, 6], [4, 5]]);
  });

  it("finds none in T568A, reversed T568B, or the gigabit crossover pinout", () => {
    expect(structuralSplitPairs(cable(G(T568A), G(T568A)), "A")).toEqual([]);
    expect(structuralSplitPairs(cable(G(T568B, "contacts-down"), G(T568B)), "A")).toEqual([]);
    expect(structuralSplitPairs(cable(G(T568B), G(GIGABIT_B)), "B")).toEqual([]);
  });

  it("is physical: it holds with no continuity at all", () => {
    const state = cable(G(NATURAL_ORDER, "contacts-up", "partial"), G(NATURAL_ORDER));

    expect(structuralSplitPairs(state, "A")).toHaveLength(2);
    expect(wiremap(state).splitPairs).toEqual([]);
  });

  it("is empty without a plug", () => {
    const state = cable(makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: NATURAL_ORDER }), G(T568B));

    expect(structuralSplitPairs(state, "A")).toEqual([]);
  });
});

describe("wiremap — patterns", () => {
  it("F01: T568B both ends is straight", () => {
    const report = wiremap(cable(G(T568B), G(T568B)));

    expect(report).toEqual({
      verdict: "straight",
      pattern: "straight",
      map: [1, 2, 3, 4, 5, 6, 7, 8],
      opens: [],
      openDetail: [],
      shorts: [],
      splitPairs: [],
    });
  });

  it("F02/F03: T568A both ends is straight too", () => {
    expect(wiremap(cable(G(T568A), G(T568A))).verdict).toBe("straight");
  });

  it("F04/F05: T568B to T568A is a crossover", () => {
    const report = wiremap(cable(G(T568B), G(T568A)));

    expect(report.verdict).toBe("crossover");
    expect(report.map).toEqual([3, 6, 1, 4, 5, 2, 7, 8]);
  });

  it("F06: the gigabit pinout is diagnosed as gigabit-crossover, and B is no standard", () => {
    const state = cable(G(T568B), G(GIGABIT_B));

    expect(wiremap(state).verdict).toBe("gigabit-crossover");
    expect(wiremap(state).map).toEqual([3, 6, 1, 7, 8, 2, 4, 5]);
    expect(standardOf(pinsAt(state.ends.B))).toBeNull();
  });

  it("F07: a reversed fan at B is a rollover", () => {
    const report = wiremap(cable(G(T568B), G(reversed(T568B))));

    expect(report.verdict).toBe("rollover");
    expect(report.map).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("F08: both plugs turned over is electrically straight, but neither end is T568B", () => {
    const state = cable(G(T568B, "contacts-down"), G(T568B, "contacts-down"));

    expect(wiremap(state).verdict).toBe("straight");
    expect(standardOf(pinsAt(state.ends.A))).toBeNull();
    expect(standardOf(pinsAt(state.ends.B))).toBeNull();
  });

  it("F09: one plug turned over is a rollover", () => {
    const state = cable(G(T568B, "contacts-down"), G(T568B));

    expect(wiremap(state).verdict).toBe("rollover");
    expect(standardOf(pinsAt(state.ends.A))).toBeNull();
  });

  it("F35: a mirrored fan in a turned-over plug is T568B at the pins, and passes", () => {
    const state = cable(G(reversed(T568B), "contacts-down"), G(T568B));

    expect(standardOf(pinsAt(state.ends.A))).toBe("T568B");
    expect(wiremap(state).verdict).toBe("straight");
  });

  it("F10: pins 1 and 2 swapped at A is a miswire with the pairs intact", () => {
    const swapped: Conductor[] = [...T568B];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];

    const report = wiremap(cable(G(swapped), G(T568B)));

    expect(report.verdict).toBe("miswired");
    expect(report.pattern).toBe("miswired");
    expect(report.map).toEqual([2, 1, 3, 4, 5, 6, 7, 8]);
    expect(report.splitPairs).toEqual([]);
  });

  it("F11: natural order both ends is SPLIT-PAIR over an underlying straight map", () => {
    const report = wiremap(cable(G(NATURAL_ORDER), G(NATURAL_ORDER)));

    expect(report.verdict).toBe("split-pair");
    expect(report.pattern).toBe("straight");
    expect(report.map).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(report.splitPairs.map((f) => [f.end, f.pins])).toEqual([
      ["A", [3, 6]],
      ["A", [4, 5]],
      ["B", [3, 6]],
      ["B", [4, 5]],
    ]);
  });

  it("F12: T568B against natural order is MISWIRED, with the splits still listed", () => {
    const report = wiremap(cable(G(T568B), G(NATURAL_ORDER)));

    expect(report.verdict).toBe("miswired");
    expect(report.map).toEqual([1, 2, 3, 5, 6, 4, 7, 8]);
    expect(report.splitPairs.map((f) => [f.end, f.pins])).toEqual([
      ["B", [3, 6]],
      ["B", [4, 5]],
    ]);
  });
});

describe("wiremap — opens and incompleteness", () => {
  it("F13: 8 mm exposed seated at JACKET_STOP falls short of every blade", () => {
    const A = makeEnd({
      jacketEdgeMm: 30,
      tipMm: 22,
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 10, crimp: "full" },
    });
    const report = wiremap(cable(A, G(T568B)));

    expect(report.verdict).toBe("open");
    expect(report.pattern).toBeNull();
    expect(report.opens).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(report.map).toEqual(Array(8).fill(null));
    expect(report.openDetail[0]).toEqual({ aPin: 1, conductor: "white-orange", noContactAt: ["A"] });
  });

  it("F14: one short conductor opens only its own pin", () => {
    const A = makeEnd({
      jacketEdgeMm: 30,
      tipMm: { ...uniformTips(18), brown: 21 },
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
    });
    const report = wiremap(cable(A, G(T568B)));

    expect(report.verdict).toBe("open");
    expect(report.opens).toEqual([8]);
    expect(report.map).toEqual([1, 2, 3, 4, 5, 6, 7, null]);
    expect(report.pattern).toBeNull();
  });

  it("an open never becomes a miswire, even over a miswired map", () => {
    const A = makeEnd({
      jacketEdgeMm: 30,
      tipMm: { ...uniformTips(18), brown: 21 },
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
    });
    const report = wiremap(cable(A, G(NATURAL_ORDER)));

    expect(report.verdict).toBe("open");
    expect(report.pattern).toBeNull();
    expect(report.map).toEqual([1, 2, 3, 5, 6, 4, 7, null]);
  });

  it("F17: a plug not pushed home opens every pin", () => {
    const A = makeEnd({
      jacketEdgeMm: 30,
      tipMm: 18,
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 5, crimp: "full" },
    });

    expect(wiremap(cable(A, G(T568B))).opens).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("F18: a partial crimp is terminated, makes no contact, and reads OPEN", () => {
    const report = wiremap(cable(G(T568B), G(T568B, "contacts-up", "partial")));

    expect(report.verdict).toBe("open");
    expect(report.opens).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(report.openDetail.every((d) => d.noContactAt.join() === "B")).toBe(true);
  });

  it("F19: an uncrimped plug is INCOMPLETE", () => {
    const report = wiremap(cable(G(T568B), G(T568B, "contacts-up", "none")));

    expect(report).toEqual({
      verdict: "incomplete",
      pattern: null,
      map: Array(8).fill(null),
      opens: [],
      openDetail: [],
      shorts: [],
      splitPairs: [],
    });
  });

  it("F20: an end with no plug is INCOMPLETE", () => {
    const B = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B });

    expect(wiremap(cable(G(T568B), B)).verdict).toBe("incomplete");
  });

  it("names both ends when neither has contact", () => {
    const report = wiremap(cable(G(T568B, "contacts-up", "partial"), G(T568B, "contacts-up", "partial")));

    expect(report.openDetail[0].noContactAt).toEqual(["A", "B"]);
  });

  it("V1 never reports a short", () => {
    const nicked = makeEnd({
      jacketEdgeMm: 30,
      tipMm: 18,
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
      nicksAtMm: [30],
    });
    const report = wiremap(cable(nicked, G(T568B)));

    expect(report.shorts).toEqual([]);
    expect(report.verdict).toBe("straight");
  });
});

describe("wiremap ignores connections", () => {
  it("F27/F28: the verdict is the same plugged in or not", () => {
    const loose = cable(G(T568B), G(T568A));
    const plugged = cable(G(T568B), G(T568A), { A: "tester-main", B: "tester-remote" });

    expect(wiremap(plugged)).toEqual(wiremap(loose));
    expect(wiremap(cable(G(T568B), G(T568B), { A: "pc-1:eth0", B: "pc-2:eth0" })).verdict).toBe("straight");
  });
});

describe("M21: testerReadout", () => {
  it("is idle with nothing in the MAIN unit", () => {
    expect(testerReadout(cable(G(T568B), G(T568B)), BENCH)).toEqual({ status: "idle" });
    expect(testerReadout(cable(G(T568B), G(T568B), { A: "tester-remote" }), BENCH)).toEqual({ status: "idle" });
  });

  it("reports no remote when the other end is not in the REMOTE unit", () => {
    expect(testerReadout(cable(G(T568B), G(T568B), { B: "tester-main" }), BENCH)).toEqual({
      status: "no-remote",
      mainEnd: "B",
    });
  });

  it("reports the wiremap from the MAIN end", () => {
    const state = cable(G(T568B), G(NATURAL_ORDER), { A: "tester-main", B: "tester-remote" });

    expect(testerReadout(state, BENCH)).toEqual({ status: "report", mainEnd: "A", report: wiremap(state) });
  });

  it("inverts the map when B is in MAIN", () => {
    const state = cable(G(T568B), G(NATURAL_ORDER), { A: "tester-remote", B: "tester-main" });
    const readout = testerReadout(state, BENCH);

    expect(readout.status).toBe("report");
    if (readout.status !== "report") return;

    expect(readout.mainEnd).toBe("B");
    expect(readout.report.map).toEqual([1, 2, 3, 6, 4, 5, 7, 8]);
    expect(readout.report.verdict).toBe("miswired");
    expect(readout.report).toEqual(wiremapFrom(state, "B"));
  });

  it("names every pattern the same from either end", () => {
    for (const B of [T568A, T568B, GIGABIT_B, reversed(T568B)]) {
      const state = cable(G(T568B), G(B));

      expect(wiremapFrom(state, "B").verdict).toBe(wiremapFrom(state, "A").verdict);
    }
  });

  it("numbers opens at the MAIN end", () => {
    const A = makeEnd({
      jacketEdgeMm: 30,
      tipMm: { ...uniformTips(18), brown: 21 },
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
    });
    const state = cable(A, G(reversed(T568B)), { A: "tester-remote", B: "tester-main" });
    const readout = testerReadout(state, BENCH);

    // Brown sits on B's pin 1 in a reversed fan.
    expect(readout.status === "report" && readout.report.opens).toEqual([1]);
  });

  it("shows INCOMPLETE for an uncrimped plug sitting in the tester", () => {
    const state = cable(G(T568B), G(T568B, "contacts-up", "none"), { A: "tester-main", B: "tester-remote" });
    const readout = testerReadout(state, BENCH);

    expect(readout.status === "report" && readout.report.verdict).toBe("incomplete");
  });
});
