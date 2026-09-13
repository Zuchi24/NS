import { describe, expect, it } from "vitest";

import { MAX_STRIP_PASS, MIN_WORK, S1_PRACTICE, apply, createInitialState, toRecord } from "../model";
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
