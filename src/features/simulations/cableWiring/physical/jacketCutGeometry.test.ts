import { describe, expect, it } from "vitest";

import { PAIR_IDS, S1_PRACTICE, T568B, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableState, EndId } from "../model";
import { CY, INWARD_PX, JACKET_HALF, LAYOUT, SHELF_TOP, benchScale, jacketRun } from "./benchGeometry";
import { JACKET_MARGIN, atMmAt, cutXAt, jacketCutTarget, jacketField } from "./jacketCutGeometry";

/**
 * Where the cable cutters are standing, in millimetres.
 *
 * Arithmetic over the drawing's own numbers: which end's jacket a point is on,
 * and where along the cable a cut there would fall. No rule is checked here and
 * none is expressible here — every position below is simply a position, and
 * whether the model would make the cut is asked of the model (see dryRun and
 * the gesture's tests).
 */

const start = () => createInitialState(S1_PRACTICE);
const scaleOf = (cable: CableState) => benchScale(cable).scale;

function after(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, start());
}

/** Where the cutters stand to cut this far behind an end's jacket edge. */
function standingAt(cable: CableState, end: EndId, backMm: number): { x: number; y: number } {
  const { x0, dir } = LAYOUT[end];

  return { x: x0 - dir * backMm * scaleOf(cable), y: CY };
}

describe("the jacket a pair of cable cutters can stand on", () => {
  it("is the run of bench the jacket is drawn over", () => {
    for (const end of ["A", "B"] as const) {
      const field = jacketField(end);
      const [from, to] = jacketRun(end);

      expect({ x: field.x, right: field.x + field.width }).toEqual({ x: from, right: to });
      expect(field.width).toBeCloseTo(INWARD_PX, 10);
    }
  });

  it("is as tall as the jacket is drawn, plus a little slack either side", () => {
    const field = jacketField("A");

    expect(field.y).toBe(CY - JACKET_HALF - JACKET_MARGIN);
    expect(field.height).toBe(2 * (JACKET_HALF + JACKET_MARGIN));
    // Comfortably clear of the shelf the tools lie on.
    expect(field.y + field.height).toBeLessThan(SHELF_TOP);
  });

  it("moves with the centre line it is given", () => {
    expect(jacketField("B", 200).y).toBe(200 - JACKET_HALF - JACKET_MARGIN);
  });
});

describe("where a cut would fall", () => {
  it("is the jacket edge itself at the jacket edge", () => {
    const cable = start();

    for (const end of ["A", "B"] as const) {
      const at = jacketCutTarget(LAYOUT[end].x0, CY, cable, scaleOf(cable));

      expect(at).toEqual({ end, atMm: cable.ends[end].jacketEdgeMm, offsetMm: 0 });
    }
  });

  it("counts inward from the end of the cable, from the end's own jacket edge", () => {
    const cable = start();
    const scale = scaleOf(cable);

    for (const end of ["A", "B"] as const) {
      const J = cable.ends[end].jacketEdgeMm;

      for (const backMm of [1, 5, 12, 30]) {
        const { x, y } = standingAt(cable, end, backMm);

        expect(jacketCutTarget(x, y, cable, scale)).toEqual({ end, atMm: J + backMm, offsetMm: -backMm });
      }
    }
  });

  it("reads the same distance at either end", () => {
    const cable = start();
    const scale = scaleOf(cable);
    const back = (end: EndId) => {
      const target = jacketCutTarget(standingAt(cable, end, 14).x, CY, cable, scale);

      return target === null ? null : target.atMm - cable.ends[end].jacketEdgeMm;
    };

    expect(back("A")).toBe(back("B"));
  });

  it("draws the blade back on the line it was read from", () => {
    const cable = start();
    const scale = scaleOf(cable);

    for (const end of ["A", "B"] as const) {
      const { x } = standingAt(cable, end, 9);
      const target = jacketCutTarget(x, CY, cable, scale);

      expect(target).not.toBeNull();
      expect(cutXAt(target!.atMm, end, cable.ends[end], scale)).toBeCloseTo(x, 6);
    }
  });

  it("takes the jacket edge from the end it is on, not from the other one", () => {
    // End A is raw (J 0); end B arrives with a plug and J 12.
    const cable = start();
    const scale = scaleOf(cable);

    expect(cable.ends.A.jacketEdgeMm).not.toBe(cable.ends.B.jacketEdgeMm);
    expect(jacketCutTarget(standingAt(cable, "A", 10).x, CY, cable, scale)?.atMm).toBe(
      cable.ends.A.jacketEdgeMm + 10,
    );
    expect(jacketCutTarget(standingAt(cable, "B", 10).x, CY, cable, scale)?.atMm).toBe(
      cable.ends.B.jacketEdgeMm + 10,
    );
  });

  it("is the offset the drawing marks, flipped", () => {
    const cable = start();
    const target = jacketCutTarget(standingAt(cable, "A", 7).x, CY, cable, scaleOf(cable));

    expect(target?.offsetMm).toBe(cable.ends.A.jacketEdgeMm - target!.atMm);
    expect(target?.offsetMm).toBeLessThanOrEqual(0);
  });

  it("is whole millimetres, rounded to the nearest", () => {
    const cable = start();
    const scale = scaleOf(cable);
    const { x0, dir } = LAYOUT.A;

    expect(atMmAt(x0 - dir * 6.4 * scale, "A", cable.ends.A, scale)).toBe(6);
    expect(atMmAt(x0 - dir * 6.6 * scale, "A", cable.ends.A, scale)).toBe(7);
  });
});

describe("standing on nothing", () => {
  const cable = start();
  const scale = scaleOf(cable);

  it("outward of the jacket edge, where the conductors are", () => {
    // A stripped, fanned end: past its jacket edge there is bare conductor and
    // no jacket. Nothing is offered there — and nothing is judged either.
    const stripped = after([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair) => ({ type: "untwist", end: "A", pair }) as Action),
    ]);
    const out = scaleOf(stripped);

    expect(jacketCutTarget(standingAt(stripped, "A", -10).x, CY, stripped, out)).toBeNull();
  });

  it("in the out-of-scale middle, which belongs to neither end", () => {
    expect(jacketCutTarget(500, CY, cable, scale)).toBeNull();
  });

  it("above and below the cable", () => {
    const field = jacketField("A");

    expect(jacketCutTarget(300, field.y - 1, cable, scale)).toBeNull();
    expect(jacketCutTarget(300, field.y + field.height + 1, cable, scale)).toBeNull();
  });

  it("on the shelf the tools lie on", () => {
    expect(jacketCutTarget(300, SHELF_TOP + 20, cable, scale)).toBeNull();
  });

  it("deeper into the cable than the jacket is drawn", () => {
    const [from, to] = jacketRun("A");

    expect(jacketCutTarget(to + 1, CY, cable, scale)).toBeNull();
    expect(jacketCutTarget(from - 1, CY, cable, scale)).toBeNull();
  });
});

describe("the cutters find the same jacket whatever the end is doing", () => {
  const bunched = after([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
  const fanned = after([
    { type: "strip", end: "A", amountMm: 30, slot: "correct" },
    ...PAIR_IDS.map((pair) => ({ type: "untwist", end: "A", pair }) as Action),
  ]);

  it("bunched, fanned, or with a plug over it", () => {
    const plugged: CableState = {
      ...fanned,
      ends: {
        ...fanned.ends,
        A: makeEnd({
          jacketEdgeMm: fanned.ends.A.jacketEdgeMm,
          tipMm: fanned.ends.A.jacketEdgeMm - 13,
          fan: T568B,
          plug: { orientation: "contacts-up", jacketInMm: 8, crimp: "full" },
        }),
      },
    };

    expect(fanned.ends.A.fan).not.toBeNull();
    expect(bunched.ends.A.fan).toBeNull();

    // One jacket edge, one scale, one answer: the picture over the jacket
    // changes, the jacket does not.
    for (const state of [bunched, fanned, plugged]) {
      const scale = scaleOf(state);
      const target = jacketCutTarget(standingAt(state, "A", 6).x, CY, state, scale);

      expect(target).toEqual({ end: "A", atMm: state.ends.A.jacketEdgeMm + 6, offsetMm: -6 });
    }
  });

  it("and under a plug, the jacket behind it is still jacket", () => {
    // End B's plug covers the first 9 mm behind its jacket edge. The cutters can
    // stand there; what the model makes of it is the model's business.
    const cable = start();
    const scale = scaleOf(cable);

    expect(cable.ends.B.plug?.jacketInMm).toBeGreaterThan(0);
    expect(jacketCutTarget(standingAt(cable, "B", 4).x, CY, cable, scale)).toEqual({
      end: "B",
      atMm: cable.ends.B.jacketEdgeMm + 4,
      offsetMm: -4,
    });
  });
});

describe("which end", () => {
  it("is each end over its own half of the bench, and never the other", () => {
    const cable = start();
    const scale = scaleOf(cable);

    for (const end of ["A", "B"] as const) {
      const field = jacketField(end);

      for (const x of [field.x + 1, field.x + field.width / 2, field.x + field.width - 1]) {
        expect(jacketCutTarget(x, CY, cable, scale)?.end).toBe(end);
      }
    }
  });

  it("never overlaps between the two ends", () => {
    const [, aTo] = jacketRun("A");
    const [bFrom] = jacketRun("B");

    expect(aTo).toBeLessThan(bFrom);
  });
});
