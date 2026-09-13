// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MAX_STRIP_PASS, S1_PRACTICE, apply, createInitialState } from "../../model";
import type { Action, CableState } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { PRACTICE_BENCH } from "../setup";

/**
 * R1: stripping by dragging a stripper onto the cable.
 *
 * The gesture's arithmetic is checked in benchGeometry.test.ts; this drives
 * the whole chain — pointer down on a tool, move over the cable, release —
 * and checks the cable ends up where the model would have put it.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to numbers restated here.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

/**
 * jsdom has no PointerEvent, and without the constructor testing-library
 * falls back to a plain Event — which drops clientX, clientY and pointerId, so
 * every drag would look like a pointer that never moved. A MouseEvent carries
 * the coordinates already; this only adds the pointer id.
 *
 * Test scaffolding: the bench itself uses the platform's own events.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(window, "PointerEvent", { writable: true, configurable: true, value: TestPointerEvent });

/** The scale the bench is drawn at before anything is done to S1. */
const SCALE = benchScale(createInitialState(S1_PRACTICE)).scale;

function modelAfter(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

/**
 * The bench, with the drawing given a size. jsdom measures everything as zero,
 * and the gesture needs a box to map a pointer into. One user unit per pixel
 * keeps the sums in the test readable.
 */
function benchAt() {
  render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

  const svg = screen.getByRole("img", { name: /Workbench/ });

  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: WIDTH,
    height: HEIGHT,
    right: WIDTH,
    bottom: HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  return svg;
}

/** Where a stripper has to stand to take this much jacket off this end. */
function standingAt(end: "A" | "B", mm: number) {
  const { x0, dir } = LAYOUT[end];

  return { clientX: x0 + dir * -mm * SCALE, clientY: CY };
}

const jacketOf = (end: "A" | "B") => Number(screen.getByTestId(`end-${end}`).getAttribute("data-jacket-edge-mm"));

/** Take a stripper off the shelf and put it on the cable. */
function dragStripper(
  svg: Element,
  slot: "correct" | "too-deep",
  to: { clientX: number; clientY: number },
  { release = true } = {},
) {
  const tool = screen.getByTestId(`take-${slot}`);

  fireEvent.pointerDown(tool, { pointerId: 1, clientX: slot === "correct" ? 450 : 550, clientY: SHELF_TOP + 30 });
  fireEvent.pointerMove(svg, { pointerId: 1, ...to });
  if (release) fireEvent.pointerUp(svg, { pointerId: 1, ...to });
}

describe("stripping by dragging", () => {
  it("takes the jacket the stripper was standing on", () => {
    const svg = benchAt();

    expect(jacketOf("A")).toBe(0);

    dragStripper(svg, "correct", standingAt("A", 30));

    expect(jacketOf("A")).toBe(modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]).ends.A.jacketEdgeMm);
    expect(screen.getByTestId("feedback")).toHaveTextContent(/Stripped 30 mm of jacket from end A/);
  });

  it("reads out the millimetres under the stripper while it is held", () => {
    const svg = benchAt();

    dragStripper(svg, "correct", standingAt("A", 24), { release: false });

    const held = screen.getByTestId("stripper-in-hand");

    expect(held.getAttribute("data-mm")).toBe("24");
    expect(held.getAttribute("data-refused")).toBe("false");
    // Nothing has happened to the cable yet.
    expect(jacketOf("A")).toBe(0);
  });

  it("works on the end the bench is on, and leaves the other alone", () => {
    const svg = benchAt();

    dragStripper(svg, "correct", standingAt("A", 25));

    expect(jacketOf("A")).toBe(25);
    expect(jacketOf("B")).toBe(12);
  });

  it("works whichever end the tool is carried to, whatever is selected", () => {
    const svg = benchAt();

    // End A is selected, but the tool is put down on end B's jacket.
    dragStripper(svg, "correct", standingAt("B", 20), { release: false });

    const held = screen.getByTestId("stripper-in-hand");

    expect(held.getAttribute("data-end")).toBe("B");
    expect(held.getAttribute("data-mm")).toBe("20");
  });

  it("never quotes a distance from an end the tool is not on", () => {
    const svg = benchAt();

    // The gate bug: end A selected, tool on end B, reading measured from A.
    dragStripper(svg, "correct", standingAt("B", 20), { release: false });

    const held = screen.getByTestId("stripper-in-hand");
    const fromA = Math.round((LAYOUT.B.x0 - 20 * SCALE - LAYOUT.A.x0) / SCALE);

    expect(held.getAttribute("data-end")).not.toBe("A");
    expect(held.getAttribute("data-mm")).not.toBe(String(fromA));
  });

  it("says nothing at all while the tool is on neither end", () => {
    const svg = benchAt();

    // The out-of-scale middle: no end, so no distance rather than a wrong one.
    dragStripper(svg, "correct", { clientX: WIDTH / 2, clientY: CY }, { release: false });

    const held = screen.getByTestId("stripper-in-hand");

    expect(held.getAttribute("data-end")).toBe("");
    expect(held.getAttribute("data-mm")).toBe("0");
  });

  it("commits nothing when released on neither end", () => {
    const svg = benchAt();

    dragStripper(svg, "correct", { clientX: WIDTH / 2, clientY: CY });

    expect(jacketOf("A")).toBe(0);
    expect(jacketOf("B")).toBe(12);
  });

  it("leaves the cable alone when the pointer never travels", () => {
    const svg = benchAt();
    const tool = screen.getByTestId("take-correct");

    fireEvent.pointerDown(tool, { pointerId: 1, clientX: 450, clientY: SHELF_TOP + 30 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 451, clientY: SHELF_TOP + 31 });

    expect(jacketOf("A")).toBe(0);
    expect(screen.queryByTestId("stripper-in-hand")).toBeNull();
  });

  it("puts the tool down with nothing sent when Escape is pressed", () => {
    const svg = benchAt();

    dragStripper(svg, "correct", standingAt("A", 30), { release: false });
    expect(screen.getByTestId("stripper-in-hand")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("stripper-in-hand")).toBeNull();
    expect(jacketOf("A")).toBe(0);
  });

  it("takes nothing when the stripper is held outside the jacket", () => {
    const svg = benchAt();

    // Outward of the jacket edge there is no jacket to take.
    dragStripper(svg, "correct", standingAt("A", -15));

    expect(jacketOf("A")).toBe(0);
  });
});

describe("what the model says about a gesture", () => {
  it("marks a strip the model would refuse, and refuses it on release", () => {
    const svg = benchAt();

    // End B arrives with a plug on it; the model will not strip under one.
    dragStripper(svg, "correct", standingAt("B", 20), { release: false });

    expect(screen.getByTestId("stripper-in-hand").getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt("B", 20) });

    expect(jacketOf("B")).toBe(12);
    expect(screen.getByTestId("feedback")).toHaveTextContent(/plug/i);
    expect(screen.getByTestId("feedback").getAttribute("data-tone")).toBe("refused");
  });

  it("marks a strip past the model's one-pass limit without deciding the limit itself", () => {
    const svg = benchAt();

    // Strip once so the bench zooms out far enough to reach past 80 mm while
    // the tool is still standing on end A's own jacket.
    fireEvent.change(screen.getByLabelText("Strip length"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: /^Strip end A$/, hidden: true }));

    const scale = benchScale(modelAfter([{ type: "strip", end: "A", amountMm: 55, slot: "correct" }])).scale;
    const at = (mm: number) => ({ clientX: LAYOUT.A.x0 + mm * scale, clientY: CY });
    const held = () => screen.getByTestId("stripper-in-hand");

    dragStripper(svg, "correct", at(MAX_STRIP_PASS - 1), { release: false });
    expect(held().getAttribute("data-mm")).toBe(String(MAX_STRIP_PASS - 1));
    expect(held().getAttribute("data-refused")).toBe("false");

    // One millimetre past, and the model — not this component — says no.
    fireEvent.pointerMove(svg, { pointerId: 1, ...at(MAX_STRIP_PASS + 1) });
    expect(held().getAttribute("data-mm")).toBe(String(MAX_STRIP_PASS + 1));
    expect(held().getAttribute("data-refused")).toBe("true");
  });

  it("lets the wrong jaw through, and shows the damage it did", () => {
    const svg = benchAt();

    // A mistake, not a refusal: it happens, and the cable carries it.
    dragStripper(svg, "too-deep", standingAt("A", 30));

    expect(jacketOf("A")).toBe(30);
    expect(screen.getAllByTestId("nick-A").length).toBeGreaterThan(0);
    expect(screen.getByTestId("feedback")).toHaveTextContent(/scored the insulation/);
    expect(screen.getByTestId("feedback").getAttribute("data-tone")).toBe("done");
  });
});

describe("the tools on the shelf", () => {
  it("names both jaws, inside the shelf where they can be read", () => {
    benchAt();

    for (const [slot, name] of [
      ["correct", /UTP/],
      ["too-deep", /Small round/],
    ] as const) {
      const label = screen.getByTestId(`label-${slot}`);

      expect(label.textContent).toMatch(name);
      // Drawn inside the viewBox, not off the bottom of it.
      expect(Number(label.getAttribute("data-y"))).toBeLessThan(HEIGHT);
      expect(Number(label.getAttribute("data-y"))).toBeGreaterThan(SHELF_TOP);
    }
  });

  it("lies on neither end, so reaching for a tool chooses no end", () => {
    const svg = benchAt();

    for (const slot of ["correct", "too-deep"] as const) {
      fireEvent.pointerDown(screen.getByTestId(`take-${slot}`), {
        pointerId: 1,
        clientX: slot === "correct" ? 450 : 550,
        clientY: SHELF_TOP + 30,
      });
      // Lift straight up onto the cable: still over the out-of-scale middle.
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: slot === "correct" ? 450 : 550, clientY: CY });

      expect(screen.getByTestId("stripper-in-hand").getAttribute("data-end")).toBe("");

      fireEvent.keyDown(window, { key: "Escape" });
    }
  });
});

describe("the precise path still works", () => {
  it("strips from the slider and button, untouched by the gesture", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    fireEvent.change(screen.getByLabelText("Strip length"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: /^Strip end A$/, hidden: true }));

    expect(jacketOf("A")).toBe(35);
  });
});
