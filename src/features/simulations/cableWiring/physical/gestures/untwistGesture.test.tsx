// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MIN_WORK, PAIR_IDS, S1_PRACTICE, apply, createInitialState } from "../../model";
import type { Action, CableState, EndId, PairId } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, WIDTH, benchScale } from "../benchGeometry";
import { PAIR_RELEASE, pairRegions } from "../pairGeometry";
import { PRACTICE_BENCH } from "../setup";

/**
 * R2: untwisting by taking hold of a pair and pulling it away from the cable.
 *
 * The gesture's arithmetic is checked in pairGeometry.test.ts; this drives the
 * whole chain — hand down on a pair, pull, let go — and checks the cable ends
 * up where the model would have put it.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to numbers restated here.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

/**
 * jsdom has no PointerEvent, and without the constructor testing-library falls
 * back to a plain Event — which drops clientX, clientY and pointerId, so every
 * drag would look like a pointer that never moved. A MouseEvent carries the
 * coordinates already; this only adds the pointer id.
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

function modelAfter(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

/** The bench, with the drawing given a size. One user unit per pixel. */
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

const twisted = (end: EndId, pair: PairId) =>
  screen.getByTestId(`pair-${end}-${pair}`).getAttribute("data-untwisted") === "false";

const feedback = () => screen.getByTestId("feedback");

/** The Untwist tool, whose name picks up "(suggested)" when the hint points at it. */
const untwistTool = () => screen.getByRole("button", { name: /^Untwist( \(suggested\))?$/, hidden: true });

/** Strip an end back from the precise controls, so there are pairs to pull. */
function strip(end: EndId, amountMm: number) {
  fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "Strip", hidden: true }));
  fireEvent.change(screen.getByLabelText("Strip length"), { target: { value: String(amountMm) } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Strip end ${end}$`), hidden: true }));
}

/** Cut end B's factory plug off and strip it, so both ends have pairs. */
function openEndB(amountMm = 25) {
  fireEvent.click(screen.getByRole("button", { name: "End B", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "Cut", hidden: true }));
  fireEvent.change(screen.getByLabelText("Cut behind the jacket edge"), { target: { value: "13" } });
  fireEvent.click(screen.getByRole("button", { name: /^Cut end B$/, hidden: true }));
  strip("B", amountMm);
}

/**
 * Where a pair is drawn, from the bench's own geometry — the same regions the
 * gesture hit-tests, read off the cable the model has actually produced.
 */
function grabPoint(cable: CableState, end: EndId, pair: PairId) {
  const region = pairRegions(end, cable.ends[end], benchScale(cable).scale).find((r) => r.pair === pair);
  if (region === undefined) throw new Error(`${pair} at end ${end} is not drawn`);

  return { clientX: region.x + region.width / 2, clientY: region.y + region.height / 2 };
}

/** Take hold of a pair and pull. `by` is the hand's travel in the drawing's units. */
function pullPair(
  svg: Element,
  from: { clientX: number; clientY: number },
  by: { x: number; y: number },
  { release = true, steps = 1 } = {},
) {
  fireEvent.pointerDown(svg, { pointerId: 1, ...from });

  for (let step = 1; step <= steps; step++) {
    fireEvent.pointerMove(svg, {
      pointerId: 1,
      clientX: from.clientX + (by.x * step) / steps,
      clientY: from.clientY + (by.y * step) / steps,
    });
  }

  const to = { clientX: from.clientX + by.x, clientY: from.clientY + by.y };
  if (release) fireEvent.pointerUp(svg, { pointerId: 1, ...to });

  return to;
}

/** A pull far enough to be clear of the bundle, away from the cable. */
const CLEAR = { x: 0, y: -(PAIR_RELEASE + 12) };

const strippedA = (amountMm = 30) => modelAfter([{ type: "strip", end: "A", amountMm, slot: "correct" }]);

describe("untwisting by pulling a pair apart", () => {
  it("untwists the pair the hand took hold of", () => {
    const svg = benchAt();
    strip("A", 30);

    expect(twisted("A", "orange")).toBe(true);

    pullPair(svg, grabPoint(strippedA(), "A", "orange"), CLEAR);

    const expectation = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "untwist", end: "A", pair: "orange" },
    ]);

    expect(twisted("A", "orange")).toBe(expectation.ends.A.untwisted.orange === false);
    expect(twisted("A", "orange")).toBe(false);
    expect(twisted("A", "green")).toBe(true);
    expect(feedback()).toHaveTextContent(/Untwisted the orange pair/);
  });

  it("pulls apart whichever pair is under the hand, not the one above it", () => {
    const svg = benchAt();
    strip("A", 30);

    pullPair(svg, grabPoint(strippedA(), "A", "brown"), CLEAR);

    expect(twisted("A", "brown")).toBe(false);
    for (const pair of ["orange", "green", "blue"] as const) expect(twisted("A", pair)).toBe(true);
  });

  it("shows the pair coming open while it is held, and changes nothing yet", () => {
    const svg = benchAt();
    strip("A", 30);

    pullPair(svg, grabPoint(strippedA(), "A", "orange"), CLEAR, { release: false });

    const held = screen.getByTestId("pair-in-hand");

    expect(held.getAttribute("data-pair")).toBe("orange");
    expect(held.getAttribute("data-end")).toBe("A");
    expect(held.getAttribute("data-pulling")).toBe("true");
    expect(held.getAttribute("data-refused")).toBe("false");

    const pair = screen.getByTestId("pair-A-orange");

    expect(pair.getAttribute("data-pulled")).toBe("true");
    expect(Number(pair.getAttribute("data-open"))).toBeGreaterThan(0);
    // Nothing has happened to the cable yet.
    expect(twisted("A", "orange")).toBe(true);
  });

  it("works on the end the hand is on, whatever end is selected", () => {
    const svg = benchAt();
    openEndB();
    const cable = modelAfter([
      { type: "cut", end: "B", atMm: 25 },
      { type: "strip", end: "B", amountMm: 25, slot: "correct" },
    ]);

    // Select end A, then reach over and take hold of a pair on end B.
    fireEvent.click(screen.getByRole("button", { name: "End A", hidden: true }));
    pullPair(svg, grabPoint(cable, "B", "green"), CLEAR, { release: false });

    expect(screen.getByTestId("pair-in-hand").getAttribute("data-end")).toBe("B");
    expect(screen.getByTestId("pair-in-hand").getAttribute("data-pair")).toBe("green");
  });

  it("never names one pair while another is the one being drawn open", () => {
    const svg = benchAt();
    strip("A", 30);

    pullPair(svg, grabPoint(strippedA(), "A", "blue"), CLEAR, { release: false });

    const named = screen.getByTestId("pair-in-hand").getAttribute("data-pair");
    const opening = PAIR_IDS.filter((pair) => screen.getByTestId(`pair-A-${pair}`).getAttribute("data-pulled") === "true");

    expect(named).toBe("blue");
    expect(opening).toEqual(["blue"]);
  });

  it("measures each pull from where that pair was taken hold of", () => {
    const svg = benchAt();
    strip("A", 30);

    // A long pull on one pair, then a short hold on another: no measurement
    // carries over from the first.
    pullPair(svg, grabPoint(strippedA(), "A", "orange"), { x: 0, y: -60 });

    const after = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "untwist", end: "A", pair: "orange" },
    ]);

    pullPair(svg, grabPoint(after, "A", "green"), { x: 0, y: -5 }, { release: false });

    const held = screen.getByTestId("pair-in-hand");

    expect(held.getAttribute("data-pair")).toBe("green");
    expect(held.getAttribute("data-pulling")).toBe("false");
    expect(screen.getByTestId("pair-A-green").getAttribute("data-open")).toBe("0.00");
  });
});

describe("what the gesture will not do", () => {
  it("does nothing when the hand never travels", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");

    fireEvent.pointerDown(svg, { pointerId: 1, ...from });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: from.clientX + 1, clientY: from.clientY + 1 });

    expect(twisted("A", "orange")).toBe(true);
    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
  });

  it("takes a slide along the cable as travel, not as an untwist", () => {
    const svg = benchAt();
    strip("A", 30);

    // Scenario C: ordinary travel along the cable, much further than a pull.
    pullPair(svg, grabPoint(strippedA(), "A", "orange"), { x: 90, y: 0 }, { release: false });

    const held = screen.getByTestId("pair-in-hand");

    expect(held.getAttribute("data-pulling")).toBe("false");
    expect(screen.getByTestId("pair-A-orange").getAttribute("data-open")).toBe("0.00");

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 0, clientY: CY });

    expect(twisted("A", "orange")).toBe(true);
    expect(feedback()).not.toHaveTextContent(/Untwisted/);
  });

  it("lets a pair that never came clear of the bundle fall back in", () => {
    const svg = benchAt();
    strip("A", 30);

    pullPair(svg, grabPoint(strippedA(), "A", "orange"), { x: 0, y: -(PAIR_RELEASE - 3) });

    expect(twisted("A", "orange")).toBe(true);
  });

  it("claims nothing when the hand closes on empty bench", () => {
    const svg = benchAt();
    strip("A", 30);

    pullPair(svg, { clientX: WIDTH / 2, clientY: CY }, CLEAR);

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    for (const pair of PAIR_IDS) expect(twisted("A", pair)).toBe(true);
  });

  it("lets the pair go with nothing sent when Escape is pressed", () => {
    const svg = benchAt();
    strip("A", 30);
    const to = pullPair(svg, grabPoint(strippedA(), "A", "orange"), CLEAR, { release: false });

    expect(screen.getByTestId("pair-in-hand")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    expect(screen.getByTestId("pair-A-orange").getAttribute("data-pulled")).toBeNull();
    expect(twisted("A", "orange")).toBe(true);

    // The hand coming up afterwards sends nothing either.
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    expect(twisted("A", "orange")).toBe(true);
  });

  it("lets the pair go with nothing sent when the pointer is cancelled", () => {
    const svg = benchAt();
    strip("A", 30);
    pullPair(svg, grabPoint(strippedA(), "A", "orange"), CLEAR, { release: false });

    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    expect(twisted("A", "orange")).toBe(true);
  });
});

describe("what the model says about a pull", () => {
  it("marks a pull the model would refuse, and refuses it on release", () => {
    const svg = benchAt();
    // Less exposed than the model will grip, and the model is the one that
    // knows that: the pair is still drawn, and can still be taken hold of.
    strip("A", MIN_WORK - 5);

    pullPair(svg, grabPoint(strippedA(MIN_WORK - 5), "A", "orange"), CLEAR, { release: false });

    expect(screen.getByTestId("pair-in-hand").getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(twisted("A", "orange")).toBe(true);
    expect(feedback()).toHaveTextContent(/isn't enough conductor to grip/);
    expect(feedback().getAttribute("data-tone")).toBe("refused");
  });

  it("never draws a pull the model would refuse as one that came apart", () => {
    const svg = benchAt();
    strip("A", MIN_WORK - 5);

    pullPair(svg, grabPoint(strippedA(MIN_WORK - 5), "A", "orange"), { x: 0, y: -60 }, { release: false });

    // The pair follows the hand — it is being pulled — but the twist stays in
    // it, because the model has said this would not be accepted.
    expect(screen.getByTestId("pair-in-hand").getAttribute("data-refused")).toBe("true");
    expect(screen.getByTestId("pair-A-orange").getAttribute("data-pulled")).toBe("true");
    expect(screen.getByTestId("pair-A-orange").getAttribute("data-open")).toBe("0.00");
  });

  it("does not cap the pull itself — it pulls, and the model answers", () => {
    const svg = benchAt();
    strip("A", MIN_WORK - 5);

    // However far the pair is pulled, the answer stays the model's.
    pullPair(svg, grabPoint(strippedA(MIN_WORK - 5), "A", "orange"), { x: 0, y: -140 }, { release: false });

    expect(screen.getByTestId("pair-in-hand").getAttribute("data-pulling")).toBe("true");
    expect(screen.getByTestId("pair-in-hand").getAttribute("data-refused")).toBe("true");
  });

  it("accepts the same pull once the model has enough conductor to grip", () => {
    const svg = benchAt();
    strip("A", MIN_WORK);

    pullPair(svg, grabPoint(strippedA(MIN_WORK), "A", "orange"), CLEAR, { release: false });

    expect(screen.getByTestId("pair-in-hand").getAttribute("data-refused")).toBe("false");

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(twisted("A", "orange")).toBe(false);
  });

  it("fans the end when the fourth pair is pulled apart, as the model does", () => {
    const svg = benchAt();
    strip("A", 30);
    let cable = strippedA();

    for (const pair of PAIR_IDS) {
      pullPair(svg, grabPoint(cable, "A", pair), CLEAR);
      cable = modelAfter([
        { type: "strip", end: "A", amountMm: 30, slot: "correct" },
        ...PAIR_IDS.slice(0, PAIR_IDS.indexOf(pair) + 1).map((done): Action => ({ type: "untwist", end: "A", pair: done })),
      ]);
    }

    const fanned = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
    ]);

    expect(screen.getByTestId("end-A").getAttribute("data-fan")).toBe(fanned.ends.A.fan!.join(" "));
    expect(feedback()).toHaveTextContent(/All four pairs are untwisted/);
  });
});

describe("the other ways in still work", () => {
  it("untwists from the precise controls", () => {
    benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());
    fireEvent.click(screen.getByRole("button", { name: /^Untwist blue/, hidden: true }));

    expect(twisted("A", "blue")).toBe(false);
  });

  it("still untwists on a tap with the untwist tool out", () => {
    benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());

    fireEvent.click(screen.getByTestId("pair-A-green"));

    expect(twisted("A", "green")).toBe(false);
  });

  it("does not also take the click at the end of a pull as a tap", () => {
    const svg = benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());

    const from = grabPoint(strippedA(), "A", "orange");
    pullPair(svg, from, CLEAR);
    // The browser sends a click after the pointer comes up; the pair it lands
    // on must not be untwisted a second time.
    fireEvent.click(screen.getByTestId("pair-A-orange"));

    expect(twisted("A", "orange")).toBe(false);
    expect(feedback()).not.toHaveTextContent(/already untwisted/i);
  });

  it("leaves the stripper's own gesture alone", () => {
    const svg = benchAt();
    const tool = screen.getByTestId("take-correct");

    fireEvent.pointerDown(tool, { pointerId: 1, clientX: 450, clientY: 260 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 300, clientY: CY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 300, clientY: CY });

    expect(Number(screen.getByTestId("end-A").getAttribute("data-jacket-edge-mm"))).toBeGreaterThan(0);
    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
  });
});
