import { describe, expect, it } from "vitest";

import { T568B, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableState } from "../model";
import { beginnerHint } from "./hints";
import { PRACTICE_BENCH } from "./setup";

/**
 * Beginner hints follow the physical progress and never judge the work.
 */

const scenario = PRACTICE_BENCH.scenario;

function after(actions: Action[], state: CableState = createInitialState(scenario)): CableState {
  return actions.reduce((current, action) => {
    const result = apply(current, action, scenario);
    if ("rejected" in result) throw new Error(result.rejected);

    return result.state;
  }, state);
}

const fannedA = () =>
  after([
    { type: "strip", end: "A", amountMm: 30, slot: "correct" },
    ...["orange", "green", "blue", "brown"].map((pair): Action => ({ type: "untwist", end: "A", pair: pair as "blue" })),
  ]);

describe("beginnerHint", () => {
  it("only helps beginners", () => {
    expect(beginnerHint(createInitialState(scenario), { ...PRACTICE_BENCH, difficulty: "intermediate" })).toBeNull();
  });

  it("walks end A through strip, untwist, then arrange-trim-insert", () => {
    expect(beginnerHint(createInitialState(scenario), PRACTICE_BENCH)).toMatchObject({ end: "A", tools: ["strip"] });

    const stripped = after([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
    expect(beginnerHint(stripped, PRACTICE_BENCH)).toMatchObject({ tools: ["untwist"] });
    expect(beginnerHint(stripped, PRACTICE_BENCH)!.text).toContain("0 of 4");

    expect(beginnerHint(fannedA(), PRACTICE_BENCH)).toMatchObject({ tools: ["arrange", "trim", "insert"] });
    expect(beginnerHint(fannedA(), PRACTICE_BENCH)!.text).toContain("T568B");
  });

  it("names the colour order from assist.reference only, and none without it", () => {
    const withA = beginnerHint(fannedA(), { ...PRACTICE_BENCH, assist: { reference: { A: "T568A", B: "T568A" } } })!;
    const without = beginnerHint(fannedA(), { ...PRACTICE_BENCH, assist: null })!;

    expect(withA.text).toContain("into T568A order");
    expect(without.text).toContain("into the objective's order");
    expect(without.text).not.toMatch(/T568/);
    expect(without.tools).toEqual(withA.tools);
  });

  it("says the same thing whether the wires are right or wrong — it does not grade", () => {
    const base = createInitialState(scenario);
    const plugged = (fan: readonly string[]): CableState => ({
      ...base,
      ends: {
        ...base.ends,
        A: makeEnd({
          jacketEdgeMm: 30,
          tipMm: 18,
          fan: fan as typeof T568B[number][],
          plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "none" },
        }),
      },
    });

    const right = beginnerHint(plugged(T568B), PRACTICE_BENCH);
    const wrong = beginnerHint(plugged([...T568B].reverse()), PRACTICE_BENCH);

    expect(right).toEqual(wrong);
  });

  it("asks for a full squeeze after a partial crimp", () => {
    const base = createInitialState(scenario);
    const partial: CableState = {
      ...base,
      ends: {
        ...base.ends,
        A: makeEnd({ jacketEdgeMm: 30, tipMm: 18, fan: T568B, plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "partial" } }),
      },
    };

    expect(beginnerHint(partial, PRACTICE_BENCH)).toMatchObject({ tools: ["crimp"] });
  });

  it("points at the tester once both ends are crimped", () => {
    const base = createInitialState(scenario);
    const done: CableState = { ...base, ends: { ...base.ends, A: base.ends.B } };

    expect(beginnerHint(done, PRACTICE_BENCH)).toMatchObject({ end: null, tools: ["connect"] });
  });

  it("does not change the state it reads", () => {
    const state = createInitialState(scenario);
    const before = JSON.stringify(state);
    beginnerHint(state, PRACTICE_BENCH);

    expect(JSON.stringify(state)).toBe(before);
  });
});
