// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { CONTACT_LINE, END_IDS, PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableState, EndId, Scenario } from "../model";
import { CY, INWARD_PX, LAYOUT, OUTWARD_PX, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import { EndDetail } from "./components/EndDetail";
import { crimpDieXAt, crimperTarget } from "./crimperGeometry";
import { PLUG_HALF, plugTarget } from "./plugGeometry";

/**
 * Where the crimper stands, and where its die is drawn.
 *
 * The crimper stands where a plug would be held, read by INSERT's own
 * function, so the two can never disagree about which end they are on. What
 * the end is doing plays no part: whether there is a plug to crimp is the
 * model's answer, never this file's.
 */

afterEach(cleanup);

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });
const OPEN: Scenario = { ...S1_PRACTICE, initialEnds: { A: raw(), B: raw() } };

function chain(actions: Action[], scenario: Scenario = OPEN): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

const plugged = (end: EndId, pushMm: number): Action[] => [
  { type: "strip", end, amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
  { type: "insert", end, orientation: "contacts-up", pushMm },
];

describe("which end the crimper stands on", () => {
  it("is the end a plug held at the same point would be over, everywhere across the bench", () => {
    const scale = benchScale(createInitialState(S1_PRACTICE)).scale;
    let onAnEnd = 0;

    for (let x = 0; x <= WIDTH; x += 5) {
      for (let y = 0; y <= SHELF_TOP + 40; y += 5) {
        const stand = crimperTarget(x, y, scale);

        expect(stand?.end ?? null, `at ${x}, ${y}`).toBe(plugTarget(x, y, scale)?.end ?? null);
        if (stand) onAnEnd++;
      }
    }

    expect(onAnEnd).toBeGreaterThan(0);
  });

  it("is end A over end A's panel and end B over end B's", () => {
    const scale = benchScale(createInitialState(S1_PRACTICE)).scale;

    expect(crimperTarget(LAYOUT.A.x0, CY, scale)).toEqual({ end: "A" });
    expect(crimperTarget(LAYOUT.B.x0, CY, scale)).toEqual({ end: "B" });
    expect(crimperTarget(LAYOUT.A.x0 - OUTWARD_PX + 1, CY + PLUG_HALF, scale)).toEqual({ end: "A" });
    expect(crimperTarget(LAYOUT.B.x0 - INWARD_PX + 1, CY - PLUG_HALF, scale)).toEqual({ end: "B" });
  });

  it("is no end over the out-of-scale middle, or on the shelf", () => {
    const scale = benchScale(createInitialState(S1_PRACTICE)).scale;

    expect(crimperTarget(WIDTH / 2, CY, scale)).toBeNull();
    expect(crimperTarget(LAYOUT.A.x0, SHELF_TOP + 20, scale)).toBeNull();
  });

  it("takes no account of the cable: a raw end, a plug and a crimped plug are stood on alike", () => {
    // Nothing about the cable is even passed in. Three very different ends, one answer.
    const cables = [
      createInitialState(OPEN),
      chain(plugged("A", 9)),
      chain([...plugged("A", 9), { type: "crimp", end: "A", squeeze: "full" }]),
    ];

    for (const cable of cables) {
      const scale = benchScale(cable).scale;

      expect(crimperTarget(LAYOUT.A.x0 - 20, CY, scale)).toEqual({ end: "A" });
    }
  });
});

describe("where the crimper's die is drawn", () => {
  it("is across the blade line of the plug on the end, at both ends", () => {
    const cable = chain([...plugged("A", -5), ...plugged("B", 9)]);
    const scale = benchScale(cable).scale;

    for (const id of END_IDS) {
      const { x0, dir } = LAYOUT[id];
      const jacketInMm = cable.ends[id].plug!.jacketInMm;

      expect(crimpDieXAt(id, cable.ends[id], scale, 0)).toBeCloseTo(x0 + dir * (CONTACT_LINE - jacketInMm) * scale, 9);
    }
  });

  it("is where EndDetail draws that plug's blades", () => {
    const cable = chain(plugged("B", 4));
    const scale = benchScale(cable).scale;
    const { x0, dir } = LAYOUT.B;

    render(
      createElement(
        "svg",
        null,
        createElement(EndDetail, {
          id: "B",
          end: cable.ends.B,
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

    // The plug's body, then its first blade.
    const blade = screen.getByTestId("plug").querySelectorAll("rect")[1];
    const centre = Number(blade.getAttribute("x")) + Number(blade.getAttribute("width")) / 2;

    expect(crimpDieXAt("B", cable.ends.B, scale, 0)).toBeCloseTo(centre, 6);
  });

  it("is where it was put down when there is no plug on the end", () => {
    const cable = createInitialState(OPEN);

    expect(crimpDieXAt("A", cable.ends.A, benchScale(cable).scale, 123.5)).toBe(123.5);
  });
});
