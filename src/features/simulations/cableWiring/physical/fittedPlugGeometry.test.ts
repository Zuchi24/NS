import { describe, expect, it } from "vitest";

import { END_IDS, PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableState, EndId, Scenario } from "../model";
import { CY, LAYOUT, WIDTH, SHELF_TOP, benchScale } from "./benchGeometry";
import { LANE_COUNT, LANE_GAP, conductorRegions, conductorUnder, laneY } from "./conductorGeometry";
import {
  PLUG_GRIP,
  PLUG_HALF,
  WITHDRAW_PULL_MM,
  fittedPlugMove,
  fittedPlugUnder,
  plugFrontXAt,
  plugGrip,
  plugRearXAt,
  plugTarget,
  pushMmAt,
} from "./plugGeometry";

/**
 * A plug already on an end, as something a hand can take hold of and move.
 *
 * The grip is checked against the plug the model has seated and against the
 * conductor row it encloses: the two must never both claim a point. What a
 * move means is checked against INSERT's own reading of a plug's position, so
 * there is one interpretation of where a plug is. Nothing here knows how far a
 * plug may go on, or whether it can come off — those are the model's.
 */

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });

/** S1's bench with both ends raw, so either end can take a plug. */
const OPEN: Scenario = { ...S1_PRACTICE, initialEnds: { A: raw(), B: raw() } };

function chain(actions: Action[], scenario: Scenario = OPEN): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

const fitted = (end: EndId, pushMm: number): Action[] => [
  { type: "strip", end, amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
  { type: "insert", end, orientation: "contacts-up", pushMm },
];

/** A plug on each end, at different depths. */
const bothPlugged = () => chain([...fitted("A", -5), ...fitted("B", 4)]);

describe("the grip of a plug already on an end", () => {
  it("is there only where there is a plug", () => {
    const start = createInitialState(S1_PRACTICE);
    const scale = benchScale(start).scale;

    expect(plugGrip("A", start.ends.A, scale)).toBeNull();
    expect(plugGrip("B", start.ends.B, scale)).not.toBeNull();
  });

  it("runs the length of the plug the model seated, at both ends", () => {
    const cable = bothPlugged();
    const scale = benchScale(cable).scale;

    for (const id of END_IDS) {
      const jacketInMm = cable.ends[id].plug!.jacketInMm;
      const rear = plugRearXAt(jacketInMm, id, scale);
      const front = plugFrontXAt(jacketInMm, id, scale);
      const grip = plugGrip(id, cable.ends[id], scale)!;

      expect(grip.end).toBe(id);
      expect(grip.x).toBeCloseTo(Math.min(rear, front), 9);
      expect(grip.width).toBeCloseTo(Math.abs(front - rear), 9);
    }
  });

  it("reaches past the drawn plug above and below, and stops at the conductor row", () => {
    const cable = bothPlugged();
    const [above, below] = plugGrip("A", cable.ends.A, benchScale(cable).scale)!.bands;

    expect(above.y).toBe(CY - PLUG_HALF - PLUG_GRIP);
    expect(above.y + above.height).toBe(laneY(0) - LANE_GAP / 2);
    expect(below.y).toBe(laneY(LANE_COUNT - 1) + LANE_GAP / 2);
    expect(below.y + below.height).toBe(CY + PLUG_HALF + PLUG_GRIP);
  });

  it("never shares a point with a conductor, so one hand closing is only ever one gesture", () => {
    const cable = bothPlugged();
    const scale = benchScale(cable).scale;
    let plugPoints = 0;
    let rowPoints = 0;
    const both: string[] = [];

    // A sweep over the plug and a margin round it, plus the row's own edges and
    // just either side of them, where the two regions meet.
    const ys: number[] = [];
    for (let y = CY - PLUG_HALF - PLUG_GRIP - 4; y <= CY + PLUG_HALF + PLUG_GRIP + 4; y += 0.5) ys.push(y);
    for (const edge of [laneY(0) - LANE_GAP / 2, laneY(LANE_COUNT - 1) + LANE_GAP / 2]) ys.push(edge - 0.01, edge, edge + 0.01);

    for (const id of END_IDS) {
      const grip = plugGrip(id, cable.ends[id], scale)!;

      for (let x = grip.x - 10; x <= grip.x + grip.width + 10; x += 1) {
        for (const y of ys) {
          const plug = fittedPlugUnder(x, y, cable, scale);
          const conductor = conductorUnder(x, y, cable, scale);

          if (plug) plugPoints++;
          if (conductor) rowPoints++;
          if (plug && conductor) both.push(`${x}, ${y}`);
        }
      }
    }

    expect(both).toEqual([]);
    // The sweep really crossed both.
    expect(plugPoints).toBeGreaterThan(0);
    expect(rowPoints).toBeGreaterThan(0);
  });

  it("is listed for a crimped plug too: whether it can move is the model's answer", () => {
    const start = createInitialState(S1_PRACTICE);
    const scale = benchScale(start).scale;
    const grip = plugGrip("B", start.ends.B, scale)!;

    expect(start.ends.B.plug!.crimp).toBe("full");
    expect(fittedPlugUnder(grip.x + grip.width / 2, grip.bands[0].y + 2, start, scale)?.end).toBe("B");
  });
});

describe("which fitted plug is under the hand", () => {
  it("is the plug whose grip it is on, above the row or below it, with how it sits now", () => {
    const cable = bothPlugged();
    const scale = benchScale(cable).scale;

    for (const id of END_IDS) {
      const grip = plugGrip(id, cable.ends[id], scale)!;
      const x = grip.x + grip.width / 2;

      for (const band of grip.bands) {
        expect(fittedPlugUnder(x, band.y + band.height / 2, cable, scale)).toEqual({
          end: id,
          jacketInMm: cable.ends[id].plug!.jacketInMm,
          orientation: "contacts-up",
        });
      }
    }
  });

  it("is no plug over the out-of-scale middle, the shelf, or an end without one", () => {
    const cable = chain(fitted("A", -5));
    const scale = benchScale(cable).scale;

    expect(fittedPlugUnder(WIDTH / 2, CY - PLUG_HALF, cable, scale)).toBeNull();
    expect(fittedPlugUnder(LAYOUT.A.x0, SHELF_TOP + 20, cable, scale)).toBeNull();
    expect(fittedPlugUnder(LAYOUT.B.x0 + 20, CY - PLUG_HALF, cable, scale)).toBeNull();
  });

  it("leaves the row's own edge to the conductors", () => {
    const cable = chain(fitted("A", -5));
    const scale = benchScale(cable).scale;
    const lane = conductorRegions("A", cable.ends.A, scale)[0];
    const x = lane.x + lane.width / 2;

    expect(fittedPlugUnder(x, laneY(0) - LANE_GAP / 2, cable, scale)).toBeNull();
    expect(conductorUnder(x, laneY(0) - LANE_GAP / 2, cable, scale)).not.toBeNull();
    expect(fittedPlugUnder(x, laneY(0) - LANE_GAP / 2 - 0.5, cable, scale)?.end).toBe("A");
  });
});

describe("what moving a fitted plug along its end means", () => {
  // A scale that keeps the arithmetic exact.
  const scale = 4;

  it("is a push when it goes inward, toward the cable body, at either end", () => {
    // End A points left, so inward is to the right; end B the other way round.
    expect(fittedPlugMove(-5, 3 * scale, "A", scale)).toEqual({ kind: "push", pushMm: -2 });
    expect(fittedPlugMove(-5, -3 * scale, "B", scale)).toEqual({ kind: "push", pushMm: -2 });
  });

  it("is not a push when it goes the other way at either end", () => {
    expect(fittedPlugMove(-5, -3 * scale, "A", scale)?.kind).not.toBe("push");
    expect(fittedPlugMove(-5, 3 * scale, "B", scale)?.kind).not.toBe("push");
  });

  it("reads the push exactly as INSERT reads a plug held with its rear opening there", () => {
    for (const id of END_IDS) {
      for (const inwardMm of [0.4, 1, 2.6, 7, 13]) {
        const dx = -LAYOUT[id].dir * inwardMm * scale;
        const rearX = plugRearXAt(-5, id, scale) + dx;
        const move = fittedPlugMove(-5, dx, id, scale);

        expect(move).toEqual({ kind: "push", pushMm: pushMmAt(rearX, id, scale) });
        expect(move).toEqual({ kind: "push", pushMm: plugTarget(rearX, CY, scale)!.pushMm });
      }
    }
  });

  it("is never clamped: however far in it goes, the number is the position", () => {
    expect(fittedPlugMove(4, 40 * scale, "A", scale)).toEqual({ kind: "push", pushMm: 44 });
  });

  it("is nothing outward of the seat until it has been drawn back WITHDRAW_PULL_MM, and a pull off from there", () => {
    for (const id of END_IDS) {
      const out = (mm: number) => LAYOUT[id].dir * mm * scale;

      expect(fittedPlugMove(-5, out(0.5), id, scale)).toBeNull();
      expect(fittedPlugMove(-5, out(WITHDRAW_PULL_MM - 1), id, scale)).toBeNull();
      expect(fittedPlugMove(-5, out(WITHDRAW_PULL_MM), id, scale)).toEqual({ kind: "withdraw" });
      expect(fittedPlugMove(-5, out(WITHDRAW_PULL_MM + 30), id, scale)).toEqual({ kind: "withdraw" });
    }
  });

  it("is nothing at all without travel along the cable", () => {
    expect(fittedPlugMove(-5, 0, "A", scale)).toBeNull();
    expect(fittedPlugMove(-5, -0, "B", scale)).toBeNull();
  });

  it("takes its release distance as given", () => {
    expect(fittedPlugMove(0, LAYOUT.B.dir * 2 * scale, "B", scale, 2)).toEqual({ kind: "withdraw" });
    expect(fittedPlugMove(0, LAYOUT.B.dir * 1 * scale, "B", scale, 2)).toBeNull();
  });
});
