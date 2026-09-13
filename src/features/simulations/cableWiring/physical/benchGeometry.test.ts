import { describe, expect, it } from "vitest";

import { S1_PRACTICE, apply, createInitialState } from "../model";
import type { Action, CableState } from "../model";
import {
  CY,
  DRAG_THRESHOLD_PX,
  HEIGHT,
  INWARD_PX,
  LAYOUT,
  OUTWARD_PX,
  SHELF_TOP,
  WIDTH,
  benchScale,
  endReachMm,
  endUnder,
  jacketRun,
  offsetMmAt,
  overBench,
  passedThreshold,
  stripMmAt,
  toUserSpace,
} from "./benchGeometry";

/**
 * The bench's arithmetic, on its own.
 *
 * Pointer position in, millimetres out. Every expectation here is geometry —
 * no test asserts that an action is or is not allowed, because this file
 * decides none of that.
 */

const start = () => createInitialState(S1_PRACTICE);

function after(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

describe("one scale for the whole bench", () => {
  it("takes the reach of whichever end reaches further", () => {
    // Both ends start inside the floor, so stripping A is what pulls them apart.
    const cable = after([{ type: "strip", end: "A", amountMm: 50, slot: "correct" }]);

    expect(endReachMm(cable.ends.A)).toBeGreaterThan(endReachMm(cable.ends.B));

    const { reachMm } = benchScale(cable);

    expect(reachMm).toBe(Math.max(endReachMm(cable.ends.A), endReachMm(cable.ends.B)));
  });

  it("holds a floor, so a bare end is not drawn at an absurd magnification", () => {
    const cable = start();

    // S1's raw end A and factory end B both sit under it.
    expect(endReachMm(cable.ends.A)).toBe(26);
    expect(endReachMm(cable.ends.B)).toBe(26);
  });

  it("gives both ends the same millimetre, whatever is on them", () => {
    // The point of the shared scale: 12 mm at end B is 12 mm at end A.
    const cable = after([{ type: "strip", end: "A", amountMm: 40, slot: "correct" }]);
    const { scale } = benchScale(cable);

    const atA = Math.abs(LAYOUT.A.x0 - (LAYOUT.A.x0 + LAYOUT.A.dir * 12 * scale));
    const atB = Math.abs(LAYOUT.B.x0 - (LAYOUT.B.x0 + LAYOUT.B.dir * 12 * scale));

    expect(atA).toBeCloseTo(atB);
  });

  it("zooms out as an end grows, and never past the cap", () => {
    const bare = benchScale(start()).scale;
    const stripped = benchScale(after([{ type: "strip", end: "A", amountMm: 60, slot: "correct" }])).scale;

    expect(stripped).toBeLessThan(bare);
    expect(bare).toBeLessThanOrEqual(6);
    expect(stripped).toBeGreaterThan(0);
  });

  it("keeps the longest end inside the room it has", () => {
    const cable = after([{ type: "strip", end: "A", amountMm: 70, slot: "correct" }]);
    const { scale, reachMm } = benchScale(cable);

    expect(reachMm * scale).toBeLessThanOrEqual(OUTWARD_PX + 0.001);
  });
});

describe("a pointer's position in the drawing's units", () => {
  const rect = { left: 100, top: 50, width: 500, height: 500 * (HEIGHT / WIDTH) };

  it("maps the drawing's corners to its own corners", () => {
    expect(toUserSpace(100, 50, rect)).toEqual({ x: 0, y: 0 });

    const far = toUserSpace(600, 50 + rect.height, rect);

    expect(far.x).toBeCloseTo(WIDTH);
    expect(far.y).toBeCloseTo(HEIGHT);
  });

  it("survives a drawing with no size rather than dividing by it", () => {
    expect(toUserSpace(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("millimetres from a point on the cable", () => {
  const scale = 6;

  it("reads zero at the jacket edge, at either end", () => {
    expect(offsetMmAt(LAYOUT.A.x0, "A", scale)).toBeCloseTo(0);
    expect(offsetMmAt(LAYOUT.B.x0, "B", scale)).toBeCloseTo(0);
  });

  it("counts outward of the edge as positive, inward as negative — mirrored per end", () => {
    // End A's conductors point left, end B's point right.
    expect(offsetMmAt(LAYOUT.A.x0 - 10 * scale, "A", scale)).toBeCloseTo(10);
    expect(offsetMmAt(LAYOUT.A.x0 + 10 * scale, "A", scale)).toBeCloseTo(-10);
    expect(offsetMmAt(LAYOUT.B.x0 + 10 * scale, "B", scale)).toBeCloseTo(10);
    expect(offsetMmAt(LAYOUT.B.x0 - 10 * scale, "B", scale)).toBeCloseTo(-10);
  });

  it("takes the jacket the stripper is standing on, in whole millimetres", () => {
    expect(stripMmAt(LAYOUT.A.x0 + 30 * scale, "A", scale)).toBe(30);
    expect(stripMmAt(LAYOUT.B.x0 - 30 * scale, "B", scale)).toBe(30);
  });

  it("rounds to the nearest millimetre", () => {
    expect(stripMmAt(LAYOUT.A.x0 + 30.4 * scale, "A", scale)).toBe(30);
    expect(stripMmAt(LAYOUT.A.x0 + 30.6 * scale, "A", scale)).toBe(31);
  });

  it("takes nothing when the stripper is outward of the jacket edge", () => {
    // There is no jacket out there to take.
    expect(stripMmAt(LAYOUT.A.x0 - 20 * scale, "A", scale)).toBe(0);
    expect(stripMmAt(LAYOUT.B.x0 + 20 * scale, "B", scale)).toBe(0);
  });

  it("puts no ceiling on the distance — how much is too much is the model's call", () => {
    expect(stripMmAt(LAYOUT.A.x0 + 500 * scale, "A", scale)).toBe(500);
  });

  it("reads the same millimetres at any scale", () => {
    for (const s of [2, 3.7, 6]) {
      expect(stripMmAt(LAYOUT.A.x0 + 25 * s, "A", s)).toBe(25);
    }
  });
});

describe("which end the tool is standing on", () => {
  it("gives each end the run of mat its jacket is drawn over", () => {
    expect(jacketRun("A")).toEqual([LAYOUT.A.x0, LAYOUT.A.x0 + INWARD_PX]);
    expect(jacketRun("B")).toEqual([LAYOUT.B.x0 - INWARD_PX, LAYOUT.B.x0]);
  });

  it("names the end whose jacket is under the tool", () => {
    expect(endUnder(LAYOUT.A.x0 + 10, CY)).toBe("A");
    expect(endUnder(LAYOUT.B.x0 - 10, CY)).toBe("B");
  });

  it("names no end over the stretch drawn out of scale", () => {
    // Between the two jacket runs the cable is not to scale, so no distance
    // measured there would mean anything.
    expect(endUnder(WIDTH / 2, CY)).toBeNull();
  });

  it("names no end out where the conductors are — there is no jacket to take", () => {
    expect(endUnder(LAYOUT.A.x0 - 40, CY)).toBeNull();
    expect(endUnder(LAYOUT.B.x0 + 40, CY)).toBeNull();
  });

  it("names no end on the shelf, so reaching for a tool picks no end", () => {
    // Both tools lie in the middle of the shelf; neither is over a jacket run.
    for (const toolX of [450, 550]) {
      expect(endUnder(toolX, SHELF_TOP + 25)).toBeNull();
      expect(endUnder(toolX, CY)).toBeNull();
    }
  });

  it("never claims an end the tool is not over", () => {
    // The bug this replaced: a tool on end B reading a distance from end A.
    const onB = LAYOUT.B.x0 - 30;

    expect(endUnder(onB, CY)).not.toBe("A");
  });
});

describe("the shelf and the cable", () => {
  it("counts the cable area as the bench, and the shelf as not", () => {
    expect(overBench(CY)).toBe(true);
    expect(overBench(SHELF_TOP - 1)).toBe(true);
    expect(overBench(SHELF_TOP)).toBe(false);
    expect(overBench(SHELF_TOP + 30)).toBe(false);
  });

  it("leaves room on the shelf for a tool to be picked up", () => {
    expect(HEIGHT).toBeGreaterThan(SHELF_TOP);
  });
});

describe("the drag threshold", () => {
  it("lets a still pointer be a click", () => {
    expect(passedThreshold(0, 0)).toBe(false);
    expect(passedThreshold(2, 2)).toBe(false);
  });

  it("counts travel in any direction, not just along the cable", () => {
    expect(passedThreshold(DRAG_THRESHOLD_PX, 0)).toBe(true);
    expect(passedThreshold(0, -DRAG_THRESHOLD_PX)).toBe(true);
    expect(passedThreshold(-3, -3)).toBe(true);
  });
});
