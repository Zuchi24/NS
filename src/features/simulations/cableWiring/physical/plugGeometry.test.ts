// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState } from "../model";
import type { Action, CableState, EndId } from "../model";
import { CY, INWARD_PX, LAYOUT, OUTWARD_PX, SHELF_TOP, WIDTH, benchScale, jacketRun, offsetMmAt } from "./benchGeometry";
import { EndDetail } from "./components/EndDetail";
import { PLUG_HALF, PLUG_MARGIN, plugField, plugFrontXAt, plugRearXAt, plugTarget } from "./plugGeometry";

/**
 * Where a plug held over the bench is, and what push that position means.
 *
 * The drawing is the reference: a plug the model has seated is drawn by
 * EndDetail, and a plug held at the same place has to read back as the same
 * push. Nothing here knows how far a plug may go on — that is the model's.
 */

afterEach(cleanup);

function chain(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

const start = () => createInitialState(S1_PRACTICE);

/** End A stripped, fanned, trimmed and fitted with a plug, as the model leaves it. */
const pluggedA = (stripMm = 30, leaveMm = 12, pushMm = 4) =>
  chain([
    { type: "strip", end: "A", amountMm: stripMm, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    { type: "trim", end: "A", leaveMm },
    { type: "insert", end: "A", orientation: "contacts-up", pushMm },
  ]);

/** Scales the bench is really drawn at, for cables in different states. */
const SCALES = [...new Set([start(), pluggedA(), pluggedA(60, 40, -10)].map((cable) => benchScale(cable).scale)), 2.2];

/** The plug EndDetail draws on one end, at the bench's scale. */
function drawnPlug(cable: CableState, id: EndId) {
  const scale = benchScale(cable).scale;
  const { x0, dir } = LAYOUT[id];

  render(
    createElement(
      "svg",
      null,
      createElement(EndDetail, {
        id,
        end: cable.ends[id],
        dir,
        x0,
        outwardPx: OUTWARD_PX,
        inwardPx: INWARD_PX,
        cy: CY,
        scale,
        marker: null,
        selected: false,
      }),
    ),
  );

  const body = screen.getByTestId("plug").querySelector("rect")!;

  return {
    scale,
    x: Number(body.getAttribute("x")),
    width: Number(body.getAttribute("width")),
    y: Number(body.getAttribute("y")),
    height: Number(body.getAttribute("height")),
  };
}

describe("where a plug can be held", () => {
  it("is each end's whole panel: from where its jacket run begins out to the panel's edge", () => {
    for (const id of ["A", "B"] as const) {
      const field = plugField(id);
      const { x0, dir } = LAYOUT[id];
      const [runFrom, runTo] = jacketRun(id);
      const panelEdge = x0 + dir * OUTWARD_PX;

      // The jacket run's inner end is one edge of the field, the panel edge the other.
      expect(field.x).toBe(Math.min(dir === 1 ? runFrom : runTo, panelEdge));
      expect(field.x + field.width).toBe(Math.max(dir === 1 ? runFrom : runTo, panelEdge));
      expect(field.end).toBe(id);
    }

    expect(plugField("A")).toMatchObject({ x: 34, width: 406 });
    expect(plugField("B")).toMatchObject({ x: 560, width: 406 });
  });

  it("keeps the two ends apart, with the out-of-scale middle belonging to neither", () => {
    const a = plugField("A");
    const b = plugField("B");

    expect(a.x + a.width).toBeLessThan(WIDTH / 2);
    expect(b.x).toBeGreaterThan(WIDTH / 2);
  });

  it("is as tall as the plug EndDetail draws, with a little slack, and stays off the shelf", () => {
    const drawn = drawnPlug(start(), "B");
    const field = plugField("B");

    expect(drawn.y).toBe(CY - PLUG_HALF);
    expect(drawn.height).toBe(2 * PLUG_HALF);
    expect(field.y).toBe(drawn.y - PLUG_MARGIN);
    expect(field.y + field.height).toBe(drawn.y + drawn.height + PLUG_MARGIN);
    expect(field.y + field.height).toBeLessThan(SHELF_TOP);
  });
});

describe("which end a plug is held over", () => {
  it("is end A over end A's panel and end B over end B's", () => {
    expect(plugTarget(150, CY, 6)?.end).toBe("A");
    expect(plugTarget(850, CY, 6)?.end).toBe("B");
  });

  it("includes the field's own edges", () => {
    for (const id of ["A", "B"] as const) {
      const field = plugField(id);

      for (const [x, y] of [
        [field.x, CY],
        [field.x + field.width, CY],
        [field.x + 50, field.y],
        [field.x + 50, field.y + field.height],
      ]) {
        expect(plugTarget(x, y, 6)?.end, `${id} at ${x},${y}`).toBe(id);
      }
    }
  });

  it("is no end just outside those edges", () => {
    for (const id of ["A", "B"] as const) {
      const field = plugField(id);

      for (const [x, y] of [
        [field.x - 1, CY],
        [field.x + field.width + 1, CY],
        [field.x + 50, field.y - 1],
        [field.x + 50, field.y + field.height + 1],
      ]) {
        expect(plugTarget(x, y, 6), `${id} at ${x},${y}`).toBeNull();
      }
    }
  });

  it("is no end over the out-of-scale middle, or on the shelf", () => {
    expect(plugTarget(WIDTH / 2, CY, 6)).toBeNull();
    expect(plugTarget(150, SHELF_TOP, 6)).toBeNull();
    expect(plugTarget(850, SHELF_TOP + 30, 6)).toBeNull();
  });
});

describe("how far on a held plug would be pushed", () => {
  it("is positive with the rear opening inward of the jacket edge, at both ends", () => {
    for (const scale of SCALES) {
      // End A's cable runs to the right of its edge, end B's to the left.
      expect(plugTarget(LAYOUT.A.x0 + 7 * scale, CY, scale)).toEqual({ end: "A", pushMm: 7 });
      expect(plugTarget(LAYOUT.B.x0 - 7 * scale, CY, scale)).toEqual({ end: "B", pushMm: 7 });
    }
  });

  it("is negative with the rear opening out past the jacket edge, and zero on it", () => {
    for (const scale of SCALES) {
      expect(plugTarget(LAYOUT.A.x0 - 5 * scale, CY, scale)).toEqual({ end: "A", pushMm: -5 });
      expect(plugTarget(LAYOUT.B.x0 + 5 * scale, CY, scale)).toEqual({ end: "B", pushMm: -5 });
      expect(Object.is(plugTarget(LAYOUT.A.x0, CY, scale)!.pushMm, 0)).toBe(true);
      expect(Object.is(plugTarget(LAYOUT.B.x0 + 0.2 * scale, CY, scale)!.pushMm, 0)).toBe(true);
    }
  });

  it("reads the same millimetres as the rest of the bench, on the one shared scale", () => {
    for (const scale of SCALES) {
      for (const id of ["A", "B"] as const) {
        const field = plugField(id);

        for (let x = field.x; x <= field.x + field.width; x += 13.7) {
          expect(plugTarget(x, CY, scale)!.pushMm).toBe(Math.round(-offsetMmAt(x, id, scale)) || 0);
        }
      }
    }
  });

  it("is never clamped: however far in or out it is held, the number is the position", () => {
    const scale = 2.2;

    expect(plugTarget(plugField("A").x + plugField("A").width, CY, scale)!.pushMm).toBe(
      Math.round((plugField("A").x + plugField("A").width - LAYOUT.A.x0) / scale),
    );
    expect(plugTarget(plugField("B").x + plugField("B").width, CY, scale)!.pushMm).toBe(
      -Math.round((plugField("B").x + plugField("B").width - LAYOUT.B.x0) / scale),
    );
  });

  it("does not care how far up or down the plug is held within the field", () => {
    const field = plugField("A");

    expect(plugTarget(250, field.y, 6)).toEqual(plugTarget(250, CY, 6));
    expect(plugTarget(250, field.y + field.height, 6)).toEqual(plugTarget(250, CY, 6));
  });
});

describe("where a plug at a given push is drawn", () => {
  it("round-trips: the rear opening drawn for a push reads back as that push", () => {
    for (const scale of SCALES) {
      for (const id of ["A", "B"] as const) {
        for (let pushMm = -25; pushMm <= 30; pushMm++) {
          expect(plugTarget(plugRearXAt(pushMm, id, scale), CY, scale)).toEqual({ end: id, pushMm });
        }
      }
    }
  });

  it("puts the front a plug's length further out than the rear, the way the conductors point", () => {
    for (const scale of SCALES) {
      expect(plugFrontXAt(4, "A", scale)).toBeLessThan(plugRearXAt(4, "A", scale));
      expect(plugFrontXAt(4, "B", scale)).toBeGreaterThan(plugRearXAt(4, "B", scale));
      expect(Math.abs(plugFrontXAt(4, "B", scale) - plugRearXAt(4, "B", scale))).toBeCloseTo(
        Math.abs(plugFrontXAt(-9, "B", scale) - plugRearXAt(-9, "B", scale)),
        9,
      );
    }
  });

  it("matches the plug EndDetail draws for a plug the model has seated, at end A", () => {
    const cable = pluggedA();
    const seat = cable.ends.A.plug!.jacketInMm;
    const drawn = drawnPlug(cable, "A");
    const rear = plugRearXAt(seat, "A", drawn.scale);
    const front = plugFrontXAt(seat, "A", drawn.scale);

    expect(drawn.x).toBeCloseTo(Math.min(rear, front), 9);
    expect(drawn.width).toBeCloseTo(Math.abs(front - rear), 9);
  });

  it("matches the plug EndDetail draws for a plug the model has seated, at end B", () => {
    const cable = start();
    const seat = cable.ends.B.plug!.jacketInMm;
    const drawn = drawnPlug(cable, "B");
    const rear = plugRearXAt(seat, "B", drawn.scale);
    const front = plugFrontXAt(seat, "B", drawn.scale);

    expect(drawn.x).toBeCloseTo(Math.min(rear, front), 9);
    expect(drawn.width).toBeCloseTo(Math.abs(front - rear), 9);
  });

  it("matches a seated plug with its jacket outside the plug, too", () => {
    const cable = pluggedA(60, 40, -10);
    const seat = cable.ends.A.plug!.jacketInMm;
    const drawn = drawnPlug(cable, "A");

    expect(seat).toBeLessThan(0);
    expect(drawn.x).toBeCloseTo(
      Math.min(plugRearXAt(seat, "A", drawn.scale), plugFrontXAt(seat, "A", drawn.scale)),
      9,
    );
  });
});
