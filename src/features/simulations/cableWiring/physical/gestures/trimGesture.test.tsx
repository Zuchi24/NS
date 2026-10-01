// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { NATURAL_ORDER, PAIR_IDS, S1_PRACTICE, apply, createInitialState } from "../../model";
import type { Action, CableState, EndId } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { BenchView } from "../components/BenchView";
import { CRIMPER_SHELF_X } from "../components/CrimperTool";
import { PRACTICE_BENCH } from "../setup";

/**
 * R4: trimming by standing the cutters across the conductors and squeezing.
 *
 * The cutters' arithmetic is checked in cutterGeometry.test.ts; this drives
 * the whole chain — pick them up, carry them to the conductors, put them down,
 * squeeze — and checks that nothing reaches the cable until the squeeze, and
 * that what does is what the model would have done.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to lengths restated here.
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

function modelAfter(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

/** The bench, with the drawing given a size and a pointer capture to watch. */
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

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

const feedback = () => screen.getByTestId("feedback");
const cutters = () => screen.queryByTestId("cutters");
const exposedOf = (end: EndId) => Number(screen.getByTestId(`end-${end}`).getAttribute("data-exposed-max-mm"));
/** The cut line the cutters draw. The precise tools draw markers of their own,
 *  so what matters is whether a *trim* line is on the bench. */
const cutLine = () =>
  screen.queryAllByTestId("tool-marker").find((shown) => shown.getAttribute("data-kind") === "trim") ?? null;
/** Every preview line on the bench, as drawn. */
const markersNow = () => screen.queryAllByTestId("tool-marker").map((shown) => shown.outerHTML);
/**
 * Choose Trim in the toolbar, and return the line the panel itself then draws:
 * the crimper, wherever it stands, must add nothing to it unless it stands on
 * conductor.
 */
function choosingTrim() {
  fireEvent.click(toolButton("Trim"));

  return markersNow();
}

const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });

const selectEnd = (end: EndId) => fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/** Strip an end from the precise controls, so there is conductor to cut. */
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

/** Where the cutters stand to leave this much conductor on this end. */
function standingAt(cable: CableState, end: EndId, leaveMm: number, clientY: number = CY) {
  const { x0, dir } = LAYOUT[end];

  return { clientX: x0 + dir * leaveMm * benchScale(cable).scale, clientY };
}

const ON_SHELF = { clientX: CRIMPER_SHELF_X, clientY: SHELF_TOP + 28 };

/**
 * Take the crimper off the shelf for one of its jobs. On the whole page the
 * job is chosen in the toolbar first; the bench drawing on its own is told it.
 */
function takeCrimper(job: "Trim" | "Strip", init: { pointerId: number; clientX: number; clientY: number }) {
  const button = screen.queryByRole("button", { name: new RegExp(`^${job}( \\(suggested\\))?$`), hidden: true });
  if (button !== null && button.getAttribute("aria-pressed") !== "true") fireEvent.click(button);
  fireEvent.pointerDown(screen.getByTestId("take-crimper"), init);
}

/** Take the crimper off the shelf to trim, and stand it somewhere. */
function placeCutters(
  svg: Element,
  to: { clientX: number; clientY: number },
  { release = true, steps = 2 } = {},
) {
  takeCrimper("Trim", { pointerId: 1, ...ON_SHELF });

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
 * on the tool, then the release and the click that follows it, both of which
 * the pointer capture delivers to the drawing. Nothing is ever clicked on the
 * tool itself, because in a browser nothing is.
 *
 * Where on the tool the hand lands is deliberately not passed in. A press that
 * does not travel never moves the cutters, so the cut happens on the line they
 * were already standing on, wherever the hand came down.
 */
function squeeze(svg: Element, at = { clientX: 0, clientY: 0 }) {
  fireEvent.pointerDown(cutters()!, { pointerId: 1, ...at });
  fireEvent.pointerUp(svg, { pointerId: 1, ...at });
  fireEvent.click(svg);
}

/**
 * The bench drawing on its own over a given cable, with every action it can
 * send spied on — so a test can count exactly how many times the model was
 * asked. The cable can be swapped underneath it, as another action would.
 */
function benchViewAt(cable: CableState) {
  const spies = { onTrim: vi.fn(), onCut: vi.fn(), onStrip: vi.fn(), onUntwist: vi.fn(), onArrange: vi.fn(), onSelectEnd: vi.fn() };
  const view = (next: CableState) => (
    <BenchView cable={next} scenario={S1_PRACTICE} selectedEnd="A" markers={{ A: null, B: null }} operation="trim" {...spies} />
  );
  const { rerender } = render(view(cable));
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
  Object.assign(svg, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });

  return { svg, ...spies, rerender: (next: CableState) => rerender(view(next)) };
}

/** A point this many drawing units away from another. The drawing is one unit to a pixel here. */
const nudged = (point: { clientX: number; clientY: number }, dx: number, dy = 0) => ({
  clientX: point.clientX + dx,
  clientY: point.clientY + dy,
});

const strippedA = (amountMm = 30) => modelAfter([{ type: "strip", end: "A", amountMm, slot: "correct" }]);
const fannedA = (amountMm = 30) =>
  modelAfter([
    { type: "strip", end: "A", amountMm, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  ]);

describe("standing the cutters on the conductors", () => {
  it("picks them up off the shelf and carries them to the cable", () => {
    const { svg } = benchAt();
    strip("A");

    expect(cutters()).toBeNull();

    placeCutters(svg, standingAt(strippedA(), "A", 20), { release: false });

    expect(cutters()!.getAttribute("data-end")).toBe("A");
    expect(cutters()!.getAttribute("data-mm")).toBe("20");
    expect(cutters()!.getAttribute("data-held")).toBe("true");
  });

  it("takes the pointer's capture so a drag off the drawing still arrives", () => {
    const { svg, capture } = benchAt();
    strip("A");

    placeCutters(svg, standingAt(strippedA(), "A", 20));

    expect(capture.set).toHaveBeenCalledWith(1);
    expect(capture.release).toHaveBeenCalledWith(1);
  });

  it("changes nothing about the cable while they are only being positioned", () => {
    const { svg } = benchAt();
    strip("A");
    const before = exposedOf("A");

    placeCutters(svg, standingAt(strippedA(), "A", 12), { release: false, steps: 5 });
    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(strippedA(), "A", 5) });

    expect(exposedOf("A")).toBe(before);
    expect(feedback()).not.toHaveTextContent(/Trimmed/);
  });

  it("stands them where they were let go, without cutting", () => {
    const { svg } = benchAt();
    strip("A");
    const before = exposedOf("A");

    placeCutters(svg, standingAt(strippedA(), "A", 18));

    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(cutters()!.getAttribute("data-mm")).toBe("18");
    expect(exposedOf("A")).toBe(before);
    expect(feedback()).not.toHaveTextContent(/Trimmed/);
  });

  it("shows the line they would cut on, and what would come off", () => {
    const { svg } = benchAt();
    strip("A");

    placeCutters(svg, standingAt(strippedA(), "A", 18));

    expect(cutLine()).not.toBeNull();
    expect(screen.getByTestId("tool-removed")).toBeInTheDocument();
  });

  it("follows the hand along the conductors", () => {
    const { svg } = benchAt();
    strip("A");
    const cable = strippedA();
    const seen: (string | null)[] = [];

    placeCutters(svg, standingAt(cable, "A", 25), { release: false });
    for (const mm of [20, 15, 10, 5]) {
      fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", mm) });
      seen.push(cutters()!.getAttribute("data-mm"));
    }

    expect(seen).toEqual(["20", "15", "10", "5"]);
  });

  it("leaves the cutters on the shelf when the pointer never travels", () => {
    const { svg } = benchAt();
    strip("A");

    takeCrimper("Trim", { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: ON_SHELF.clientX + 1, clientY: ON_SHELF.clientY + 1 });

    expect(cutters()).toBeNull();
  });
});

describe("neutral space", () => {
  it("stands on nothing over the middle of the cable", () => {
    const { svg } = benchAt();
    strip("A");

    const panel = choosingTrim();
    placeCutters(svg, { clientX: WIDTH / 2, clientY: CY }, { release: false });

    expect(cutters()!.getAttribute("data-end")).toBe("");
    expect(cutters()!.getAttribute("data-mm")).toBe("");
    expect(markersNow()).toEqual(panel);
  });

  it("goes back on the shelf when let go with nothing under it", () => {
    const { svg } = benchAt();
    strip("A");
    const before = exposedOf("A");

    placeCutters(svg, { clientX: WIDTH / 2, clientY: CY });

    expect(cutters()).toBeNull();
    expect(exposedOf("A")).toBe(before);
  });

  it("does not reach for the other end while it is standing on neither", () => {
    const { svg } = benchAt();
    strip("A");

    const panel = choosingTrim();
    placeCutters(svg, { clientX: WIDTH / 2, clientY: CY }, { release: false });

    expect(cutters()!.getAttribute("data-end")).toBe("");
    expect(markersNow()).toEqual(panel);
  });
});

describe("squeezing the cutters", () => {
  it("cuts where they stand, and only when they are squeezed", () => {
    const { svg } = benchAt();
    strip("A");
    fan();

    placeCutters(svg, standingAt(fannedA(), "A", 14));
    expect(exposedOf("A")).toBe(30);

    squeeze(svg);

    const expectation = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "trim", end: "A", leaveMm: 14 },
    ]);

    expect(exposedOf("A")).toBe(Math.max(...NATURAL_ORDER.map((c) => 30 - expectation.ends.A.tipMm[c])));
    expect(exposedOf("A")).toBe(14);
    expect(feedback()).toHaveTextContent(/Trimmed end A flush at 14 mm/);
  });

  it("puts the cutters down again once they have cut", () => {
    const { svg } = benchAt();
    strip("A");
    fan();

    placeCutters(svg, standingAt(fannedA(), "A", 14));
    squeeze(svg);

    expect(cutters()).toBeNull();
  });

  it("sends exactly one action, and not a second from the click that follows a drag", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();

    placeCutters(svg, standingAt(cable, "A", 20));
    // Move them along, which ends with the browser sending a click as well —
    // to the drawing, which has the pointer captured.
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...standingAt(cable, "A", 20) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 12) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 12) });
    fireEvent.click(svg);

    // Repositioning is not cutting: the cable is untouched and they are still standing.
    expect(exposedOf("A")).toBe(30);
    expect(cutters()!.getAttribute("data-mm")).toBe("12");

    squeeze(svg);

    expect(exposedOf("A")).toBe(12);
    expect(feedback()).toHaveTextContent(/Trimmed end A flush at 12 mm/);
  });

  it("cuts where the line was drawn, wherever on the cutters the hand comes down", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();

    placeCutters(svg, standingAt(cable, "A", 16));
    // A squeeze that comes down a little away from the blade still cuts at 16.
    squeeze(svg, standingAt(cable, "A", 16, CY + 9));

    expect(exposedOf("A")).toBe(16);
  });
});

describe("a squeeze is a press and a release on the cutters, never a click", () => {
  it("cuts once when the hand that pressed them lifts without travelling", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });

    expect(onTrim).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onTrim).toHaveBeenCalledTimes(1);
    expect(onTrim).toHaveBeenCalledWith("A", 14);
    expect(cutters()).toBeNull();

    // What a browser sends next — the click on the captured drawing — and a
    // second press and release on the same spot close nothing: nothing stands there.
    fireEvent.click(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onTrim).toHaveBeenCalledTimes(1);
  });

  it("does not cut on a click alone: the click never reaches the cutters in a browser", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 14));
    fireEvent.click(cutters()!);

    expect(onTrim).not.toHaveBeenCalled();
    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(cutters()!.getAttribute("data-mm")).toBe("14");
  });

  it("still cuts when the hand wobbles by less than a drag before lifting", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.pointerMove(svg, { pointerId: 1, ...nudged(spot, 2, 1) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...nudged(spot, 2, 1) });

    // At the line they were standing on, not where the hand wobbled to.
    expect(onTrim).toHaveBeenCalledTimes(1);
    expect(onTrim).toHaveBeenCalledWith("A", 14);
  });

  it("moves them instead of cutting when the hand travels before lifting", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 20));
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...standingAt(cable, "A", 20) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 12) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 12) });

    expect(onTrim).not.toHaveBeenCalled();
    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(cutters()!.getAttribute("data-mm")).toBe("12");
  });

  it("cannot be squeezed by a second hand while another is on them", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.pointerDown(cutters()!, { pointerId: 2, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 2, ...spot });

    expect(onTrim).not.toHaveBeenCalled();
    expect(cutters()!.getAttribute("data-held")).toBe("true");

    // The hand that pressed them is still the one that squeezes.
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onTrim).toHaveBeenCalledTimes(1);
  });

  it("is not finished by a release from a pointer that never pressed them", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 9, ...spot });

    expect(onTrim).not.toHaveBeenCalled();
    expect(cutters()!.getAttribute("data-held")).toBe("true");
  });

  it("cuts nothing when the pointer is cancelled halfway through a squeeze", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(cutters()).toBeNull();
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("cuts nothing when Escape is pressed halfway through a squeeze", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(cutters()).toBeNull();
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("cuts nothing when Escape puts standing cutters away before they are pressed", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(svg, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onTrim).not.toHaveBeenCalled();
  });

  it("is not a squeeze to press and let go of their empty spot on the shelf", () => {
    const cable = fannedA();
    const { svg, onTrim } = benchViewAt(cable);

    placeCutters(svg, standingAt(cable, "A", 14));
    takeCrimper("Trim", { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, ...ON_SHELF });

    expect(onTrim).not.toHaveBeenCalled();
    expect(cutters()!.getAttribute("data-held")).toBe("false");
    expect(cutters()!.getAttribute("data-mm")).toBe("14");
  });

  it("cuts nothing where there is no longer any conductor under them", () => {
    const cable = fannedA();
    const { svg, onTrim, rerender } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 14);

    placeCutters(svg, spot);
    // The cable changes underneath them: end A has no bare conductor now.
    rerender(createInitialState(S1_PRACTICE));

    expect(cutters()!.getAttribute("data-end")).toBe("");

    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onTrim).not.toHaveBeenCalled();
  });
});

describe("putting the cutters down without cutting", () => {
  it("puts them away with nothing sent when Escape is pressed in hand", () => {
    const { svg } = benchAt();
    strip("A");

    const panel = choosingTrim();
    placeCutters(svg, standingAt(strippedA(), "A", 15), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(cutters()).toBeNull();
    expect(markersNow()).toEqual(panel);
    expect(exposedOf("A")).toBe(30);
  });

  it("puts them away with nothing sent when Escape is pressed while they stand there", () => {
    const { svg } = benchAt();
    strip("A");

    const panel = choosingTrim();
    placeCutters(svg, standingAt(strippedA(), "A", 15));
    expect(cutters()).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(cutters()).toBeNull();
    expect(markersNow()).toEqual(panel);
    expect(exposedOf("A")).toBe(30);
    expect(feedback()).not.toHaveTextContent(/Trimmed/);
  });

  it("puts them away with nothing sent when the pointer is cancelled", () => {
    const { svg } = benchAt();
    strip("A");

    placeCutters(svg, standingAt(strippedA(), "A", 15), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(cutters()).toBeNull();
    expect(exposedOf("A")).toBe(30);
  });
});

describe("what the model says about a cut", () => {
  it("marks a cut the model would refuse, and refuses it on the squeeze", () => {
    const { svg } = benchAt();
    // End B arrives with a plug on it; the model will not trim under one.
    const cable = createInitialState(S1_PRACTICE);

    placeCutters(svg, standingAt(cable, "B", 6));

    expect(cutters()!.getAttribute("data-refused")).toBe("true");
    expect(cutLine()).not.toBeNull();

    squeeze(svg);

    expect(exposedOf("B")).toBe(12);
    expect(feedback()).toHaveTextContent(/plug/i);
    expect(feedback().getAttribute("data-tone")).toBe("refused");
  });

  it("marks a cut that would take nothing off, without deciding that itself", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();

    // Out past the tips: the model is the one that knows nothing would change.
    placeCutters(svg, standingAt(cable, "A", 31));

    expect(cutters()!.getAttribute("data-refused")).toBe("true");

    squeeze(svg);

    expect(exposedOf("A")).toBe(30);
    expect(feedback()).toHaveTextContent(/already no longer than that/);
  });

  it("accepts the same stand once there is something to take off", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();

    placeCutters(svg, standingAt(cable, "A", 22));

    expect(cutters()!.getAttribute("data-refused")).toBe("false");

    squeeze(svg);

    expect(exposedOf("A")).toBe(22);
  });

  it("cuts bunched pairs uneven, exactly as the model does", () => {
    const { svg } = benchAt();
    // Not fanned: the model catches some conductors shorter than others.
    strip("A");

    placeCutters(svg, standingAt(strippedA(), "A", 20));
    squeeze(svg);

    const expectation = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "trim", end: "A", leaveMm: 20 },
    ]);
    const tips = NATURAL_ORDER.map((c) => expectation.ends.A.tipMm[c]);

    expect(new Set(tips).size).toBeGreaterThan(1);
    expect(exposedOf("A")).toBe(Math.max(...tips.map((t) => 30 - t)));
    expect(feedback()).toHaveTextContent(/the cut came out uneven/);
  });
});

describe("both ends", () => {
  it("cuts the end the cutters stand on, whatever end is selected", () => {
    const { svg } = benchAt();
    // Open end B up so a cut there is one the model will make.
    selectEnd("B");
    fireEvent.click(toolButton("Cut"));
    slide("Cut behind the jacket edge", 10);
    fireEvent.click(screen.getByRole("button", { name: /^Cut end B$/, hidden: true }));
    strip("B");

    const cable = modelAfter([
      { type: "cut", end: "B", atMm: 22 },
      { type: "strip", end: "B", amountMm: 30, slot: "correct" },
    ]);

    selectEnd("A");
    placeCutters(svg, standingAt(cable, "B", 18));

    expect(cutters()!.getAttribute("data-end")).toBe("B");

    squeeze(svg);

    expect(exposedOf("B")).toBe(18);
    expect(exposedOf("A")).toBe(0);
    expect(feedback()).toHaveTextContent(/end B/);
  });

  it("cuts the end they were left on, not one the hand merely passed over", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();

    // Carried across end B's conductors on the way, and left on end A.
    placeCutters(svg, standingAt(cable, "B", 6), { release: false });
    expect(cutters()!.getAttribute("data-end")).toBe("B");

    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 17) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 17) });

    expect(cutters()!.getAttribute("data-end")).toBe("A");

    squeeze(svg);

    expect(exposedOf("A")).toBe(17);
    expect(exposedOf("B")).toBe(12);
  });
});

describe("the other ways in still work", () => {
  it("trims from the precise controls", () => {
    benchAt();
    strip("A");
    fan();
    fireEvent.click(toolButton("Trim"));
    slide("Leave exposed", 13);
    fireEvent.click(screen.getByRole("button", { name: /^Trim end A$/, hidden: true }));

    expect(exposedOf("A")).toBe(13);
  });

  it("leaves the stripper's own gesture alone", () => {
    const { svg } = benchAt();

    takeCrimper("Strip", { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: LAYOUT.A.x0 + 100, clientY: CY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: LAYOUT.A.x0 + 100, clientY: CY });

    expect(Number(screen.getByTestId("end-A").getAttribute("data-jacket-edge-mm"))).toBeGreaterThan(0);
    expect(cutters()).toBeNull();
  });

  it("does not start a conductor move when the cutters are taken off the row", () => {
    const { svg } = benchAt();
    strip("A");
    fan();
    const cable = fannedA();
    const fanBefore = screen.getByTestId("end-A").getAttribute("data-fan");

    placeCutters(svg, standingAt(cable, "A", 20));
    // The cutters stand over the row; taking hold of them is not taking hold
    // of a conductor underneath.
    fireEvent.pointerDown(cutters()!, { pointerId: 1, ...standingAt(cable, "A", 20) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 20, CY - 20) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 20, CY - 20) });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(screen.getByTestId("end-A").getAttribute("data-fan")).toBe(fanBefore);
  });
});
