// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MIN_WORK, PAIR_IDS, S1_PRACTICE, apply, createInitialState } from "../../model";
import type { Action, CableState, EndId, PairId } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, WIDTH, benchScale } from "../benchGeometry";
import { BenchView } from "../components/BenchView";
import { PAIR_RELEASE, pairRegions } from "../pairGeometry";
import { PRACTICE_BENCH } from "../setup";

// These drive the bench through fixed moves written against the natural row, so
// the per-attempt starting row is pinned to it here. fanOrder.test.ts covers the draw.
vi.mock("../fanOrder", async () => {
  const { NATURAL_ORDER } = await import("../../model");

  return { startingFanOrder: () => [...NATURAL_ORDER] };
});

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

  it("still untwists on a tap with the untwist tool out: a hand that closes on a pair and lifts", () => {
    const svg = benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());
    const at = grabPoint(strippedA(), "A", "green");

    fireEvent.pointerDown(screen.getByTestId("pair-A-green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(twisted("A", "green")).toBe(false);
    expect(feedback()).toHaveTextContent(/Untwisted the green pair/);
  });

  it("does not also take the release that ends a pull, or the click after it, as a tap", () => {
    const svg = benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());

    const from = grabPoint(strippedA(), "A", "orange");
    pullPair(svg, from, CLEAR);
    // The browser sends a click after the pointer comes up; nothing is
    // untwisted a second time, wherever it lands.
    fireEvent.click(screen.getByTestId("pair-A-orange"));
    fireEvent.click(svg);

    expect(twisted("A", "orange")).toBe(false);
    expect(feedback()).toHaveTextContent(/Untwisted the orange pair/);
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

describe("a pull belongs to the pointer that took hold of the pair", () => {
  const inHand = () => screen.queryByTestId("pair-in-hand");

  it("is pulled and let go by the pointer that took hold, whatever its id", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");

    fireEvent.pointerDown(svg, { pointerId: 7, ...from });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: from.clientX, clientY: from.clientY - 2 });

    // Not yet a drag: the pair has not been pulled until the hand travels.
    expect(inHand()).toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 7, clientX: from.clientX + CLEAR.x, clientY: from.clientY + CLEAR.y });

    expect(inHand()!.getAttribute("data-pair")).toBe("orange");
    expect(inHand()!.getAttribute("data-pulling")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 7, clientX: from.clientX + CLEAR.x, clientY: from.clientY + CLEAR.y });

    expect(twisted("A", "orange")).toBe(false);
    expect(feedback()).toHaveTextContent(/Untwisted the orange pair/);
  });

  it("cannot be taken over by a second pointer closing on another pair", () => {
    const svg = benchAt();
    strip("A", 30);
    const cable = strippedA();
    const orange = grabPoint(cable, "A", "orange");
    const green = grabPoint(cable, "A", "green");

    pullPair(svg, orange, CLEAR, { release: false });
    fireEvent.pointerDown(svg, { pointerId: 2, ...green });
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: green.clientX, clientY: green.clientY + 40 });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: green.clientX, clientY: green.clientY + 40 });

    expect(inHand()!.getAttribute("data-pair")).toBe("orange");
    expect(screen.getByTestId("pair-A-green").getAttribute("data-pulled")).toBeNull();
    expect(twisted("A", "orange")).toBe(true);
    expect(twisted("A", "green")).toBe(true);

    // The first hand still has the orange pair, and finishes the pull.
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: orange.clientX + CLEAR.x, clientY: orange.clientY + CLEAR.y });

    expect(twisted("A", "orange")).toBe(false);
    expect(twisted("A", "green")).toBe(true);
  });

  it("ignores another pointer's movement: only the owner can pull the pair clear", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");

    // A short pull by the owner: a drag, but not clear of the bundle.
    pullPair(svg, from, { x: 0, y: -5 }, { release: false });

    expect(inHand()!.getAttribute("data-pulling")).toBe("false");

    fireEvent.pointerMove(svg, { pointerId: 2, clientX: from.clientX, clientY: from.clientY - 80 });

    expect(inHand()!.getAttribute("data-pulling")).toBe("false");
    expect(screen.getByTestId("pair-A-orange").getAttribute("data-open")).toBe("0.00");

    // The owner still pulls it clear.
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: from.clientX + CLEAR.x, clientY: from.clientY + CLEAR.y });

    expect(inHand()!.getAttribute("data-pulling")).toBe("true");
  });

  it("cannot be finished by a pointer that never took hold of the pair", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR, { release: false });

    fireEvent.pointerUp(svg, { pointerId: 2, ...to });

    expect(twisted("A", "orange")).toBe(true);
    expect(feedback()).not.toHaveTextContent(/Untwisted/);
    expect(inHand()!.getAttribute("data-pulling")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(twisted("A", "orange")).toBe(false);
  });

  it("is not let go by another pointer's cancel", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR, { release: false });

    fireEvent.pointerCancel(svg, { pointerId: 2 });

    expect(inHand()).not.toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(twisted("A", "orange")).toBe(false);
  });

  it("is finished by its owner exactly once", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR);

    expect(feedback()).toHaveTextContent(/Untwisted the orange pair/);

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    fireEvent.click(svg);

    expect(twisted("A", "orange")).toBe(false);
    expect(feedback()).not.toHaveTextContent(/already untwisted/i);
  });

  it("is let go by its owner's cancel, and nothing is sent after", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR, { release: false });

    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(inHand()).toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(twisted("A", "orange")).toBe(true);
  });

  it("is let go by Escape, and neither pointer lifting afterwards sends anything", () => {
    const svg = benchAt();
    strip("A", 30);
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR, { release: false });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 2, ...to });
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(inHand()).toBeNull();
    expect(twisted("A", "orange")).toBe(true);
  });

  it("does not let a second pointer coming down turn the release that ends the pull into a tap", () => {
    const svg = benchAt();
    strip("A", 30);
    fireEvent.click(untwistTool());
    const from = grabPoint(strippedA(), "A", "orange");
    const to = pullPair(svg, from, CLEAR, { release: false });

    // Another finger comes down on the bench while the pull is under way.
    fireEvent.pointerDown(svg, { pointerId: 2, clientX: WIDTH / 2, clientY: CY });
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    // The browser's click after the pull lands on the pair; it is not a second untwist.
    fireEvent.click(screen.getByTestId("pair-A-orange"));

    expect(twisted("A", "orange")).toBe(false);
    expect(feedback()).toHaveTextContent(/Untwisted the orange pair/);
    expect(feedback()).not.toHaveTextContent(/already untwisted/i);
  });

  it("can be taken by a different pointer once the first has let go", () => {
    const svg = benchAt();
    strip("A", 30);
    const cable = strippedA();

    pullPair(svg, grabPoint(cable, "A", "orange"), CLEAR);

    const after = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      { type: "untwist", end: "A", pair: "orange" },
    ]);
    const green = grabPoint(after, "A", "green");

    fireEvent.pointerDown(svg, { pointerId: 3, ...green });
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: green.clientX + CLEAR.x, clientY: green.clientY + CLEAR.y });
    fireEvent.pointerUp(svg, { pointerId: 3, clientX: green.clientX + CLEAR.x, clientY: green.clientY + CLEAR.y });

    expect(twisted("A", "green")).toBe(false);
  });
});

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

/**
 * The bench drawing on its own over a given cable, with a tap and a pull each
 * spied on — so a test can count exactly what the gesture sent. `tapping` is
 * the bench offering taps, as it does while the Untwist tool is out.
 */
function tapBenchAt(cable: CableState, { selectedEnd = "A", tapping = true }: { selectedEnd?: EndId; tapping?: boolean } = {}) {
  const onTap = vi.fn();
  const onUntwist = vi.fn();

  render(
    <BenchView
      cable={cable}
      scenario={S1_PRACTICE}
      selectedEnd={selectedEnd}
      markers={{ A: null, B: null }}
      onSelectEnd={vi.fn()}
      onStrip={vi.fn()}
      onUntwist={onUntwist}
      onArrange={vi.fn()}
      onTrim={vi.fn()}
      onCut={vi.fn()}
      onPairClick={tapping ? onTap : undefined}
    />,
  );

  const svg = screen.getByRole("img", { name: /Workbench/ });

  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);
  Object.assign(svg, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });

  return { svg, onTap, onUntwist };
}

const pairOn = (end: EndId, pair: PairId) => screen.getByTestId(`pair-${end}-${pair}`);
const nudged = (point: { clientX: number; clientY: number }, dx: number, dy = 0) => ({
  clientX: point.clientX + dx,
  clientY: point.clientY + dy,
});

/** End B as the model leaves it once its plug is cut off and its jacket stripped back. */
const openedB = () =>
  modelAfter([
    { type: "cut", end: "B", atMm: 25 },
    { type: "strip", end: "B", amountMm: 25, slot: "correct" },
  ]);

describe("a tap is a press and a release on a pair, never a click", () => {
  it("a still tap — a press and a release, and no click at all — untwists that pair once", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
    expect(onUntwist).not.toHaveBeenCalled();
  });

  it("a tap that wobbles by less than a drag still untwists once, and pulls nothing", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerMove(svg, { pointerId: 1, ...nudged(at, 2, 2) });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();

    fireEvent.pointerUp(pairOn("A", "green"), { pointerId: 1, ...nudged(at, 2, 2) });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
    expect(onUntwist).not.toHaveBeenCalled();
  });

  it("untwists once when the capture sends the release and the click to the drawing, not the pair", () => {
    // What Chrome did after a 1 px move: pointerup and click both went to the
    // svg holding the capture, and the old click-based tap was lost.
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerMove(svg, { pointerId: 1, ...nudged(at, 1) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...nudged(at, 1) });
    fireEvent.click(svg);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
  });

  it("untwists once when the release and the click stay on the pair itself", () => {
    const cable = strippedA();
    const { onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.click(pairOn("A", "green"));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
  });

  it("does nothing on a click alone, on the pair or on the drawing", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);

    fireEvent.click(pairOn("A", "green"));
    fireEvent.click(svg);

    expect(onTap).not.toHaveBeenCalled();
    expect(onUntwist).not.toHaveBeenCalled();
  });

  it("does not untwist a second time on the click, or a stray release, that follows a tap", () => {
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    fireEvent.click(pairOn("A", "green"));
    fireEvent.click(svg);
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("taps only for the hand that closed on a pair: a second pointer can neither take over nor tap", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);
    const orange = grabPoint(cable, "A", "orange");
    const green = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "orange"), { pointerId: 1, ...orange });
    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 2, ...green });
    fireEvent.pointerMove(svg, { pointerId: 2, ...nudged(green, 1) });
    fireEvent.pointerUp(pairOn("A", "green"), { pointerId: 2, ...nudged(green, 1) });
    fireEvent.click(pairOn("A", "green"));

    expect(onTap).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg, { pointerId: 1, ...orange });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "orange");
    expect(onUntwist).not.toHaveBeenCalled();
  });

  it("is not finished by a release from a pointer that never closed on the pair", () => {
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 2, ...at });

    expect(onTap).not.toHaveBeenCalled();

    // The hand that closed on the pair is still the one that taps it.
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
  });

  it("taps nothing when Escape lets the pair go before the hand lifts, click or no click", () => {
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.click(pairOn("A", "green"));
    fireEvent.click(svg);

    expect(onTap).not.toHaveBeenCalled();
  });

  it("taps nothing when the pointer is cancelled, whatever release or click follows", () => {
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    fireEvent.click(pairOn("A", "green"));

    expect(onTap).not.toHaveBeenCalled();
  });

  it("taps a pair after a pull: the pull untwists once, its release is not a tap, and the tap untwists once", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);

    pullPair(svg, grabPoint(cable, "A", "orange"), CLEAR);

    expect(onUntwist).toHaveBeenCalledTimes(1);
    expect(onUntwist).toHaveBeenCalledWith("A", "orange");
    expect(onTap).not.toHaveBeenCalled();

    const green = grabPoint(cable, "A", "green");
    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...green });
    fireEvent.pointerUp(svg, { pointerId: 1, ...green });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "green");
    expect(onUntwist).toHaveBeenCalledTimes(1);
  });

  it("taps the pair on the end the hand closed on, not the end that is selected", () => {
    const cable = openedB();
    const { svg, onTap } = tapBenchAt(cable, { selectedEnd: "A" });
    const at = grabPoint(cable, "B", "green");

    fireEvent.pointerDown(pairOn("B", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("B", "green");
  });

  it("taps the pair it closed on, wherever the hand is when it lifts", () => {
    const cable = strippedA();
    const { svg, onTap } = tapBenchAt(cable);
    const orange = grabPoint(cable, "A", "orange");

    fireEvent.pointerDown(pairOn("A", "orange"), { pointerId: 1, ...orange });
    // Lifted a little lower, still within a tap's travel.
    fireEvent.pointerUp(svg, { pointerId: 1, ...nudged(orange, 0, 3) });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith("A", "orange");
  });

  it("offers no tap unless the bench offers one — the Untwist tool out", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable, { tapping: false });
    const at = grabPoint(cable, "A", "green");

    fireEvent.pointerDown(pairOn("A", "green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    fireEvent.click(pairOn("A", "green"));

    expect(onTap).not.toHaveBeenCalled();
    expect(onUntwist).not.toHaveBeenCalled();
  });

  it("never taps with a pull: a pull past the threshold, and a slide along the cable, are not taps", () => {
    const cable = strippedA();
    const { svg, onTap, onUntwist } = tapBenchAt(cable);

    pullPair(svg, grabPoint(cable, "A", "orange"), CLEAR);
    pullPair(svg, grabPoint(cable, "A", "green"), { x: 90, y: 0 });

    expect(onUntwist).toHaveBeenCalledTimes(1);
    expect(onUntwist).toHaveBeenCalledWith("A", "orange");
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe("a tap on the whole bench", () => {
  it("untwists nothing on a tap while another tool is out", () => {
    const svg = benchAt();
    strip("A", 30);
    const at = grabPoint(strippedA(), "A", "green");

    // The Strip tool is still out: a still press and release on a pair is not an untwist.
    fireEvent.pointerDown(screen.getByTestId("pair-A-green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    fireEvent.click(screen.getByTestId("pair-A-green"));

    expect(twisted("A", "green")).toBe(true);
    expect(feedback()).not.toHaveTextContent(/Untwisted/);
  });

  it("untwists end B's pair on a tap there while end A is selected", () => {
    const svg = benchAt();
    openEndB();
    const cable = openedB();

    fireEvent.click(screen.getByRole("button", { name: "End A", hidden: true }));
    fireEvent.click(untwistTool());

    const at = grabPoint(cable, "B", "green");
    fireEvent.pointerDown(screen.getByTestId("pair-B-green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(twisted("B", "green")).toBe(false);
    expect(twisted("A", "green")).toBe(true);
    expect(feedback()).toHaveTextContent(/Untwisted the green pair/);
  });
});
