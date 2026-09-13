import { describe, expect, it } from "vitest";

import { NATURAL_ORDER, PAIR_IDS, S1_PRACTICE, apply, createInitialState, exposed } from "../model";
import type { Action, CableState, Conductor, EndId } from "../model";
import { CY, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import {
  GRAB_MARGIN,
  LANE_COUNT,
  LANE_GAP,
  conductorRegions,
  conductorUnder,
  insertionAt,
  laneY,
  liftedRow,
  rowBounds,
} from "./conductorGeometry";

/**
 * Where the eight conductors of a fanned end are, and what taking one out of
 * the row and offering it to a lane means.
 *
 * Picture in, picture out. Nothing here asserts that a move is or is not
 * allowed, and nothing here knows what order the row is meant to end up in —
 * this file decides neither. The one thing it does prove about the model is
 * that the row it draws while a conductor is in hand is the row apply() would
 * actually leave behind.
 */

const start = () => createInitialState(S1_PRACTICE);

function after(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

/** End A stripped and fanned — the first point in S1 where a row exists. */
function fannedA(amountMm = 30): CableState {
  return after([
    { type: "strip", end: "A", amountMm, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  ]);
}

const regionsOf = (cable: CableState, id: EndId) =>
  conductorRegions(id, cable.ends[id], benchScale(cable).scale);

const middleOf = (region: { x: number; y: number; width: number; height: number }) => ({
  x: region.x + region.width / 2,
  y: region.y + region.height / 2,
});

describe("the conductors there is something to take hold of", () => {
  it("offers nothing on an end whose pairs are still twisted", () => {
    // Nothing is in a row yet, so there is no row to move anything along.
    expect(regionsOf(after([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]), "A")).toEqual([]);
  });

  it("offers all eight once the end is fanned, in the order they are drawn", () => {
    const cable = fannedA();

    expect(regionsOf(cable, "A").map((region) => region.conductor)).toEqual(cable.ends.A.fan);
  });

  it("offers the conductors under a plug too, and leaves the refusing to the model", () => {
    // S1's end B arrives terminated. The wires are still drawn, so they can
    // still be taken hold of; the model is what knows about the plug.
    const cable = start();

    expect(cable.ends.B.plug).not.toBeNull();
    expect(regionsOf(cable, "B")).toHaveLength(8);
  });

  it("offers nothing on an end with no conductor outside the jacket", () => {
    expect(regionsOf(start(), "A")).toEqual([]);
  });

  it("gives each conductor its own lane, tiled with no gap and no overlap", () => {
    const rows = regionsOf(fannedA(), "A").map((region) => [region.y, region.y + region.height] as const);

    for (let i = 1; i < rows.length; i++) expect(rows[i][0]).toBeCloseTo(rows[i - 1][1]);
    expect(rows).toHaveLength(LANE_COUNT);
  });

  it("centres each lane on the conductor the bench draws there", () => {
    for (const region of regionsOf(fannedA(), "A")) {
      expect(region.y + region.height / 2).toBeCloseTo(laneY(region.index, CY));
      expect(region.height).toBe(LANE_GAP);
    }
  });

  it("is forgiving: the region reaches past the conductor it is drawn round", () => {
    const cable = fannedA();
    const { scale } = benchScale(cable);
    const [first] = regionsOf(cable, "A");
    const drawn = exposed(cable.ends.A, cable.ends.A.fan![0]) * scale;

    expect(first.width).toBeCloseTo(drawn + 2 * GRAB_MARGIN);
  });

  it("mirrors the two ends: each row reaches out the way its conductors point", () => {
    const cable = fannedA(25);

    expect(Math.min(...regionsOf(cable, "A").map((r) => r.x))).toBeLessThan(LAYOUT.A.x0);
    expect(Math.max(...regionsOf(cable, "B").map((r) => r.x + r.width))).toBeGreaterThan(LAYOUT.B.x0);
  });
});

describe("the conductor under a hand", () => {
  const cable = fannedA();
  const { scale } = benchScale(cable);
  const at = (x: number, y: number) => conductorUnder(x, y, cable, scale);

  it("names the conductor the hand closed on, lane by lane", () => {
    for (const region of regionsOf(cable, "A")) {
      const point = middleOf(region);

      expect(at(point.x, point.y)?.conductor).toBe(region.conductor);
    }
  });

  it("names the end the hand is on, not whichever end is selected", () => {
    const point = middleOf(regionsOf(cable, "B")[0]);
    const found = at(point.x, point.y);

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

  it("claims nothing above or below the row", () => {
    const point = middleOf(regionsOf(cable, "A")[0]);

    expect(at(point.x, laneY(0, CY) - LANE_GAP)).toBeNull();
    expect(at(point.x, laneY(LANE_COUNT - 1, CY) + LANE_GAP)).toBeNull();
  });

  it("claims nothing out past the tips", () => {
    const [first] = regionsOf(cable, "A");

    expect(at(first.x - 5, middleOf(first).y)).toBeNull();
  });
});

describe("the lane a conductor is being offered to", () => {
  const cable = fannedA();
  const { scale } = benchScale(cable);
  const end = cable.ends.A;
  const offer = (x: number, y: number) => insertionAt(x, y, "A", end, scale);
  const overRow = middleOf(regionsOf(cable, "A")[0]).x;

  it("names the lane the hand is over", () => {
    for (let index = 0; index < LANE_COUNT; index++) {
      expect(offer(overRow, laneY(index, CY))).toBe(index);
    }
  });

  it("names the first lane at the top of the row and the last at the bottom", () => {
    const bounds = rowBounds("A", end, scale, CY)!;

    expect(offer(overRow, bounds.y + 0.5)).toBe(0);
    expect(offer(overRow, bounds.y + bounds.height - 0.5)).toBe(LANE_COUNT - 1);
  });

  it("takes the nearer lane on either side of a boundary", () => {
    const boundary = (laneY(2, CY) + laneY(3, CY)) / 2;

    expect(offer(overRow, boundary - 0.6)).toBe(2);
    expect(offer(overRow, boundary + 0.6)).toBe(3);
  });

  it("offers nothing above or below the row", () => {
    const bounds = rowBounds("A", end, scale, CY)!;

    expect(offer(overRow, bounds.y - 1)).toBeNull();
    expect(offer(overRow, bounds.y + bounds.height + 1)).toBeNull();
  });

  it("offers nothing off either end of the row", () => {
    const bounds = rowBounds("A", end, scale, CY)!;

    expect(offer(bounds.x - 1, CY)).toBeNull();
    expect(offer(bounds.x + bounds.width + 1, CY)).toBeNull();
  });

  it("offers nothing at all on an end with no row", () => {
    const bare = start();

    expect(insertionAt(LAYOUT.A.x0 - 10, CY, "A", bare.ends.A, benchScale(bare).scale)).toBeNull();
    expect(rowBounds("A", bare.ends.A, benchScale(bare).scale, CY)).toBeNull();
  });

  it("never names a lane the model would not recognise", () => {
    const bounds = rowBounds("A", end, scale, CY)!;

    for (let y = bounds.y; y <= bounds.y + bounds.height; y += 0.5) {
      const index = offer(overRow, y);

      expect(index).not.toBeNull();
      expect(Number.isInteger(index)).toBe(true);
      expect(index!).toBeGreaterThanOrEqual(0);
      expect(index!).toBeLessThan(LANE_COUNT);
    }
  });
});

describe("the row while a conductor is out of it", () => {
  const fan = [...NATURAL_ORDER] as Conductor[];

  it("leaves the rest where they were while no lane is being offered", () => {
    const { lanes, slot } = liftedRow(fan, fan[2], null);

    expect(slot).toBeNull();
    for (const conductor of fan) {
      if (conductor === fan[2]) expect(lanes.has(conductor)).toBe(false);
      else expect(lanes.get(conductor)).toBe(fan.indexOf(conductor));
    }
  });

  it("holds the offered lane open and slides the rest over", () => {
    const { lanes, slot } = liftedRow(fan, fan[0], 3);

    expect(slot).toBe(3);
    // The three that were behind it move up one; the rest stay put.
    expect(lanes.get(fan[1])).toBe(0);
    expect(lanes.get(fan[2])).toBe(1);
    expect(lanes.get(fan[3])).toBe(2);
    expect(lanes.get(fan[4])).toBe(4);
    expect([...lanes.values()]).not.toContain(3);
  });

  it("holds the first and last lanes open just the same", () => {
    expect(liftedRow(fan, fan[5], 0).lanes.get(fan[0])).toBe(1);
    expect(liftedRow(fan, fan[5], 7).lanes.get(fan[7])).toBe(6);
  });

  it("holds open the lane it came from when it is offered back to it", () => {
    const { lanes, slot } = liftedRow(fan, fan[4], 4);

    expect(slot).toBe(4);
    for (const conductor of fan) {
      if (conductor !== fan[4]) expect(lanes.get(conductor)).toBe(fan.indexOf(conductor));
    }
  });

  it("draws the row the model's own move would leave behind", () => {
    // The whole point of the preview: what is shown while the hand is down is
    // what apply() produces when it opens.
    const cable = fannedA();
    const before = cable.ends.A.fan!;

    for (const conductor of before) {
      for (let toIndex = 0; toIndex < LANE_COUNT; toIndex++) {
        const result = apply(cable, { type: "moveConductor", end: "A", conductor, toIndex }, S1_PRACTICE);
        if ("rejected" in result) continue;

        const { lanes, slot } = liftedRow(before, conductor, toIndex);
        const settled = result.state.ends.A.fan!;

        expect(settled[slot!]).toBe(conductor);
        for (const [other, lane] of lanes) expect(settled[lane]).toBe(other);
      }
    }
  });
});
