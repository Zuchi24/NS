import { describe, expect, it } from "vitest";

import { MAX_STRIP_PASS, MIN_WORK, PAIR_IDS, S1_PRACTICE, apply, createInitialState, toRecord } from "../model";
import type { Action, CableState, SimEvent } from "../model";
import { dryRun } from "./dryRun";

/**
 * Asking the model, rather than answering for it.
 *
 * Each expectation below is checked against apply() itself in the same test,
 * so these say "the dry run agrees with the model" rather than restating any
 * limit. The numbers that do appear are the model's own constants, named.
 */

const start = () => createInitialState(S1_PRACTICE);

describe("the dry run", () => {
  it("agrees with apply(), whatever apply() says", () => {
    const cable = start();

    for (const amountMm of [0, 1, MIN_WORK, MAX_STRIP_PASS, MAX_STRIP_PASS + 1, 900]) {
      const action = { type: "strip", end: "A", amountMm, slot: "correct" } as const;
      const real = apply(cable, action, S1_PRACTICE);
      const asked = dryRun(cable, action, S1_PRACTICE);

      expect(asked.ok).toBe(!("rejected" in real));
      if ("rejected" in real && !asked.ok) expect(asked.reason).toBe(real.rejected);
    }
  });

  it("hands back the model's own reason, not one of its own", () => {
    // End B arrives with a plug on it, so the model refuses to strip under it.
    const asked = dryRun(start(), { type: "strip", end: "B", amountMm: 20, slot: "correct" }, S1_PRACTICE);

    expect(asked).toEqual({ ok: false, reason: "plug-present" });
  });

  it("leaves the cable exactly as it was", () => {
    const cable = start();
    const before = JSON.stringify(toRecord(cable));

    dryRun(cable, { type: "strip", end: "A", amountMm: 30, slot: "too-deep" }, S1_PRACTICE);
    dryRun(cable, { type: "cut", end: "A", atMm: 40 }, S1_PRACTICE);

    expect(JSON.stringify(toRecord(cable))).toBe(before);
  });

  it("says nothing about a mistake that the model allows", () => {
    // The wrong jaw is not refused — it goes through and scores the
    // insulation. A dry run must not turn that into a refusal.
    const asked = dryRun(start(), { type: "strip", end: "A", amountMm: 30, slot: "too-deep" }, S1_PRACTICE);

    expect(asked.ok).toBe(true);
  });

  it("can be asked over and over without drifting", () => {
    const cable = start();
    const action = { type: "strip", end: "A", amountMm: 30, slot: "correct" } as const;

    const answers = Array.from({ length: 5 }, () => dryRun(cable, action, S1_PRACTICE));

    expect(answers.every((answer) => answer.ok)).toBe(true);
  });
});

function chain(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

/** End A stripped, fanned flat and trimmed to 12 mm: a plug can go on it. */
const readyA = () =>
  chain([
    { type: "strip", end: "A", amountMm: 30, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    { type: "trim", end: "A", leaveMm: 12 },
  ]);

const insertA = (pushMm: number): Action => ({ type: "insert", end: "A", orientation: "contacts-down", pushMm });

/** The seat an accepted insert reports, read off the events alone. */
const seatsIn = (events: SimEvent[]) => events.flatMap((event) => (event.type === "inserted" ? [event.jacketInMm] : []));

describe("what the dry run hands back when the model accepts", () => {
  it("the very events apply() produces", () => {
    const cable = start();
    const actions: Action[] = [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "strip", end: "A", amountMm: 30, slot: "too-deep" },
      { type: "cut", end: "A", atMm: 40 },
    ];

    for (const action of actions) {
      const real = apply(cable, action, S1_PRACTICE);
      if ("rejected" in real) throw new Error(`model refused ${action.type}`);

      expect(dryRun(cable, action, S1_PRACTICE)).toEqual({ ok: true, events: real.events });
    }
  });

  it("an insert's own inserted event, seated where apply() seats it", () => {
    const cable = readyA();
    const real = apply(cable, insertA(5), S1_PRACTICE);
    if ("rejected" in real) throw new Error("model refused insert");

    const asked = dryRun(cable, insertA(5), S1_PRACTICE);
    const inserted = asked.ok ? asked.events.filter((event) => event.type === "inserted") : [];

    expect(inserted).toEqual(real.events.filter((event) => event.type === "inserted"));
    expect(asked.ok ? seatsIn(asked.events) : []).toEqual([real.state.ends.A.plug!.jacketInMm]);
  });

  it("the model's own clamped seat when the push asked for is not where the plug stops", () => {
    const cable = readyA();

    for (const pushMm of [10, 40, -40]) {
      const real = apply(cable, insertA(pushMm), S1_PRACTICE);
      if ("rejected" in real) throw new Error("model refused insert");

      const asked = dryRun(cable, insertA(pushMm), S1_PRACTICE);
      const seat = asked.ok ? seatsIn(asked.events) : [];

      expect(seat).toEqual([real.state.ends.A.plug!.jacketInMm]);
      // Each of these really was moved by the model, not handed back as asked.
      expect(seat[0]).not.toBe(pushMm);
    }
  });

  it("still refuses exactly as the model does, and carries no events when it does", () => {
    const empty: CableState = { ...readyA(), tray: { plugs: 0 } };
    const cases: [CableState, Action][] = [
      [start(), insertA(5)],
      [start(), { type: "insert", end: "B", orientation: "contacts-up", pushMm: 5 }],
      [empty, insertA(5)],
    ];

    for (const [cable, action] of cases) {
      const real = apply(cable, action, S1_PRACTICE);
      if (!("rejected" in real)) throw new Error("expected the model to refuse");

      expect(dryRun(cable, action, S1_PRACTICE)).toEqual({ ok: false, reason: real.rejected });
    }

    expect(cases.map(([cable, action]) => (dryRun(cable, action, S1_PRACTICE) as { reason: string }).reason)).toEqual([
      "no-fan",
      "plug-present",
      "tray-empty",
    ]);
  });

  it("leaves the cable and its tray exactly as they were after asking about an insert", () => {
    const cable = readyA();
    const before = JSON.stringify(cable);

    dryRun(cable, insertA(10), S1_PRACTICE);

    expect(JSON.stringify(cable)).toBe(before);
    expect(cable.tray.plugs).toBe(S1_PRACTICE.plugs);
  });
});
