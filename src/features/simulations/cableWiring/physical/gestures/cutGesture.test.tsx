// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale, jacketRun } from "../benchGeometry";
import { BenchView } from "../components/BenchView";
import { CABLE_CUTTER_SHELF_X } from "../components/CableCutterTool";
import { CUTTER_SHELF_X } from "../components/CutterTool";
import { jacketField } from "../jacketCutGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * R5: cutting the cable by standing the cable cutters on the jacket and
 * squeezing.
 *
 * The cutters' arithmetic is checked in jacketCutGeometry.test.ts; this drives
 * the whole chain — pick them up off the shelf, carry them to a jacket, put
 * them down, squeeze — and checks that nothing reaches the cable until the
 * squeeze, that what does is what the model would have done, and that a
 * refusal is the model's own.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to lengths restated here. No test below knows a rule
 * about cutting; every rule that appears is asked of the model.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

/**
 * jsdom has no PointerEvent, and without the constructor testing-library falls
 * back to a plain Event — which drops clientX, clientY and pointerId, so every
 * drag would look like a pointer that never moved.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(window, "PointerEvent", { writable: true, configurable: true, value: TestPointerEvent });

const RECT = {
  left: 0,
  top: 0,
  width: WIDTH,
  height: HEIGHT,
  right: WIDTH,
  bottom: HEIGHT,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

function modelAfter(actions: Action[], scenario = S1_PRACTICE): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

/** What the model says a cut would do, asked directly. */
function refusalOf(cable: CableState, action: Action, scenario = S1_PRACTICE): string | null {
  const result = apply(cable, action, scenario);

  return "rejected" in result ? result.rejected : null;
}

/** The bench, with the drawing given a size and a pointer capture to watch. */
function benchAt(setup: BenchSetup = PRACTICE_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

/**
 * The bench drawing on its own, with every action it can send spied on. The
 * whole-page harness above shows what the model did; this one shows exactly how
 * many times it was asked.
 */
function benchViewAt(cable: CableState) {
  const onCut = vi.fn();
  const spies = { onStrip: vi.fn(), onUntwist: vi.fn(), onArrange: vi.fn(), onTrim: vi.fn(), onSelectEnd: vi.fn() };

  render(
    <BenchView
      cable={cable}
      scenario={S1_PRACTICE}
      selectedEnd="A"
      markers={{ A: null, B: null }}
      onCut={onCut}
      {...spies}
    />,
  );

  return { ...watch(screen.getByRole("img", { name: /Workbench/ })), onCut, ...spies };
}

const feedback = () => screen.getByTestId("feedback");
const cutters = () => screen.queryByTestId("cable-cutters");
const jacketEdgeOf = (end: EndId) => Number(screen.getByTestId(`end-${end}`).getAttribute("data-jacket-edge-mm"));
const benchLength = () => screen.getByTestId("bench-length").textContent;
/** The line the cable cutters draw. The tool panel draws markers of its own. */
const cutLine = () =>
  screen.queryAllByTestId("tool-marker").find((shown) => shown.getAttribute("data-kind") === "cut") ?? null;

const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });

const selectEnd = (end: EndId) => fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/** Strip an end from the precise controls, so its jacket edge has moved. */
function strip(end: EndId, amountMm = 30) {
  selectEnd(end);
  fireEvent.click(toolButton("Strip"));
  slide("Strip length", amountMm);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Strip end ${end}$`), hidden: true }));
}

/** Untwist every pair on the selected end, so its conductors lie flat. */
function fan() {
  fireEvent.click(toolButton("Untwist"));
  for (const pair of PAIR_IDS) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Untwist ${pair}`), hidden: true }));
  }
}

/** Where the cutters stand to cut this far behind an end's jacket edge. */
function standingAt(cable: CableState, end: EndId, backMm: number, clientY: number = CY) {
  const { x0, dir } = LAYOUT[end];

  return { clientX: x0 - dir * backMm * benchScale(cable).scale, clientY };
}

const ON_SHELF = { clientX: CABLE_CUTTER_SHELF_X, clientY: SHELF_TOP + 28 };

/** Take the cable cutters off the shelf and stand them somewhere. */
function placeCutters(svg: Element, to: { clientX: number; clientY: number }, { release = true, steps = 2 } = {}) {
  fireEvent.pointerDown(screen.getByTestId("take-cable-cutters"), { pointerId: 1, ...ON_SHELF });

  for (let step = 1; step <= steps; step++) {
    fireEvent.pointerMove(svg, {
      pointerId: 1,
      clientX: ON_SHELF.clientX + ((to.clientX - ON_SHELF.clientX) * step) / steps,
      clientY: ON_SHELF.clientY + ((to.clientY - ON_SHELF.clientY) * step) / steps,
    });
  }

  if (release) fireEvent.pointerUp(svg, { pointerId: 1, ...to });
}

/**
 * Squeeze the cutters where they stand — the way a browser sends it: a press
 * and a release on the tool, and then the click that follows them.
 *
 * Where on the tool the hand lands is deliberately not passed in. A press that
 * does not travel never moves the cutters, so the cut happens on the line they
 * were already standing on, wherever the click came down.
 */
function squeeze(svg: Element, at = { clientX: 0, clientY: 0 }) {
  const tool = cutters()!;

  fireEvent.pointerDown(tool, { pointerId: 1, ...at });
  fireEvent.pointerUp(svg, { pointerId: 1, ...at });
  fireEvent.click(tool);
}

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });

/**
 * A bench whose cable is barely longer than the body the model insists on
 * keeping. Its only purpose is to be a cable a deep cut would eat into — what
 * "too little" is remains the model's number, never restated here.
 */
const SHORT_BENCH: BenchSetup = {
  ...PRACTICE_BENCH,
  scenario: { ...PRACTICE_BENCH.scenario, startLengthMm: 70, initialEnds: { A: raw(), B: raw() } },
};
const SHORT_SCENARIO = { ...S1_PRACTICE, ...SHORT_BENCH.scenario };

describe("standing the cable cutters on the jacket", () => {
  it("picks them up off the shelf and carries them to the cable", () => {
    const { svg } = benchAt();

    expect(cutters()).toBeNull();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 14), { release: false });

    expect(cutters()!.getAttribute("data-end")).toBe("A");
    expect(cutters()!.getAttribute("data-back-mm")).toBe("14");
    expect(cutters()!.getAttribute("data-held")).toBe("true");
  });

  it("takes the pointer's capture so a drag off the drawing still arrives", () => {
    const { svg, capture } = benchAt();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 14));

    expect(capture.set).toHaveBeenCalledWith(1);
    expect(capture.release).toHaveBeenCalledWith(1);
  });

  it("stands them where they were let go, without cutting", () => {
    const { svg } = benchAt();
    const before = benchLength();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 18));

    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(cutters()!.getAttribute("data-back-mm")).toBe("18");
    expect(jacketEdgeOf("A")).toBe(0);
    expect(benchLength()).toBe(before);
    expect(feedback()).not.toHaveTextContent(/Cut end/);
  });

  it("changes nothing about the cable while they are only being positioned", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);

    placeCutters(svg, standingAt(cable, "A", 20), { release: false, steps: 5 });
    for (const backMm of [18, 15, 12, 9, 6]) {
      fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", backMm) });
    }

    expect(jacketEdgeOf("A")).toBe(0);
    expect(benchLength()).toBe(`${S1_PRACTICE.startLengthMm - cable.ends.B.jacketEdgeMm} mm`);
    expect(feedback()).not.toHaveTextContent(/Cut end/);
  });

  it("follows the hand along the jacket", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const seen: (string | null)[] = [];

    placeCutters(svg, standingAt(cable, "A", 25), { release: false });
    for (const backMm of [20, 15, 10, 5]) {
      fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", backMm) });
      seen.push(cutters()!.getAttribute("data-back-mm"));
    }

    expect(seen).toEqual(["20", "15", "10", "5"]);
  });

  it("goes back on the shelf when they are pressed and let go without travelling", () => {
    const { svg } = benchAt();

    fireEvent.pointerDown(screen.getByTestId("take-cable-cutters"), { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, ...ON_SHELF });

    expect(cutters()).toBeNull();
    expect(jacketEdgeOf("A")).toBe(0);
  });

  it("goes back on the shelf when they are let go over nothing", () => {
    const { svg } = benchAt();

    // The out-of-scale middle belongs to neither end, so there is no jacket to
    // stand them on there.
    placeCutters(svg, { clientX: WIDTH / 2, clientY: CY });

    expect(cutters()).toBeNull();
  });
});

describe("the preview while they stand there", () => {
  it("draws the line they would cut on, and what would come off", () => {
    const { svg } = benchAt();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 18));

    expect(cutLine()).not.toBeNull();
    expect(screen.getByTestId("tool-removed")).toBeInTheDocument();
  });

  it("is the model's answer, not one of the bench's", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);

    // End B's plug reaches back behind its jacket edge, and the model refuses a
    // cut that would go through it. The bench asks; it does not work that out.
    placeCutters(svg, standingAt(cable, "B", 2));

    expect(refusalOf(cable, { type: "cut", end: "B", atMm: cable.ends.B.jacketEdgeMm + 2 })).not.toBeNull();
    expect(cutters()!.getAttribute("data-refused")).toBe("true");
    expect(cutLine()!.getAttribute("data-kind")).toBe("cut");
  });

  it("shows a position the model accepts as one it accepts", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const backMm = cable.ends.B.jacketEdgeMm + 20;

    placeCutters(svg, standingAt(cable, "B", backMm));

    expect(refusalOf(cable, { type: "cut", end: "B", atMm: cable.ends.B.jacketEdgeMm + backMm })).toBeNull();
    expect(cutters()!.getAttribute("data-refused")).toBe("false");
  });

  it("says nothing at all while they are standing on no jacket", () => {
    const { svg } = benchAt();

    placeCutters(svg, { clientX: LAYOUT.A.x0, clientY: jacketField("A").y - 20 }, { release: false });

    expect(cutters()!.getAttribute("data-end")).toBe("");
    expect(cutLine()).toBeNull();
  });

  it("never speaks of a cut being right or wrong", () => {
    const { svg } = benchAt();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "B", 2));

    expect(screen.getByRole("img", { name: /Workbench/ }).textContent).not.toMatch(/correct|incorrect|wrong|right/i);
  });
});

describe("the squeeze is the cut", () => {
  it("sends what the model would have done, and nothing else", () => {
    const { svg } = benchAt();
    const start = createInitialState(S1_PRACTICE);
    const cut = modelAfter([{ type: "cut", end: "A", atMm: 12 }]);

    placeCutters(svg, standingAt(start, "A", 12));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(cut.ends.A.jacketEdgeMm);
    expect(benchLength()).toBe(`${S1_PRACTICE.startLengthMm - 12 - start.ends.B.jacketEdgeMm} mm`);
    expect(feedback()).toHaveTextContent(/Cut end A/);
  });

  it("puts the cutters away once they have cut", () => {
    const { svg } = benchAt();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 12));
    squeeze(svg);

    expect(cutters()).toBeNull();
  });

  it("sends exactly one cut per squeeze", () => {
    const { svg, onCut } = benchViewAt(createInitialState(S1_PRACTICE));

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 12));
    squeeze(svg);

    expect(onCut).toHaveBeenCalledTimes(1);
    expect(onCut).toHaveBeenCalledWith("A", 12);
  });

  it("cannot be squeezed twice: a second click finds nothing standing there", () => {
    const { svg, onCut } = benchViewAt(createInitialState(S1_PRACTICE));

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 12));
    const tool = cutters()!;
    squeeze(svg);
    fireEvent.click(tool);
    fireEvent.click(tool);

    expect(onCut).toHaveBeenCalledTimes(1);
  });

  it("is not the click that ends a drag", () => {
    const { svg, onCut } = benchViewAt(createInitialState(S1_PRACTICE));

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 12));
    // The browser sends a click after the drag that put them down. It only put
    // them down.
    fireEvent.click(cutters()!);

    expect(onCut).not.toHaveBeenCalled();
  });

  it("sends nothing while the hand is only moving them about", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 25), { release: false, steps: 8 });
    for (const backMm of [22, 19, 16, 13, 10, 7, 4]) {
      fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", backMm) });
    }

    expect(onCut).not.toHaveBeenCalled();
  });

  it("sends nothing when the hand simply lets go", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12));

    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(onCut).not.toHaveBeenCalled();
  });

  it("sends nothing from cutters standing on no jacket", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: WIDTH / 2, clientY: CY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: WIDTH / 2, clientY: CY });

    expect(cutters()).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
  });
});

describe("which end is cut", () => {
  it("is the jacket they are standing on, not the end that is selected", () => {
    const { svg } = benchAt();
    const start = createInitialState(S1_PRACTICE);
    const atMm = start.ends.B.jacketEdgeMm + 20;
    const cut = modelAfter([{ type: "cut", end: "B", atMm }]);

    selectEnd("A");
    placeCutters(svg, standingAt(start, "B", 20));
    squeeze(svg);

    expect(jacketEdgeOf("B")).toBe(cut.ends.B.jacketEdgeMm);
    expect(jacketEdgeOf("A")).toBe(start.ends.A.jacketEdgeMm);
    expect(feedback()).toHaveTextContent(/Cut end B/);
  });

  it("the other way round too: end B selected, cutters over end A", () => {
    const { svg } = benchAt();
    const start = createInitialState(S1_PRACTICE);

    selectEnd("B");
    placeCutters(svg, standingAt(start, "A", 15));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(modelAfter([{ type: "cut", end: "A", atMm: 15 }]).ends.A.jacketEdgeMm);
    expect(jacketEdgeOf("B")).toBe(start.ends.B.jacketEdgeMm);
    expect(feedback()).toHaveTextContent(/Cut end A/);
  });

  it("follows the hand across from one end to the other", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);

    placeCutters(svg, standingAt(cable, "A", 10), { release: false });
    expect(cutters()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "B", 10) });
    expect(cutters()!.getAttribute("data-end")).toBe("B");

    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 10) });
    expect(cutters()!.getAttribute("data-end")).toBe("A");
  });

  it("reports the position in the end's own millimetres", () => {
    const { svg, onCut } = benchViewAt(createInitialState(S1_PRACTICE));
    const cable = createInitialState(S1_PRACTICE);

    placeCutters(svg, standingAt(cable, "B", 20));
    squeeze(svg);

    expect(onCut).toHaveBeenCalledWith("B", cable.ends.B.jacketEdgeMm + 20);
  });
});

describe("whatever the end is doing", () => {
  it("cuts a bunched end", () => {
    const { svg } = benchAt();
    strip("A", 30);
    const cable = modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);

    expect(screen.getByTestId("end-A").getAttribute("data-fan")).toBe("");

    placeCutters(svg, standingAt(cable, "A", 10));

    expect(cutters()!.getAttribute("data-end")).toBe("A");
    expect(cutters()!.getAttribute("data-at-mm")).toBe(String(cable.ends.A.jacketEdgeMm + 10));
  });

  it("cuts a fanned end", () => {
    const { svg } = benchAt();
    strip("A", 30);
    fan();
    const cable = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    ]);

    expect(screen.getByTestId("end-A").getAttribute("data-fan")).not.toBe("");

    placeCutters(svg, standingAt(cable, "A", 10));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(
      modelAfter([
        { type: "strip", end: "A", amountMm: 30, slot: "correct" },
        ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
        { type: "cut", end: "A", atMm: cable.ends.A.jacketEdgeMm + 10 },
      ]).ends.A.jacketEdgeMm,
    );
  });

  it("cuts behind a plug, and the model says what became of the plug", () => {
    const { svg } = benchAt();
    const start = createInitialState(S1_PRACTICE);
    const atMm = start.ends.B.jacketEdgeMm + 20;

    expect(screen.getByTestId("end-B").getAttribute("data-plug")).not.toBe("none");

    placeCutters(svg, standingAt(start, "B", 20));
    squeeze(svg);

    expect(screen.getByTestId("end-B").getAttribute("data-plug")).toBe("none");
    expect(jacketEdgeOf("B")).toBe(modelAfter([{ type: "cut", end: "B", atMm }]).ends.B.jacketEdgeMm);
  });
});

describe("cancelling", () => {
  it("Escape puts the cutters back with nothing sent, while they are in hand", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(cutters()).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
  });

  it("Escape puts them back once they are standing, and a squeeze then cuts nothing", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12));
    const tool = cutters()!;
    fireEvent.keyDown(window, { key: "Escape" });

    expect(cutters()).toBeNull();

    fireEvent.click(tool);

    expect(onCut).not.toHaveBeenCalled();
  });

  it("a cancelled pointer takes the cutters off the cable, and cuts nothing", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(cutters()).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
  });

  it("leaves no stale hold behind for the next gesture", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 25), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    // A pointer that never touched the tool must not be able to move or drop it.
    fireEvent.pointerMove(svg, { pointerId: 2, ...standingAt(cable, "B", 10) });
    fireEvent.pointerUp(svg, { pointerId: 2, ...standingAt(cable, "B", 10) });

    expect(cutters()).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
  });

  it("ignores a second pointer while one hand is carrying them", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onCut } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 20), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 9, ...standingAt(cable, "B", 5) });

    expect(cutters()!.getAttribute("data-end")).toBe("A");
    expect(cutters()!.getAttribute("data-back-mm")).toBe("20");

    fireEvent.pointerUp(svg, { pointerId: 9, ...standingAt(cable, "B", 5) });

    expect(cutters()!.getAttribute("data-held")).toBe("true");
    expect(onCut).not.toHaveBeenCalled();
  });
});

describe("the model's refusals, surfaced as the model's own", () => {
  it("a cut that would go through a plug", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const atMm = cable.ends.B.jacketEdgeMm + 2;

    expect(refusalOf(cable, { type: "cut", end: "B", atMm })).toBe("cut-through-plug");

    placeCutters(svg, standingAt(cable, "B", 2));
    squeeze(svg);

    // The cable is untouched and the reason is put in the student's words, never
    // as the model's code.
    expect(jacketEdgeOf("B")).toBe(cable.ends.B.jacketEdgeMm);
    expect(screen.getByTestId("end-B").getAttribute("data-plug")).not.toBe("none");
    expect(feedback()).toHaveTextContent(/plug/i);
    expect(feedback().textContent).not.toMatch(/cut-through-plug/);
  });

  it("a cut where there is nothing to cut", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);

    expect(refusalOf(cable, { type: "cut", end: "A", atMm: cable.ends.A.jacketEdgeMm })).toBe("nothing-to-cut");

    placeCutters(svg, standingAt(cable, "A", 0));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(cable.ends.A.jacketEdgeMm);
    expect(feedback()).toHaveTextContent(/nothing to cut/i);
    expect(feedback().textContent).not.toMatch(/nothing-to-cut/);
  });

  it("a cut that would leave too little cable", () => {
    const { svg } = benchAt(SHORT_BENCH);
    const cable = createInitialState(SHORT_SCENARIO);

    expect(refusalOf(cable, { type: "cut", end: "A", atMm: 25 }, SHORT_SCENARIO)).toBe("insufficient-cable");

    const before = benchLength();
    placeCutters(svg, standingAt(cable, "A", 25));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(0);
    expect(benchLength()).toBe(before);
    expect(feedback().textContent).not.toMatch(/insufficient-cable/);
    expect(feedback().textContent).toMatch(/\S/);
  });

  it("and the same cutters make a cut the model does allow on that cable", () => {
    const { svg } = benchAt(SHORT_BENCH);
    const cable = createInitialState(SHORT_SCENARIO);

    expect(refusalOf(cable, { type: "cut", end: "A", atMm: 10 }, SHORT_SCENARIO)).toBeNull();

    placeCutters(svg, standingAt(cable, "A", 10));
    squeeze(svg);

    expect(jacketEdgeOf("A")).toBe(10);
  });

  /*
   * position-not-on-jacket is the model's answer for a cut outward of the
   * jacket edge, where an end has bare conductor and no jacket. The cutters can
   * never be standing there — the drawing has no jacket there to stand on (see
   * jacketCutGeometry) — so the gesture offers no such cut rather than putting
   * one to the model. The rule itself stays the model's, and is never restated
   * on the bench.
   */
  it("never offers a cut off the jacket, which is the model's position-not-on-jacket", () => {
    const { svg, onCut } = benchViewAt(modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]));
    const cable = modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);

    expect(refusalOf(cable, { type: "cut", end: "A", atMm: cable.ends.A.jacketEdgeMm - 10 })).toBe(
      "position-not-on-jacket",
    );

    // Out past the jacket edge, over the bare conductor.
    placeCutters(svg, standingAt(cable, "A", -10));

    expect(cutters()).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
  });
});

describe("taking the cutters disturbs nothing else", () => {
  it("does not select an end, or start any other gesture", () => {
    const { svg } = benchAt();
    selectEnd("B");

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 12), { release: false });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(screen.queryByTestId("stripper-in-hand")).toBeNull();
    // The hand has not let go yet, so nothing has been chosen by touching it.
    expect(screen.getByTestId("stage-B").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps its own pointer down: pressing the standing cutters starts nothing else", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onUntwist, onArrange, onStrip, onTrim } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 12));
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...standingAt(cable, "A", 12) });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(onUntwist).not.toHaveBeenCalled();
    expect(onArrange).not.toHaveBeenCalled();
    expect(onStrip).not.toHaveBeenCalled();
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("leaves the flush cutters on their own shelf spot", () => {
    benchAt();

    expect(screen.getByTestId("cutters-tool")).toBeInTheDocument();
    expect(screen.getByTestId("cable-cutters-tool")).toBeInTheDocument();
    expect(CABLE_CUTTER_SHELF_X).not.toBe(CUTTER_SHELF_X);
  });

  it("leaves the strippers, pairs and conductors working", () => {
    const { svg } = benchAt();

    // R1 still strips by dragging a stripper onto a jacket.
    fireEvent.pointerDown(screen.getByTestId("take-correct"), { pointerId: 1, clientX: 450, clientY: SHELF_TOP + 28 });
    const to = standingAt(createInitialState(S1_PRACTICE), "A", 20);
    fireEvent.pointerMove(svg, { pointerId: 1, ...to });
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(jacketEdgeOf("A")).toBe(20);
    expect(feedback()).toHaveTextContent(/Stripped/i);
  });
});

describe("which preview an end shows", () => {
  it("the cutters standing on it, over the tool panel's own line", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);

    // The panel marks the selected end with the tool that is out.
    selectEnd("A");
    fireEvent.click(toolButton("Strip"));
    const panelLine = screen
      .queryAllByTestId("tool-marker")
      .filter((shown) => shown.getAttribute("data-kind") === "strip");
    expect(panelLine).not.toHaveLength(0);

    placeCutters(svg, standingAt(cable, "A", 15));

    // One line on end A, and it is the cutters'.
    const onA = screen.queryAllByTestId("tool-marker").map((shown) => shown.getAttribute("data-kind"));
    expect(onA).toContain("cut");
    expect(onA).not.toContain("strip");
  });

  it("and hands the end back to the panel once the cutters are gone", () => {
    const { svg } = benchAt();

    selectEnd("A");
    fireEvent.click(toolButton("Strip"));
    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 15));
    fireEvent.keyDown(window, { key: "Escape" });

    const kinds = screen.queryAllByTestId("tool-marker").map((shown) => shown.getAttribute("data-kind"));
    expect(kinds).toContain("strip");
    expect(kinds).not.toContain("cut");
  });
});

describe("the jacket the cutters hit-test is the jacket on screen", () => {
  it("is drawn over exactly the run they can stand on", () => {
    benchAt();

    for (const end of ["A", "B"] as const) {
      const drawn = screen.getByTestId(`jacket-${end}`);
      const field = jacketField(end);
      const [from, to] = jacketRun(end);

      expect(Number(drawn.getAttribute("x"))).toBeCloseTo(from, 6);
      expect(Number(drawn.getAttribute("x")) + Number(drawn.getAttribute("width"))).toBeCloseTo(to, 6);
      // The hit region is that same band, with a little slack above and below.
      expect(Number(drawn.getAttribute("y"))).toBeGreaterThan(field.y);
      expect(Number(drawn.getAttribute("y")) + Number(drawn.getAttribute("height"))).toBeLessThan(
        field.y + field.height,
      );
    }
  });

  it("moves with the jacket edge after a cut", () => {
    const { svg } = benchAt();

    placeCutters(svg, standingAt(createInitialState(S1_PRACTICE), "A", 20));
    squeeze(svg);

    // The jacket is redrawn from its new edge, and the next cut is measured
    // from there.
    const cut = modelAfter([{ type: "cut", end: "A", atMm: 20 }]);
    placeCutters(svg, standingAt(cut, "A", 6), { release: false });

    expect(cutters()!.getAttribute("data-at-mm")).toBe(String(cut.ends.A.jacketEdgeMm + 6));
  });
});
