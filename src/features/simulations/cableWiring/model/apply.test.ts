import { describe, expect, it } from "vitest";

import { apply, createInitialState } from "./apply";
import { NATURAL_ORDER, PAIR_IDS, T568B } from "./constants";
import { exposed, invariantViolations, jacketedLengthMm, makeEnd, rawEnd, uniformTips } from "./geometry";
import { S1_PRACTICE } from "./scenarios";
import { standardOf, pinsAt, wiremap } from "./wiremap";
import type { Action, CableEnd, CableState, RejectReason, Scenario, SimEvent } from "./types";

/**
 * The action engine, against the frozen P0 contract (§4) and model fixtures
 * M01–M20 and M23.
 *
 * Every state handed to apply() here is deep-frozen first, so an engine that
 * mutated its input would throw rather than quietly pass. Every accepted
 * result is also checked against the frozen invariants, so no sequence below
 * can wander into a physically impossible state without failing.
 */

const TESTERS = [
  { id: "tester-main", kind: "tester-main" as const },
  { id: "tester-remote", kind: "tester-remote" as const },
];

/** Both ends raw, a metre of cable, four plugs. */
const BENCH: Scenario = {
  id: "bench",
  startLengthMm: 1000,
  plugs: 4,
  initialEnds: { A: rawEnd(0), B: rawEnd(0) },
  endpoints: TESTERS,
};

/** S2's frozen geometry: 400 mm, three plugs. Test data only — not seeded in P1. */
const S2: Scenario = { ...BENCH, id: "s2", startLengthMm: 400, plugs: 3 };

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
}

function accepted(state: CableState, action: Action, scenario: Scenario = BENCH) {
  const result = apply(deepFreeze(state), action, scenario);
  if ("rejected" in result) throw new Error(`${action.type} refused: ${result.rejected}`);

  expect(invariantViolations(result.state, scenario)).toEqual([]);
  expect(result.events.length).toBeGreaterThan(0);

  return result;
}

function refused(state: CableState, action: Action, scenario: Scenario = BENCH): RejectReason {
  const before = JSON.stringify(state);
  const result = apply(deepFreeze(state), action, scenario);

  expect(result).not.toHaveProperty("state");
  expect(result).not.toHaveProperty("events");
  expect(JSON.stringify(state)).toBe(before);

  return (result as { rejected: RejectReason }).rejected;
}

function chain(state: CableState, actions: Action[], scenario: Scenario = BENCH) {
  return actions.reduce((current, action) => accepted(current, action, scenario).state, state);
}

function stateWith(ends: Partial<Record<"A" | "B", CableEnd>>, extra: Partial<CableState> = {}): CableState {
  return {
    ends: { A: ends.A ?? rawEnd(0), B: ends.B ?? rawEnd(0) },
    tray: { plugs: 4 },
    connections: {},
    ...extra,
  };
}

/** Stripped 30 and fanned in natural order. */
const fannedA = () => stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0, fan: NATURAL_ORDER }) });

/** Fanned, arranged to T568B, trimmed to 12 — ready for a plug. */
const trimmedA = () =>
  stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }) });

/** Terminate one end the textbook way: strip 30, untwist, arrange T568B, trim 12, seat, crimp. */
function terminateActions(end: "A" | "B"): Action[] {
  return [
    { type: "strip", end, amountMm: 30, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
    { type: "moveConductor", end, conductor: "blue", toIndex: 3 },
    { type: "moveConductor", end, conductor: "green", toIndex: 5 },
    { type: "trim", end, leaveMm: 12 },
    { type: "insert", end, orientation: "contacts-up", pushMm: 99 },
    { type: "crimp", end, squeeze: "full" },
  ];
}

const types = (events: SimEvent[]) => events.map((event) => event.type);

/* ============================================================ */

describe("createInitialState", () => {
  it("builds the bench from the scenario, with a full tray and nothing connected", () => {
    const state = createInitialState(BENCH);

    expect(state.tray.plugs).toBe(4);
    expect(state.connections).toEqual({});
    expect(state.ends.A).toEqual(rawEnd(0));
    expect(invariantViolations(state, BENCH)).toEqual([]);
  });

  it("does not share structure with the scenario", () => {
    const state = createInitialState(S1_PRACTICE);

    expect(state.ends.B).toEqual(S1_PRACTICE.initialEnds.B);
    expect(state.ends.B).not.toBe(S1_PRACTICE.initialEnds.B);
    expect(state.ends.B.tipMm).not.toBe(S1_PRACTICE.initialEnds.B.tipMm);
  });
});

describe("S1 practice scenario", () => {
  it("starts with A raw and B a factory T568B end", () => {
    const state = createInitialState(S1_PRACTICE);

    expect(S1_PRACTICE.title).toBe("Terminate a straight-through cable");
    expect(S1_PRACTICE.difficulty).toBe("beginner");
    expect(state.tray.plugs).toBe(4);
    expect(state.ends.A).toEqual(rawEnd(0));
    expect(state.ends.B.jacketEdgeMm).toBe(12);
    expect(state.ends.B.tipMm).toEqual(uniformTips(0));
    expect(state.ends.B.plug).toEqual({ orientation: "contacts-up", jacketInMm: 9, crimp: "full" });
    expect(standardOf(pinsAt(state.ends.B))).toBe("T568B");
    expect(S1_PRACTICE.endpoints.map((e) => e.id)).toEqual(["tester-main", "tester-remote"]);
    expect(S1_PRACTICE.require).toEqual({
      ends: { A: "T568B", B: "T568B" },
      cable: null,
      minLengthMm: null,
      inspection: [],
      link: null,
    });
    expect(invariantViolations(state, S1_PRACTICE)).toEqual([]);
  });

  it("can be finished into a working straight-through cable", () => {
    const done = chain(createInitialState(S1_PRACTICE), terminateActions("A"), S1_PRACTICE);

    expect(wiremap(done).verdict).toBe("straight");
    expect(done.tray.plugs).toBe(3);
  });
});

describe("well-formedness", () => {
  const bad: [string, unknown][] = [
    ["an unknown end", { type: "cut", end: "C", atMm: 10 }],
    ["a fractional measurement", { type: "cut", end: "A", atMm: 10.5 }],
    ["NaN", { type: "strip", end: "A", amountMm: Number.NaN, slot: "correct" }],
    ["an unknown slot", { type: "strip", end: "A", amountMm: 10, slot: "blunt" }],
    ["an unknown pair", { type: "untwist", end: "A", pair: "purple" }],
    ["an unknown conductor", { type: "moveConductor", end: "A", conductor: "red", toIndex: 0 }],
    ["an unknown orientation", { type: "insert", end: "A", orientation: "sideways", pushMm: 9 }],
    ["an unknown squeeze", { type: "crimp", end: "A", squeeze: "gentle" }],
    ["a non-string endpoint", { type: "connect", end: "A", endpoint: 7 }],
    ["an unknown action", { type: "test", end: "A" }],
    ["no action at all", null],
  ];

  it.each(bad)("refuses %s as invalid-input", (_label, action) => {
    expect(refused(fannedA(), action as Action)).toBe("invalid-input");
  });
});

/* ============================================================
   CUT
   ============================================================ */

describe("cut", () => {
  it("M13: a crimped end cannot be cut through its plug, only behind it", () => {
    // J=30, jacketIn=9, so the plug's rear opening is at R=39 in the end frame.
    const crimped = stateWith({
      A: makeEnd({
        jacketEdgeMm: 30,
        tipMm: 18,
        fan: T568B,
        plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
      }),
    });

    expect(refused(crimped, { type: "cut", end: "A", atMm: 35 })).toBe("cut-through-plug");
    expect(refused(crimped, { type: "cut", end: "A", atMm: 38 })).toBe("cut-through-plug");

    const { state, events } = accepted(crimped, { type: "cut", end: "A", atMm: 39 });

    expect(types(events)).toEqual(["cut", "plugDestroyed"]);
    expect(events[0]).toEqual({ type: "cut", end: "A", fromJ: 30, toJ: 39 });
    expect(state.tray.plugs).toBe(4);
    expect(state.ends.A).toEqual(rawEnd(39));
  });

  it("destroys a partially crimped plug too", () => {
    const partial = stateWith({
      A: makeEnd({
        jacketEdgeMm: 30,
        tipMm: 18,
        fan: T568B,
        plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "partial" },
      }),
    });

    const { state, events } = accepted(partial, { type: "cut", end: "A", atMm: 39 });

    expect(types(events)).toEqual(["cut", "plugDestroyed"]);
    expect(state.tray.plugs).toBe(4);
  });

  it("M14: releases an uncrimped plug back to the tray", () => {
    const seated = stateWith(
      {
        A: makeEnd({
          jacketEdgeMm: 30,
          tipMm: 18,
          fan: T568B,
          plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" },
        }),
      },
      { tray: { plugs: 3 } },
    );

    const { state, events } = accepted(seated, { type: "cut", end: "A", atMm: 39 });

    expect(types(events)).toEqual(["cut", "plugReleased"]);
    expect(state.tray.plugs).toBe(4);
    expect(state.ends.A.plug).toBeNull();
  });

  it("uses the jacket edge, not the plug, as the limit when the jacket sits outside the plug", () => {
    // jacketIn −3: rear opening R = 27 lies outward of J = 30, so P ≥ J is what binds.
    const outside = stateWith({
      A: makeEnd({
        jacketEdgeMm: 30,
        tipMm: 6,
        fan: T568B,
        plug: { orientation: "contacts-up", jacketInMm: -3, crimp: "full" },
      }),
    });

    expect(refused(outside, { type: "cut", end: "A", atMm: 29 })).toBe("position-not-on-jacket");
    expect(accepted(outside, { type: "cut", end: "A", atMm: 30 }).state.ends.A).toEqual(rawEnd(30));
  });

  it("M15: will not cut nothing, but cutting at the jacket edge removes exposed conductor", () => {
    expect(refused(stateWith({}), { type: "cut", end: "A", atMm: 0 })).toBe("nothing-to-cut");

    const stripped = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }) });
    const { state } = accepted(stripped, { type: "cut", end: "A", atMm: 30 });

    expect(state.ends.A).toEqual(rawEnd(30));
  });

  it("refuses a position outward of the jacket edge", () => {
    const stripped = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }) });

    expect(refused(stripped, { type: "cut", end: "A", atMm: 29 })).toBe("position-not-on-jacket");
  });

  it("M16: keeps MIN_BODY of jacketed cable between the ends", () => {
    const longB = stateWith({ B: rawEnd(900) });

    expect(refused(longB, { type: "cut", end: "A", atMm: 51 })).toBe("insufficient-cable");
    expect(accepted(longB, { type: "cut", end: "A", atMm: 50 }).state.ends.A.jacketEdgeMm).toBe(50);
  });

  it("resets a fanned, untwisted end to raw", () => {
    const { state } = accepted(fannedA(), { type: "cut", end: "A", atMm: 40 });

    expect(state.ends.A).toEqual(rawEnd(40));
  });

  it("disconnects a connected end, after the cut and the plug", () => {
    const connected = stateWith(
      {
        A: makeEnd({
          jacketEdgeMm: 30,
          tipMm: 18,
          fan: T568B,
          plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
        }),
      },
      { connections: { A: "tester-main" } },
    );

    const { state, events } = accepted(connected, { type: "cut", end: "A", atMm: 40 });

    expect(types(events)).toEqual(["cut", "plugDestroyed", "disconnected"]);
    expect(state.connections).toEqual({});
  });

  it("consumes graded length by exactly how far J moves", () => {
    const stripped = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }) });
    const { state } = accepted(stripped, { type: "cut", end: "A", atMm: 45 });

    expect(jacketedLengthMm(state, BENCH)).toBe(1000 - 45);
  });
});

/* ============================================================
   STRIP
   ============================================================ */

describe("strip", () => {
  it("M01: moves the jacket edge in and leaves the conductors where they were", () => {
    const { state, events } = accepted(stateWith({}), {
      type: "strip",
      end: "A",
      amountMm: 30,
      slot: "correct",
    });

    expect(state.ends.A.jacketEdgeMm).toBe(30);
    expect(state.ends.A.tipMm).toEqual(uniformTips(0));
    expect(state.ends.A.nicksAtMm).toEqual([]);
    expect(jacketedLengthMm(state, BENCH)).toBe(970);
    expect(events).toEqual([{ type: "stripped", end: "A", amountMm: 30, nicked: false }]);
  });

  it("M02: a too-deep slot nicks at the new jacket edge", () => {
    const { state, events } = accepted(stateWith({}), {
      type: "strip",
      end: "A",
      amountMm: 30,
      slot: "too-deep",
    });

    expect(state.ends.A.nicksAtMm).toEqual([30]);
    expect(events[0]).toEqual({ type: "stripped", end: "A", amountMm: 30, nicked: true });
  });

  it("M03: stripping 20 then 10 is the same cable as stripping 30", () => {
    const twice = chain(stateWith({}), [
      { type: "strip", end: "A", amountMm: 20, slot: "correct" },
      { type: "strip", end: "A", amountMm: 10, slot: "correct" },
    ]);
    const once = chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);

    expect(twice).toEqual(once);
  });

  it("accepts one to MAX_STRIP_PASS millimetres a pass", () => {
    expect(refused(stateWith({}), { type: "strip", end: "A", amountMm: 0, slot: "correct" })).toBe("invalid-input");
    expect(refused(stateWith({}), { type: "strip", end: "A", amountMm: 81, slot: "correct" })).toBe("invalid-input");
    expect(accepted(stateWith({}), { type: "strip", end: "A", amountMm: 1, slot: "correct" }).state.ends.A.jacketEdgeMm).toBe(1);
    expect(accepted(stateWith({}), { type: "strip", end: "A", amountMm: 80, slot: "correct" }).state.ends.A.jacketEdgeMm).toBe(80);
  });

  it("refuses to strip under a plug", () => {
    const plugged = stateWith({
      A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" } }),
    });

    expect(refused(plugged, { type: "strip", end: "A", amountMm: 10, slot: "correct" })).toBe("plug-present");
    // Preconditions come before range checks.
    expect(refused(plugged, { type: "strip", end: "A", amountMm: 0, slot: "correct" })).toBe("plug-present");
  });

  it("M16: refuses a strip that would leave less than MIN_BODY", () => {
    const longB = stateWith({ B: rawEnd(900) });

    expect(refused(longB, { type: "strip", end: "A", amountMm: 51, slot: "correct" })).toBe("insufficient-cable");
    expect(accepted(longB, { type: "strip", end: "A", amountMm: 50, slot: "correct" }).state.ends.A.jacketEdgeMm).toBe(50);
  });

  it("keeps the fan and untwist state when stripping further back (frozen simplification)", () => {
    const { state } = accepted(fannedA(), { type: "strip", end: "A", amountMm: 10, slot: "correct" });

    expect(state.ends.A.fan).toEqual([...NATURAL_ORDER]);
    expect(exposed(state.ends.A, "brown")).toBe(40);
  });
});

/* ============================================================
   UNTWIST
   ============================================================ */

describe("untwist", () => {
  it("M04: needs MIN_WORK of exposed conductor on both wires of the pair", () => {
    const short = chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 19, slot: "correct" }]);

    expect(refused(short, { type: "untwist", end: "A", pair: "orange" })).toBe("too-short-to-grip");

    const enough = chain(short, [{ type: "strip", end: "A", amountMm: 1, slot: "correct" }]);

    expect(accepted(enough, { type: "untwist", end: "A", pair: "orange" }).state.ends.A.untwisted.orange).toBe(true);
  });

  it("uses the shorter wire of the pair", () => {
    const tips = { ...uniformTips(0), orange: 11 }; // orange exposed 19, white-orange 30
    const uneven = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: tips }) });

    expect(refused(uneven, { type: "untwist", end: "A", pair: "orange" })).toBe("too-short-to-grip");
    expect(accepted(uneven, { type: "untwist", end: "A", pair: "green" }).state.ends.A.untwisted.green).toBe(true);
  });

  it("M05: fans the conductors in natural order once the fourth pair is done", () => {
    let state = chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);

    for (const pair of ["orange", "green", "blue"] as const) {
      const result = accepted(state, { type: "untwist", end: "A", pair });
      expect(types(result.events)).toEqual(["untwisted"]);
      expect(result.state.ends.A.fan).toBeNull();
      state = result.state;
    }

    const last = accepted(state, { type: "untwist", end: "A", pair: "brown" });

    expect(types(last.events)).toEqual(["untwisted", "fanned"]);
    expect(last.state.ends.A.fan).toEqual([...NATURAL_ORDER]);
  });

  describe("a scenario's starting row", () => {
    const SHUFFLED = ["brown", "white-blue", "orange", "white-green", "green", "white-orange", "blue", "white-brown"] as const;
    const shuffled: Scenario = { ...BENCH, fanOrder: SHUFFLED };
    const STRIP_AND_UNTWIST: Action[] = [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    ];
    /** Carry each conductor to its T568B lane in turn, from whatever row the fan started in. */
    const arrangeToT568B = (fan: readonly string[]): Action[] => {
      const row = [...fan];
      return T568B.flatMap((conductor, toIndex): Action[] => {
        if (row.indexOf(conductor) === toIndex) return [];
        row.splice(row.indexOf(conductor), 1);
        row.splice(toIndex, 0, conductor);
        return [{ type: "moveConductor", end: "A", conductor, toIndex }];
      });
    };
    const finish: Action[] = [
      { type: "trim", end: "A", leaveMm: 12 },
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 },
      { type: "crimp", end: "A", squeeze: "full" },
    ];
    const withBT568B = (scenario: Scenario): Scenario => ({
      ...scenario,
      initialEnds: { ...scenario.initialEnds, B: S1_PRACTICE.initialEnds.B },
    });

    it("fans into the scenario's row, the same eight conductors each once", () => {
      const fan = chain(stateWith({}), STRIP_AND_UNTWIST, shuffled).ends.A.fan!;

      expect(fan).toEqual([...SHUFFLED]);
      expect([...fan].sort()).toEqual([...NATURAL_ORDER].sort());
    });

    it("falls back to the natural row when the scenario's row is not all eight once each", () => {
      for (const fanOrder of [NATURAL_ORDER.slice(1), [...NATURAL_ORDER.slice(1), "brown"]] as const) {
        const fan = chain(stateWith({}), STRIP_AND_UNTWIST, { ...BENCH, fanOrder: [...fanOrder] }).ends.A.fan;

        expect(fan).toEqual([...NATURAL_ORDER]);
      }
    });

    it("changes where the row starts, never what a finished end is graded as", () => {
      const scenario = withBT568B(shuffled);
      const start = createInitialState(scenario);
      const fanned = chain(start, STRIP_AND_UNTWIST, scenario);
      const arranged = chain(fanned, [...arrangeToT568B(fanned.ends.A.fan!), ...finish], scenario);

      expect(standardOf(pinsAt(arranged.ends.A))).toBe("T568B");
      expect(wiremap(arranged).verdict).toBe("straight");

      // Left as it fell, the row is no standard, and the cable is no good.
      const unarranged = chain(fanned, finish, scenario);

      expect(standardOf(pinsAt(unarranged.ends.A))).toBeNull();
      expect(wiremap(unarranged).verdict).not.toBe("straight");
    });

    it("is the same row every time for the same scenario", () => {
      const once = chain(stateWith({}), STRIP_AND_UNTWIST, shuffled);
      const again = chain(stateWith({}), STRIP_AND_UNTWIST, shuffled);

      expect(again).toEqual(once);
    });
  });

  it("refuses a pair already untwisted, and any pair under a plug", () => {
    expect(refused(fannedA(), { type: "untwist", end: "A", pair: "blue" })).toBe("already-untwisted");

    const plugged = stateWith({
      A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" } }),
    });
    expect(refused(plugged, { type: "untwist", end: "A", pair: "blue" })).toBe("plug-present");
  });
});

/* ============================================================
   ARRANGE
   ============================================================ */

describe("moveConductor", () => {
  it("M06: reorders natural order into T568B in two moves", () => {
    const first = accepted(fannedA(), { type: "moveConductor", end: "A", conductor: "blue", toIndex: 3 });

    expect(first.state.ends.A.fan).toEqual([
      "white-orange", "orange", "white-green", "blue", "green", "white-blue", "white-brown", "brown",
    ]);
    expect(first.events).toEqual([
      { type: "conductorMoved", end: "A", conductor: "blue", fromIndex: 4, toIndex: 3 },
    ]);

    const second = accepted(first.state, { type: "moveConductor", end: "A", conductor: "green", toIndex: 5 });

    expect(second.state.ends.A.fan).toEqual([...T568B]);
  });

  it("shifts the others rather than swapping", () => {
    const { state } = accepted(fannedA(), {
      type: "moveConductor",
      end: "A",
      conductor: "white-orange",
      toIndex: 7,
    });

    expect(state.ends.A.fan).toEqual([
      "orange", "white-green", "green", "blue", "white-blue", "white-brown", "brown", "white-orange",
    ]);
  });

  it("refuses a move to the current index, an index off the row, and a missing fan", () => {
    expect(refused(fannedA(), { type: "moveConductor", end: "A", conductor: "green", toIndex: 3 })).toBe("no-change");
    expect(refused(fannedA(), { type: "moveConductor", end: "A", conductor: "green", toIndex: 8 })).toBe("invalid-input");
    expect(refused(fannedA(), { type: "moveConductor", end: "A", conductor: "green", toIndex: -1 })).toBe("invalid-input");
    expect(refused(stateWith({}), { type: "moveConductor", end: "A", conductor: "green", toIndex: 0 })).toBe("no-fan");
  });

  it("refuses under a plug", () => {
    const plugged = stateWith({
      A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" } }),
    });

    expect(refused(plugged, { type: "moveConductor", end: "A", conductor: "green", toIndex: 0 })).toBe("plug-present");
  });
});

/* ============================================================
   TRIM
   ============================================================ */

describe("trim", () => {
  it("M07: trims a fanned row flush and costs no graded length", () => {
    const before = fannedA();
    const { state, events } = accepted(before, { type: "trim", end: "A", leaveMm: 12 });

    expect(NATURAL_ORDER.map((c) => exposed(state.ends.A, c))).toEqual(Array(8).fill(12));
    expect(state.ends.A.jacketEdgeMm).toBe(30);
    expect(jacketedLengthMm(state, BENCH)).toBe(jacketedLengthMm(before, BENCH));
    expect(events).toEqual([{ type: "trimmed", end: "A", leaveMm: 12, uneven: false }]);
  });

  it("M08: trimming bunched pairs catches some conductors short, and they can no longer be untwisted", () => {
    const stripped = chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
    const { state, events } = accepted(stripped, { type: "trim", end: "A", leaveMm: 12 });

    expect(NATURAL_ORDER.map((c) => exposed(state.ends.A, c))).toEqual([12, 11, 9, 10, 12, 11, 9, 10]);
    expect(events[0]).toEqual({ type: "trimmed", end: "A", leaveMm: 12, uneven: true });
    expect(refused(state, { type: "untwist", end: "A", pair: "orange" })).toBe("too-short-to-grip");
  });

  it("clamps a bunched offset at the jacket edge rather than past it", () => {
    const stripped = chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
    const { state } = accepted(stripped, { type: "trim", end: "A", leaveMm: 2 });

    expect(NATURAL_ORDER.map((c) => exposed(state.ends.A, c))).toEqual([2, 1, 0, 0, 2, 1, 0, 0]);
  });

  it("a later flush trim evens out a bunched trim that left enough to untwist", () => {
    const worked = chain(stateWith({}), [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "trim", end: "A", leaveMm: 25 },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "trim", end: "A", leaveMm: 12 },
    ]);

    expect(NATURAL_ORDER.map((c) => exposed(worked.ends.A, c))).toEqual(Array(8).fill(12));
  });

  it("refuses a trim that changes nothing, a zero trim, and a trim under a plug", () => {
    expect(refused(fannedA(), { type: "trim", end: "A", leaveMm: 30 })).toBe("no-change");
    expect(refused(fannedA(), { type: "trim", end: "A", leaveMm: 50 })).toBe("no-change");
    expect(refused(fannedA(), { type: "trim", end: "A", leaveMm: 0 })).toBe("invalid-input");

    const plugged = stateWith({
      A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" } }),
    });
    expect(refused(plugged, { type: "trim", end: "A", leaveMm: 10 })).toBe("plug-present");
  });
});

/* ============================================================
   INSERT / PUSH / WITHDRAW
   ============================================================ */

describe("insert", () => {
  it("M09: pushing until it stops seats the jacket at hi, and takes a plug from the tray", () => {
    const { state, events } = accepted(trimmedA(), {
      type: "insert",
      end: "A",
      orientation: "contacts-up",
      pushMm: 99,
    });

    // hi = min(JACKET_STOP 10, FRONT_STOP 21 − 12) = 9
    expect(state.ends.A.plug).toEqual({ orientation: "contacts-up", jacketInMm: 9, crimp: "none" });
    expect(state.tray.plugs).toBe(3);
    expect(events).toEqual([{ type: "inserted", end: "A", orientation: "contacts-up", jacketInMm: 9 }]);
  });

  it("clamps a shallow push to lo", () => {
    const { state } = accepted(trimmedA(), {
      type: "insert",
      end: "A",
      orientation: "contacts-down",
      pushMm: -500,
    });

    // lo = MIN_ENGAGE 1 − 12
    expect(state.ends.A.plug?.jacketInMm).toBe(-11);
  });

  it("stops at JACKET_STOP when the conductors are short", () => {
    const short = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 22, fan: T568B }) });
    const { state } = accepted(short, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 });

    expect(state.ends.A.plug?.jacketInMm).toBe(10);
  });

  it("refuses without a fan, with a plug already on, or with an empty tray", () => {
    const stripped = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }) });
    expect(refused(stripped, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 })).toBe("no-fan");

    const plugged = chain(trimmedA(), [{ type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 }]);
    expect(refused(plugged, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 })).toBe("plug-present");

    const empty = { ...trimmedA(), tray: { plugs: 0 } };
    expect(refused(empty, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 })).toBe("tray-empty");
  });
});

describe("push", () => {
  const shallow = () =>
    chain(trimmedA(), [{ type: "insert", end: "A", orientation: "contacts-up", pushMm: 5 }]);

  it("M10: only ever goes deeper, and never past hi", () => {
    expect(shallow().ends.A.plug?.jacketInMm).toBe(5);

    const { state, events } = accepted(shallow(), { type: "push", end: "A", pushMm: 99 });
    expect(state.ends.A.plug?.jacketInMm).toBe(9);
    expect(events).toEqual([{ type: "pushed", end: "A", jacketInMm: 9 }]);

    expect(refused(state, { type: "push", end: "A", pushMm: 7 })).toBe("no-change");
    expect(refused(state, { type: "push", end: "A", pushMm: 9 })).toBe("no-change");
    expect(refused(shallow(), { type: "push", end: "A", pushMm: 5 })).toBe("no-change");
  });

  it("refuses without a plug, on a crimped plug, and while connected", () => {
    expect(refused(trimmedA(), { type: "push", end: "A", pushMm: 9 })).toBe("no-plug");

    const partial = chain(shallow(), [{ type: "crimp", end: "A", squeeze: "partial" }]);
    expect(refused(partial, { type: "push", end: "A", pushMm: 9 })).toBe("plug-locked");

    const connected = chain(shallow(), [{ type: "connect", end: "A", endpoint: "tester-main" }]);
    expect(refused(connected, { type: "push", end: "A", pushMm: 9 })).toBe("plug-connected");
  });
});

describe("withdraw", () => {
  const seated = () =>
    chain(trimmedA(), [{ type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 }]);

  it("M11: before a crimp, the plug comes off undamaged and back into the tray", () => {
    const { state, events } = accepted(seated(), { type: "withdraw", end: "A" });

    expect(state.ends.A).toEqual(trimmedA().ends.A);
    expect(state.tray.plugs).toBe(4);
    expect(events).toEqual([{ type: "withdrawn", end: "A" }]);
  });

  it("M11: after any crimp it will not come off", () => {
    const partial = chain(seated(), [{ type: "crimp", end: "A", squeeze: "partial" }]);
    const full = chain(seated(), [{ type: "crimp", end: "A", squeeze: "full" }]);

    expect(refused(partial, { type: "withdraw", end: "A" })).toBe("plug-locked");
    expect(refused(full, { type: "withdraw", end: "A" })).toBe("plug-locked");
  });

  it("refuses with no plug, and while connected", () => {
    expect(refused(trimmedA(), { type: "withdraw", end: "A" })).toBe("no-plug");

    const connected = chain(seated(), [{ type: "connect", end: "A", endpoint: "tester-main" }]);
    expect(refused(connected, { type: "withdraw", end: "A" })).toBe("plug-connected");
  });
});

/* ============================================================
   CRIMP
   ============================================================ */

describe("crimp", () => {
  const seated = () =>
    chain(trimmedA(), [{ type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 }]);

  it("M12: none → partial → full, and nothing after full", () => {
    const partial = accepted(seated(), { type: "crimp", end: "A", squeeze: "partial" });
    expect(partial.state.ends.A.plug?.crimp).toBe("partial");
    expect(partial.events).toEqual([{ type: "crimped", end: "A", squeeze: "partial" }]);

    expect(refused(partial.state, { type: "crimp", end: "A", squeeze: "partial" })).toBe("no-change");

    const full = accepted(partial.state, { type: "crimp", end: "A", squeeze: "full" });
    expect(full.state.ends.A.plug?.crimp).toBe("full");

    expect(refused(full.state, { type: "crimp", end: "A", squeeze: "full" })).toBe("already-crimped");
    expect(refused(full.state, { type: "crimp", end: "A", squeeze: "partial" })).toBe("already-crimped");
  });

  it("goes straight from none to full", () => {
    expect(accepted(seated(), { type: "crimp", end: "A", squeeze: "full" }).state.ends.A.plug?.crimp).toBe("full");
  });

  it("refuses with no plug, and while connected", () => {
    expect(refused(trimmedA(), { type: "crimp", end: "A", squeeze: "full" })).toBe("no-plug");

    const connected = chain(seated(), [{ type: "connect", end: "A", endpoint: "tester-main" }]);
    expect(refused(connected, { type: "crimp", end: "A", squeeze: "full" })).toBe("plug-connected");
  });
});

/* ============================================================
   CONNECT / DISCONNECT
   ============================================================ */

describe("connect and disconnect", () => {
  const bothPlugged = () =>
    chain(
      stateWith({
        A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }),
        B: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B }),
      }),
      [
        { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 },
        { type: "insert", end: "B", orientation: "contacts-up", pushMm: 99 },
      ],
    );

  it("M20: needs a plug, a free scenario endpoint, and an unconnected end", () => {
    expect(refused(trimmedA(), { type: "connect", end: "A", endpoint: "tester-main" })).toBe("no-plug");

    const { state, events } = accepted(bothPlugged(), { type: "connect", end: "A", endpoint: "tester-main" });
    expect(state.connections).toEqual({ A: "tester-main" });
    expect(events).toEqual([{ type: "connected", end: "A", endpoint: "tester-main" }]);

    expect(refused(state, { type: "connect", end: "B", endpoint: "tester-main" })).toBe("endpoint-busy");
    expect(refused(state, { type: "connect", end: "A", endpoint: "tester-remote" })).toBe("already-connected");
    expect(refused(state, { type: "connect", end: "B", endpoint: "pc-9:eth0" })).toBe("unknown-endpoint");
  });

  it("connects an uncrimped plug — a usable plug is any plug", () => {
    expect(bothPlugged().ends.A.plug?.crimp).toBe("none");
    expect(accepted(bothPlugged(), { type: "connect", end: "A", endpoint: "tester-main" }).state.connections.A).toBe(
      "tester-main",
    );
  });

  it("disconnects a connected end, and refuses one that is not", () => {
    const connected = chain(bothPlugged(), [{ type: "connect", end: "A", endpoint: "tester-main" }]);
    const { state, events } = accepted(connected, { type: "disconnect", end: "A" });

    expect(state.connections).toEqual({});
    expect(events).toEqual([{ type: "disconnected", end: "A" }]);
    expect(refused(state, { type: "disconnect", end: "A" })).toBe("not-connected");
  });
});

/* ============================================================
   NICKS THROUGH ACTIONS
   ============================================================ */

describe("nick lifecycle", () => {
  const nicked = () =>
    chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "too-deep" }]);

  it("M17: a cut exactly at the nick leaves it; one millimetre further removes it", () => {
    const atNick = accepted(nicked(), { type: "cut", end: "A", atMm: 30 }).state;
    expect(atNick.ends.A.nicksAtMm).toEqual([30]);

    const past = accepted(atNick, { type: "cut", end: "A", atMm: 31 }).state;
    expect(past.ends.A.nicksAtMm).toEqual([]);
  });

  it("a trim alone cannot reach a nick at the jacket edge", () => {
    const fanned = chain(nicked(), PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })));
    const trimmed = accepted(fanned, { type: "trim", end: "A", leaveMm: 1 }).state;

    expect(trimmed.ends.A.nicksAtMm).toEqual([30]);
  });

  it("M18: strip past the nick, then trim past it, and it is gone", () => {
    const done = chain(nicked(), [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...terminateActions("A").slice(1),
    ]);

    expect(done.ends.A).toEqual(
      makeEnd({
        jacketEdgeMm: 60,
        tipMm: 48,
        fan: T568B,
        plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
      }),
    );
  });
});

/* ============================================================
   S2 REPAIR PATH (M19)
   ============================================================ */

/**
 * S2 keeps three plugs: two first terminations and one repair use all of them,
 * so a second repair is refused at insertion with an empty tray. The two-repair
 * length failure (262 mm) is F25, a record-level fixture in boundaries.test.ts —
 * not a state the S2 model can reach.
 */
describe("M19: the S2 repair budget — one repair, then an empty tray", () => {
  const firstTerminations = () =>
    chain(createInitialState(S2), [...terminateActions("A"), ...terminateActions("B")], S2);

  const repairA = (state: CableState, scenario: Scenario) => {
    const rear = state.ends.A.jacketEdgeMm + state.ends.A.plug!.jacketInMm;

    return chain(state, [{ type: "cut", end: "A", atMm: rear }, ...terminateActions("A")], scenario);
  };

  it("first terminations leave 340 mm", () => {
    const state = firstTerminations();

    expect(jacketedLengthMm(state, S2)).toBe(340);
    expect(state.tray.plugs).toBe(1);
  });

  it("one repair leaves 301 mm and F24's end A", () => {
    const repaired = repairA(firstTerminations(), S2);

    expect(jacketedLengthMm(repaired, S2)).toBe(301);
    expect(repaired.ends.A.jacketEdgeMm).toBe(69);
    expect(repaired.ends.A.tipMm).toEqual(uniformTips(57));
    expect(repaired.tray.plugs).toBe(0);
  });

  it("a second repair is refused at insertion because the tray is empty", () => {
    const repaired = repairA(firstTerminations(), S2);
    // Cut behind the plug (R = 69 + 9), then strip, untwist, arrange and trim.
    const recut = chain(repaired, [{ type: "cut", end: "A", atMm: 78 }, ...terminateActions("A").slice(0, 8)], S2);

    expect(recut.tray.plugs).toBe(0);
    expect(refused(recut, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 }, S2)).toBe("tray-empty");
  });
});

/* ============================================================
   DETERMINISM (M23)
   ============================================================ */

describe("M23: determinism", () => {
  const script: Action[] = [
    { type: "strip", end: "A", amountMm: 35, slot: "too-deep" },
    { type: "strip", end: "A", amountMm: 5, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    { type: "moveConductor", end: "A", conductor: "brown", toIndex: 0 },
    { type: "trim", end: "A", leaveMm: 14 },
    { type: "insert", end: "A", orientation: "contacts-down", pushMm: 3 },
    { type: "push", end: "A", pushMm: 99 },
    { type: "crimp", end: "A", squeeze: "partial" },
    { type: "connect", end: "A", endpoint: "tester-remote" },
    { type: "cut", end: "A", atMm: 60 },
  ];

  it("the same actions always give the same state and events", () => {
    const run = () => {
      let state = createInitialState(BENCH);
      const events: SimEvent[] = [];

      for (const action of script) {
        const result = accepted(state, action);
        state = result.state;
        events.push(...result.events);
      }

      return { state, events };
    };

    expect(run()).toEqual(run());
  });

  it("a refusal returns only the reason and leaves the state exactly as it was", () => {
    const state = stateWith({ A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }) });
    const before = JSON.stringify(state);
    const result = apply(
      deepFreeze(state),
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 },
      BENCH,
    );

    expect(result).toEqual({ rejected: "no-fan" });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("accepted actions hand back a new state and never share structure with the old one", () => {
    const before = fannedA();
    const { state } = accepted(before, { type: "moveConductor", end: "A", conductor: "blue", toIndex: 3 });

    expect(state).not.toBe(before);
    expect(state.ends.A.fan).not.toBe(before.ends.A.fan);
    expect(state.ends.B).not.toBe(before.ends.B);
    expect(state.ends.B).toEqual(before.ends.B);
  });
});

/* ============================================================
   EACH END'S STARTING ROW
   ============================================================ */

describe("each end's own starting row", () => {
  const ROW_A = ["white-brown", "brown", "blue", "white-blue", "white-orange", "orange", "white-green", "green"] as const;
  const ROW_B = ["white-green", "green", "white-orange", "orange", "white-brown", "brown", "blue", "white-blue"] as const;
  const perEnd: Scenario = { ...BENCH, fanOrder: { A: ROW_A, B: ROW_B } };

  const stripAndUntwist = (end: "A" | "B"): Action[] => [
    { type: "strip", end, amountMm: 30, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  ];

  it("fans each end into its own row", () => {
    const state = chain(stateWith({}), [...stripAndUntwist("A"), ...stripAndUntwist("B")], perEnd);

    expect(state.ends.A.fan).toEqual([...ROW_A]);
    expect(state.ends.B.fan).toEqual([...ROW_B]);
  });

  it("gives an end the scenario doesn't name the natural row, and one row still serves both", () => {
    const onlyA: Scenario = { ...BENCH, fanOrder: { A: ROW_A } };
    const partial = chain(stateWith({}), [...stripAndUntwist("A"), ...stripAndUntwist("B")], onlyA);

    expect(partial.ends.A.fan).toEqual([...ROW_A]);
    expect(partial.ends.B.fan).toEqual([...NATURAL_ORDER]);

    const shared: Scenario = { ...BENCH, fanOrder: ROW_B };
    const both = chain(stateWith({}), [...stripAndUntwist("A"), ...stripAndUntwist("B")], shared);

    expect(both.ends.A.fan).toEqual([...ROW_B]);
    expect(both.ends.B.fan).toEqual([...ROW_B]);
  });

  it("leaves every accepted cut flush — no conductor out, no fan, every pair twisted — whatever was there", () => {
    // What the bench relies on: an accepted cut is always a fresh section.
    const worked = [
      chain(stateWith({}), [{ type: "strip", end: "A", amountMm: 30, slot: "correct" }], perEnd),
      chain(stateWith({}), stripAndUntwist("A"), perEnd),
      chain(stateWith({}), [...stripAndUntwist("A"), { type: "trim", end: "A", leaveMm: 12 }], perEnd),
      chain(
        stateWith({}),
        [...stripAndUntwist("A"), { type: "trim", end: "A", leaveMm: 12 }, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 }],
        perEnd,
      ),
      stateWith({}),
    ];

    for (const before of worked) {
      for (const behind of [0, 5, 40]) {
        const result = apply(before, { type: "cut", end: "A", atMm: before.ends.A.jacketEdgeMm + behind }, perEnd);
        if ("rejected" in result) continue;

        const end = result.state.ends.A;
        expect(NATURAL_ORDER.every((c) => exposed(end, c) === 0)).toBe(true);
        expect(end.fan).toBeNull();
        expect(PAIR_IDS.every((pair) => !end.untwisted[pair])).toBe(true);
      }
    }
  });

  it("grades a cable arranged from each end's own row exactly as before", () => {
    const toT568B = (end: "A" | "B", fan: readonly string[]): Action[] => {
      const row = [...fan];
      return T568B.flatMap((conductor, toIndex): Action[] => {
        if (row.indexOf(conductor) === toIndex) return [];
        row.splice(row.indexOf(conductor), 1);
        row.splice(toIndex, 0, conductor);
        return [{ type: "moveConductor", end, conductor, toIndex }];
      });
    };
    const finish = (end: "A" | "B"): Action[] => [
      { type: "trim", end, leaveMm: 12 },
      { type: "insert", end, orientation: "contacts-up", pushMm: 99 },
      { type: "crimp", end, squeeze: "full" },
    ];

    const fanned = chain(stateWith({}), [...stripAndUntwist("A"), ...stripAndUntwist("B")], perEnd);
    const done = chain(
      fanned,
      [...toT568B("A", ROW_A), ...finish("A"), ...toT568B("B", ROW_B), ...finish("B")],
      perEnd,
    );

    expect(standardOf(pinsAt(done.ends.A))).toBe("T568B");
    expect(standardOf(pinsAt(done.ends.B))).toBe("T568B");
    expect(wiremap(done).verdict).toBe("straight");

    // Left as they fell, neither end is a standard and the cable is no good.
    const lazy = chain(fanned, [...finish("A"), ...finish("B")], perEnd);
    expect(standardOf(pinsAt(lazy.ends.A))).toBeNull();
    expect(wiremap(lazy).verdict).not.toBe("straight");
  });
});
