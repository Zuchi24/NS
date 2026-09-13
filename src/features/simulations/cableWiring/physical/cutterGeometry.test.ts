import { describe, expect, it } from "vitest";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, maxExposed } from "../model";
import type { Action, CableState, EndId } from "../model";
import { CY, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import { FIELD_REACH_MM, bladeXAt, conductorField, cutterTarget, leaveMmAt } from "./cutterGeometry";

/**
 * Where the cutters are standing, and what a cut there would leave.
 *
 * Picture in, millimetres out. No expectation here says a cut is or is not
 * allowed, and none says a length is right: this file decides neither. What it
 * does prove is that what comes out is the model's own quantity — whole
 * millimetres of conductor beyond the jacket edge, on the bench's one scale —
 * and never a distance measured in the drawing's pixels.
 */

const start = () => createInitialState(S1_PRACTICE);

function after(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

/** End A stripped: bare conductor, still bunched in its pairs. */
const strippedA = (amountMm = 30) => after([{ type: "strip", end: "A", amountMm, slot: "correct" }]);

/** End A stripped and fanned flat. */
const fannedA = (amountMm = 30) =>
  after([
    { type: "strip", end: "A", amountMm, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  ]);

const fieldOf = (cable: CableState, id: EndId) => conductorField(id, cable.ends[id], benchScale(cable).scale);

/** The point the cutters stand on to leave this much conductor on this end. */
function standingAt(cable: CableState, id: EndId, leaveMm: number, y: number = CY) {
  const { x0, dir } = LAYOUT[id];

  return { x: x0 + dir * leaveMm * benchScale(cable).scale, y };
}

describe("the conductor the cutters can close on", () => {
  it("finds nothing on an end with no conductor out of the jacket", () => {
    expect(fieldOf(start(), "A")).toBeNull();
  });

  it("finds the bare conductor once the jacket is off", () => {
    const cable = strippedA();

    expect(fieldOf(cable, "A")?.reachMm).toBe(maxExposed(cable.ends.A));
  });

  it("finds the conductor under a plug too, and leaves the refusing to the model", () => {
    // S1's end B arrives terminated. The conductors are drawn, so the cutters
    // can be stood on them; the model is what knows about the plug.
    const cable = start();

    expect(cable.ends.B.plug).not.toBeNull();
    expect(fieldOf(cable, "B")).not.toBeNull();
  });

  it("reaches from the jacket edge out past the tips", () => {
    const cable = strippedA();
    const { scale } = benchScale(cable);
    const field = fieldOf(cable, "A")!;
    const reach = field.reachMm + FIELD_REACH_MM;

    // End A's conductors point left, so its field lies left of the jacket edge.
    expect(field.x + field.width).toBeCloseTo(LAYOUT.A.x0);
    expect(field.width).toBeCloseTo(reach * scale);
  });

  it("mirrors the two ends", () => {
    const cable = strippedA();

    expect(fieldOf(cable, "A")!.x).toBeLessThan(LAYOUT.A.x0);
    expect(fieldOf(cable, "B")!.x + fieldOf(cable, "B")!.width).toBeGreaterThan(LAYOUT.B.x0);
  });

  it("is as tall as the conductors are drawn, bunched or fanned", () => {
    const bunched = fieldOf(strippedA(), "A")!;
    const fanned = fieldOf(fannedA(), "A")!;

    // Both cover the cable's centre line and a band either side of it.
    for (const field of [bunched, fanned]) {
      expect(field.y).toBeLessThan(CY);
      expect(field.y + field.height).toBeGreaterThan(CY);
      expect(field.height).toBeGreaterThan(50);
    }
  });
});

describe("how much conductor a cut would leave", () => {
  const cable = strippedA();
  const { scale } = benchScale(cable);

  it("reads nothing at the jacket edge, at either end", () => {
    expect(leaveMmAt(LAYOUT.A.x0, "A", scale)).toBe(0);
    expect(leaveMmAt(LAYOUT.B.x0, "B", scale)).toBe(0);
  });

  it("reads the distance outward of the edge, mirrored per end", () => {
    expect(leaveMmAt(LAYOUT.A.x0 - 18 * scale, "A", scale)).toBe(18);
    expect(leaveMmAt(LAYOUT.B.x0 + 18 * scale, "B", scale)).toBe(18);
  });

  it("never reads a negative length, however far inward the cutters go", () => {
    expect(leaveMmAt(LAYOUT.A.x0 + 40 * scale, "A", scale)).toBe(0);
  });

  it("rounds to the nearest millimetre", () => {
    expect(leaveMmAt(LAYOUT.A.x0 - 12.4 * scale, "A", scale)).toBe(12);
    expect(leaveMmAt(LAYOUT.A.x0 - 12.6 * scale, "A", scale)).toBe(13);
  });

  it("reads the same millimetres at any scale — the drawing's size is not a length", () => {
    for (const s of [2, 3.7, 6]) {
      expect(leaveMmAt(LAYOUT.A.x0 - 22 * s, "A", s)).toBe(22);
    }
  });

  it("hands the model whole millimetres and never a pixel", () => {
    const field = fieldOf(cable, "A")!;

    for (let x = field.x; x <= field.x + field.width; x += 0.5) {
      const leaveMm = leaveMmAt(x, "A", scale);

      expect(Number.isInteger(leaveMm)).toBe(true);
      expect(leaveMm).toBeGreaterThanOrEqual(0);
      expect(leaveMm).toBeLessThanOrEqual(field.reachMm + FIELD_REACH_MM);
    }
  });

  it("puts the blade back where the millimetres came from", () => {
    for (const leaveMm of [0, 7, 20, 30]) {
      expect(leaveMmAt(bladeXAt(leaveMm, "A", scale), "A", scale)).toBe(leaveMm);
      expect(leaveMmAt(bladeXAt(leaveMm, "B", scale), "B", scale)).toBe(leaveMm);
    }
  });
});

describe("the end the cutters are standing on", () => {
  const cable = strippedA();
  const { scale } = benchScale(cable);
  const at = (point: { x: number; y: number }) => cutterTarget(point.x, point.y, cable, scale);

  it("names the end whose conductor is under them, and what it would leave", () => {
    expect(at(standingAt(cable, "A", 20))).toEqual({ end: "A", leaveMm: 20 });
  });

  it("names the end they stand on, not whichever end is selected", () => {
    // End B still has its factory plug: the cutters find it all the same.
    const found = at(standingAt(cable, "B", 6));

    expect(found?.end).toBe("B");
    expect(found?.end).not.toBe("A");
  });

  it("stands on nothing over the jacket", () => {
    expect(at({ x: LAYOUT.A.x0 + 40, y: CY })).toBeNull();
  });

  it("stands on nothing over the stretch drawn out of scale", () => {
    expect(at({ x: WIDTH / 2, y: CY })).toBeNull();
  });

  it("stands on nothing on the shelf, where the tools lie", () => {
    expect(at({ x: 660, y: SHELF_TOP + 25 })).toBeNull();
  });

  it("stands on nothing above or below the conductors", () => {
    const field = fieldOf(cable, "A")!;
    const x = standingAt(cable, "A", 20).x;

    expect(at({ x, y: field.y - 2 })).toBeNull();
    expect(at({ x, y: field.y + field.height + 2 })).toBeNull();
  });

  it("stands on nothing out beyond the reach of the tips", () => {
    const reach = maxExposed(cable.ends.A);

    expect(at(standingAt(cable, "A", reach + FIELD_REACH_MM))).not.toBeNull();
    expect(at(standingAt(cable, "A", reach + FIELD_REACH_MM + 2))).toBeNull();
  });

  it("stands on nothing at all on an end with nothing exposed", () => {
    const bare = start();

    expect(cutterTarget(LAYOUT.A.x0 - 10, CY, bare, benchScale(bare).scale)).toBeNull();
  });

  it("reads every position inside the field as a length the model accepts the shape of", () => {
    const field = fieldOf(cable, "A")!;

    for (let x = field.x + 0.5; x < field.x + field.width; x += 1) {
      const found = cutterTarget(x, CY, cable, scale);

      expect(found).not.toBeNull();
      expect(Number.isInteger(found!.leaveMm)).toBe(true);
    }
  });
});
