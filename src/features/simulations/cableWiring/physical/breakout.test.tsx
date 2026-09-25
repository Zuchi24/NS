// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { makeEnd } from "../model";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import { CY, JACKET_HALF } from "./benchGeometry";
import { laneY } from "./conductorGeometry";
import { pairRowY } from "./pairGeometry";
import { PRACTICE_BENCH } from "./setup";

/**
 * Where the conductors leave the jacket: out of its mouth, then over to their
 * own lanes. Drawing only — the lanes and pair rows the hand takes hold of are
 * pinned by the gesture tests, and are where they always were.
 */

afterEach(cleanup);

const FAN = ["orange", "brown", "green", "blue", "white-green", "white-brown", "white-blue", "white-orange"] as const;

function mount() {
  render(
    <PhysicalCableChallenge
      {...PRACTICE_BENCH}
      scenario={{
        ...PRACTICE_BENCH.scenario,
        // End A with twisted pairs out of the jacket; end B fanned flat.
        initialEnds: { A: makeEnd({ jacketEdgeMm: 30, tipMm: 0 }), B: makeEnd({ jacketEdgeMm: 30, tipMm: 0, fan: FAN }) },
      }}
    />,
  );
}

/** The y where a drawn wire starts, and the y it finishes at. */
function ends(path: SVGPathElement): { root: number; tip: number } {
  const numbers = path.getAttribute("d")!.match(/-?\d+(\.\d+)?/g)!.map(Number);

  return { root: numbers[1], tip: numbers[numbers.length - 1] };
}

describe("the breakout at the jacket mouth", () => {
  it("brings every fanned conductor out of the jacket's hollow, and lays its tip in its own lane", () => {
    mount();

    FAN.forEach((conductor, index) => {
      const { root, tip } = ends(screen.getByTestId(`lane-B-${conductor}`).querySelector("path")!);

      expect(Math.abs(root - CY) + 5.5 / 2).toBeLessThan(JACKET_HALF);
      expect(tip).toBeCloseTo(laneY(index, CY));
    });
  });

  it("brings every twisted pair out of the jacket's hollow, and on to its own row", () => {
    mount();

    (["orange", "green", "blue", "brown"] as const).forEach((pair) => {
      // Which row a pair lies in is the attempt's own draw; the row it names is fixed.
      const index = Number(screen.getByTestId(`pair-A-${pair}`).getAttribute("data-row"));

      const wires = [...screen.getByTestId(`pair-A-${pair}`).querySelectorAll("path")].filter(
        (path) => path.closest("[data-testid^='pair-grab-']") === null,
      );
      expect(wires.length).toBeGreaterThanOrEqual(2);

      for (const path of wires) {
        const { root, tip } = ends(path);

        expect(Math.abs(root - CY)).toBeLessThan(JACKET_HALF);
        expect(tip).toBeCloseTo(pairRowY(index, CY));
      }
    });
  });

  it("draws the mouth as a hollow inside the jacket's own height", () => {
    mount();

    const [wall, hollow] = screen.getByTestId("mouth-B").querySelectorAll("ellipse");

    expect(Number(wall.getAttribute("ry"))).toBe(JACKET_HALF);
    expect(Number(hollow.getAttribute("ry"))).toBeLessThan(JACKET_HALF);
    expect(screen.getByTestId("mouth-B").getAttribute("pointer-events")).toBe("none");
  });
});
