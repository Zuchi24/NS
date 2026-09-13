import { describe, expect, it } from "vitest";

import { MIN_WORK, PAIR_IDS, S1_PRACTICE, apply, createInitialState, exposed } from "../model";
import type { Action, CableState, EndId, PairId } from "../model";
import { CY, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import {
  GRAB_MARGIN,
  MIN_GRAB,
  PAIR_GAP,
  PAIR_REACH,
  PAIR_RELEASE,
  openness,
  pairLift,
  pairRegions,
  pairRowY,
  pairUnder,
  pulledClear,
  pullAcross,
  travelAlong,
} from "./pairGeometry";

/**
 * Where the pairs are, and what pulling one means.
 *
 * Picture in, picture out. No expectation here says an untwist is or is not
 * allowed, because this file decides none of that: a pair that the model would
 * refuse to untwist is still a pair that can be taken hold of, and proving
 * that is one of the tests below.
 */

const start = () => createInitialState(S1_PRACTICE);

function after(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

/** End A stripped back, which is where S1 first has pairs to take hold of. */
function strippedA(amountMm = 30): CableState {
  return after([{ type: "strip", end: "A", amountMm, slot: "correct" }]);
}

/** End B cut off and stripped, so the far end has pairs of its own. */
function strippedB(): CableState {
  return after([
    { type: "cut", end: "B", atMm: 25 },
    { type: "strip", end: "B", amountMm: 25, slot: "correct" },
  ]);
}

const regionsOf = (cable: CableState, id: EndId) => pairRegions(id, cable.ends[id], benchScale(cable).scale);
const middleOf = (region: { x: number; y: number; width: number; height: number }) => ({
  x: region.x + region.width / 2,
  y: region.y + region.height / 2,
});

describe("the pairs there is something to take hold of", () => {
  it("offers nothing on an end with no conductor outside the jacket", () => {
    // S1's end A is a clean cut: the pairs are all still in the jacket.
    expect(regionsOf(start(), "A")).toEqual([]);
  });

  it("offers all four once the jacket is off, in the order they are drawn", () => {
    expect(regionsOf(strippedA(), "A").map((region) => region.pair)).toEqual([...PAIR_IDS]);
  });

  it("offers nothing on an end whose conductors are fanned flat", () => {
    const cable = after([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    ]);

    expect(cable.ends.A.fan).not.toBeNull();
    expect(regionsOf(cable, "A")).toEqual([]);
  });

  it("drops a pair from the list once it is open — there is no twist left to pull", () => {
    const cable = after([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "untwist", end: "A", pair: "orange" },
    ]);

    expect(regionsOf(cable, "A").map((region) => region.pair)).toEqual(["green", "blue", "brown"]);
  });

  it("offers pairs at either end, each on its own side of the bench", () => {
    const cable = strippedB();

    for (const region of regionsOf(cable, "B")) {
      expect(region.end).toBe("B");
      expect(region.x).toBeGreaterThan(WIDTH / 2);
    }
  });

  it("mirrors the two ends: each pair reaches out the way its conductors point", () => {
    const a = regionsOf(strippedA(25), "A");
    const b = regionsOf(strippedB(), "B");

    // End A's conductors point left, so its regions lie left of its jacket edge.
    expect(Math.min(...a.map((region) => region.x))).toBeLessThan(LAYOUT.A.x0);
    expect(Math.max(...b.map((region) => region.x + region.width))).toBeGreaterThan(LAYOUT.B.x0);
  });

  it("gives each pair its own row, with no two rows overlapping", () => {
    const rows = regionsOf(strippedA(), "A").map((region) => [region.y, region.y + region.height] as const);

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i][0]).toBeGreaterThanOrEqual(rows[i - 1][1] - 0.001);
    }
  });

  it("centres each row on the pair the bench draws there", () => {
    for (const region of regionsOf(strippedA(), "A")) {
      expect(region.y + region.height / 2).toBeCloseTo(pairRowY(region.index, CY));
      expect(region.height).toBe(PAIR_GAP);
    }
  });

  it("is forgiving: the region is wider than the conductor it is drawn round", () => {
    const cable = strippedA();
    const { scale } = benchScale(cable);
    const [orange] = regionsOf(cable, "A");
    const drawn = exposed(cable.ends.A, "orange") * scale;

    expect(orange.width).toBeGreaterThan(drawn);
    expect(orange.width).toBeCloseTo(drawn + 2 * GRAB_MARGIN);
  });

  it("keeps a short stub catchable, however little of it is drawn", () => {
    const cable = strippedA(2);

    for (const region of regionsOf(cable, "A")) {
      expect(region.width).toBeGreaterThanOrEqual(MIN_GRAB);
      // Widened outward, away from the body: end A's conductors point left.
      expect(region.x + region.width).toBeCloseTo(LAYOUT.A.x0 + GRAB_MARGIN);
    }
  });

  it("takes hold of a pair the model would refuse to untwist, and leaves the refusing to it", () => {
    // Too little exposed for the model to accept an untwist — but it is drawn,
    // so it can be taken hold of, and the model gets to say so itself.
    const cable = strippedA(MIN_WORK - 5);

    expect(exposed(cable.ends.A, "orange")).toBeLessThan(MIN_WORK);
    expect(regionsOf(cable, "A")).toHaveLength(4);
  });
});

describe("the pair under a hand", () => {
  const cable = strippedA();
  const { scale } = benchScale(cable);
  const at = (x: number, y: number) => pairUnder(x, y, cable, scale);
  const middleOfPair = (pair: PairId) => middleOf(regionsOf(cable, "A").find((region) => region.pair === pair)!);

  it("names the pair the hand closed on", () => {
    for (const pair of PAIR_IDS) {
      const point = middleOfPair(pair);

      expect(at(point.x, point.y)?.pair).toBe(pair);
    }
  });

  it("names the end the hand is on, not whichever end is selected", () => {
    // The R1 lesson, carried over: the drawing decides the target.
    const both = strippedB();
    const point = middleOf(regionsOf(both, "B")[0]);
    const found = pairUnder(point.x, point.y, both, benchScale(both).scale);

    expect(found?.end).toBe("B");
    expect(found?.end).not.toBe("A");
  });

  it("claims nothing over the jacket", () => {
    expect(at(LAYOUT.A.x0 + 60, CY)).toBeNull();
  });

  it("claims nothing over the stretch drawn out of scale", () => {
    expect(at(WIDTH / 2, CY)).toBeNull();
  });

  it("claims nothing on the shelf, where the tools lie", () => {
    expect(at(450, SHELF_TOP + 25)).toBeNull();
  });

  it("claims nothing above or below the bundle", () => {
    const point = middleOfPair("orange");

    expect(at(point.x, pairRowY(0, CY) - PAIR_GAP)).toBeNull();
    expect(at(point.x, pairRowY(3, CY) + PAIR_GAP)).toBeNull();
  });

  it("claims nothing out past the tips", () => {
    const point = middleOfPair("orange");
    const [orange] = regionsOf(cable, "A");

    expect(at(orange.x - 5, point.y)).toBeNull();
  });

  it("claims nothing at all on an end with nothing exposed", () => {
    const bare = start();

    expect(pairUnder(LAYOUT.A.x0 - 10, CY, bare, benchScale(bare).scale)).toBeNull();
  });
});

describe("pulling a pair away from the cable", () => {
  it("splits the hand's travel: across the cable is the pull, along it is not", () => {
    expect(pullAcross(40, -12)).toBe(-12);
    expect(travelAlong(40, -12)).toBe(40);
  });

  it("counts a pull across the cable once it is clear of its own row", () => {
    expect(pulledClear(0, PAIR_RELEASE)).toBe(true);
    expect(pulledClear(0, -PAIR_RELEASE)).toBe(true);
    expect(pulledClear(0, PAIR_RELEASE - 0.5)).toBe(false);
  });

  it("counts travel along the cable for nothing, however far it goes", () => {
    // Scenario C: sliding a hand along the cable is not an untwist.
    expect(pulledClear(400, 0)).toBe(false);
    expect(pulledClear(-400, 0)).toBe(false);
    expect(openness(400, 0)).toBe(0);
  });

  it("takes a drag that is mostly along the cable as travel, not as a pull", () => {
    expect(pulledClear(80, 12)).toBe(false);
    expect(pulledClear(12, 80)).toBe(true);
  });

  it("opens the pair only once it is out of the bundle, and never past fully open", () => {
    expect(openness(0, PAIR_RELEASE - 0.5)).toBe(0);
    expect(openness(0, PAIR_RELEASE)).toBeGreaterThan(0);
    expect(openness(0, PAIR_RELEASE * 2)).toBe(1);
    expect(openness(0, PAIR_RELEASE * 20)).toBe(1);
  });

  it("lets the pair follow the hand, up or down, as far as it can reach", () => {
    expect(pairLift(0, 10)).toBe(10);
    expect(pairLift(0, -10)).toBe(-10);
    expect(pairLift(0, 500)).toBe(PAIR_REACH);
    expect(pairLift(0, -500)).toBe(-PAIR_REACH);
  });

  it("moves the pair with the hand across the cable and not along it", () => {
    expect(pairLift(500, 6)).toBe(6);
  });
});
