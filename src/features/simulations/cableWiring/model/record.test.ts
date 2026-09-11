import { describe, expect, it } from "vitest";

import { apply, createInitialState } from "./apply";
import { NATURAL_ORDER, PAIR_IDS, T568A, T568B } from "./constants";
import { makeEnd, rawEnd, uniformTips } from "./geometry";
import { toRecord } from "./record";
import { S1_PRACTICE } from "./scenarios";
import type { Action, CableEnd, CableState, Conductor } from "./types";

/**
 * The cable/1 record: exactly the whitelisted physical fields, deterministic,
 * and nothing derived.
 */

function G(fan: readonly Conductor[]): CableEnd {
  return makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" } });
}

function cable(A: CableEnd, B: CableEnd, extra: Partial<CableState> = {}): CableState {
  return { ends: { A, B }, tray: { plugs: 2 }, connections: {}, ...extra };
}

describe("toRecord", () => {
  it("F01: writes the physical termination and nothing else", () => {
    expect(toRecord(cable(G(T568B), G(T568B)))).toEqual({
      schema: "cable/1",
      ends: {
        A: {
          jacket_edge_mm: 30,
          tip_mm: uniformTips(18),
          fan: [...T568B],
          plug: { orientation: "contacts-up", jacket_in_mm: 9, crimp: "full" },
          nicks_at_mm: [],
        },
        B: {
          jacket_edge_mm: 30,
          tip_mm: uniformTips(18),
          fan: [...T568B],
          plug: { orientation: "contacts-up", jacket_in_mm: 9, crimp: "full" },
          nicks_at_mm: [],
        },
      },
      connections: {},
    });
  });

  it("carries exactly the whitelisted keys at every level", () => {
    const record = toRecord(cable(G(T568B), rawEnd(0), { connections: { A: "tester-main" } }));

    expect(Object.keys(record)).toEqual(["schema", "ends", "connections"]);
    expect(Object.keys(record.ends)).toEqual(["A", "B"]);
    expect(Object.keys(record.ends.A)).toEqual(["jacket_edge_mm", "tip_mm", "fan", "plug", "nicks_at_mm"]);
    expect(Object.keys(record.ends.A.plug!)).toEqual(["orientation", "jacket_in_mm", "crimp"]);
    expect(Object.keys(record.ends.A.tip_mm)).toEqual([...NATURAL_ORDER]);
    expect(record.connections).toEqual({ A: "tester-main" });
  });

  it("never carries model-only or derived state", () => {
    const json = JSON.stringify(toRecord(cable(G(T568B), G(T568A), { connections: { A: "tester-main", B: "tester-remote" } })));

    for (const forbidden of [
      "untwisted", "tray", "plugs", "map", "pattern", "verdict", "classification", "standard",
      "passed", "tester", "log", "startLength", "start_length", "endpoints", "require", "defects",
    ]) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
  });

  it("writes a raw end with no fan and no plug", () => {
    expect(toRecord(cable(rawEnd(0), rawEnd(0))).ends.A).toEqual({
      jacket_edge_mm: 0,
      tip_mm: uniformTips(0),
      fan: null,
      plug: null,
      nicks_at_mm: [],
    });
  });

  it("F23: normalises nicks — an inactive one is dropped", () => {
    const recovered = makeEnd({
      jacketEdgeMm: 60,
      tipMm: 48,
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
      nicksAtMm: [30],
    });

    expect(toRecord(cable(recovered, G(T568B))).ends.A.nicks_at_mm).toEqual([]);
  });

  it("F21: keeps an active nick, sorted and de-duplicated", () => {
    const nicked = makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, nicksAtMm: [30, 25, 30] });

    expect(toRecord(cable(nicked, G(T568B))).ends.A.nicks_at_mm).toEqual([25, 30]);
  });

  it("is deterministic whatever order the state was assembled in", () => {
    const tips = Object.fromEntries([...NATURAL_ORDER].reverse().map((c) => [c, 18])) as Record<Conductor, number>;
    const shuffled: CableState = {
      connections: { B: "tester-remote", A: "tester-main" },
      tray: { plugs: 2 },
      ends: {
        B: G(T568B),
        A: { ...G(T568B), tipMm: tips },
      },
    };
    const ordered = cable(G(T568B), G(T568B), { connections: { A: "tester-main", B: "tester-remote" } });

    expect(JSON.stringify(toRecord(shuffled))).toBe(JSON.stringify(toRecord(ordered)));
  });

  it("does not alias the state it was built from", () => {
    const state = cable(G(T568B), G(T568B));
    const record = toRecord(state);

    record.ends.A.fan![0] = "brown";
    record.ends.A.tip_mm.brown = 0;

    expect(state.ends.A.fan![0]).toBe("white-orange");
    expect(state.ends.A.tipMm.brown).toBe(18);
  });

  it("records a finished S1 practice cable from real actions", () => {
    const actions: Action[] = [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "moveConductor", end: "A", conductor: "blue", toIndex: 3 },
      { type: "moveConductor", end: "A", conductor: "green", toIndex: 5 },
      { type: "trim", end: "A", leaveMm: 12 },
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: 99 },
      { type: "crimp", end: "A", squeeze: "full" },
      { type: "connect", end: "A", endpoint: "tester-main" },
    ];

    const finished = actions.reduce((state, action) => {
      const result = apply(state, action, S1_PRACTICE);
      if ("rejected" in result) throw new Error(result.rejected);

      return result.state;
    }, createInitialState(S1_PRACTICE));

    const record = toRecord(finished);

    expect(record.ends.A).toEqual({
      jacket_edge_mm: 30,
      tip_mm: uniformTips(18),
      fan: [...T568B],
      plug: { orientation: "contacts-up", jacket_in_mm: 9, crimp: "full" },
      nicks_at_mm: [],
    });
    expect(record.ends.B).toEqual({
      jacket_edge_mm: 12,
      tip_mm: uniformTips(0),
      fan: [...T568B],
      plug: { orientation: "contacts-up", jacket_in_mm: 9, crimp: "full" },
      nicks_at_mm: [],
    });
    expect(record.connections).toEqual({ A: "tester-main" });
  });
});
