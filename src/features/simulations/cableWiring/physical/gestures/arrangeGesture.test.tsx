// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState } from "../../model";
import type { Action, CableState, Conductor, EndId } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { LANE_COUNT, conductorRegions, laneY, liftedRow, rowBounds } from "../conductorGeometry";
import { PRACTICE_BENCH } from "../setup";

// These drive the bench through fixed moves written against the natural row, so
// the per-attempt starting row is pinned to it here. fanOrder.test.ts covers the draw.
vi.mock("../fanOrder", async () => {
  const { NATURAL_ORDER } = await import("../../model");

  return { startingFanOrder: () => [...NATURAL_ORDER] };
});

/**
 * R3: arranging by taking a conductor out of the row and putting it somewhere
 * else in it.
 *
 * The row's arithmetic is checked in conductorGeometry.test.ts; this drives
 * the whole chain — hand down on a wire, carry it along the row, let go — and
 * checks the cable ends up where the model would have put it.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to an order restated here.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

/**
 * jsdom has no PointerEvent, and without the constructor testing-library falls
 * back to a plain Event — which drops clientX, clientY and pointerId, so every
 * drag would look like a pointer that never moved. A MouseEvent carries the
 * coordinates already; this only adds the pointer id.
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
const fanOf = (end: EndId) => (screen.getByTestId(`end-${end}`).getAttribute("data-fan") ?? "").split(" ");
const laneDrawnAt = (end: EndId, conductor: Conductor) =>
  Number(screen.getByTestId(`lane-${end}-${conductor}`).getAttribute("data-lane"));

/** A tool button, whose name picks up "(suggested)" when the hint points at it. */
const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });

function tool(label: string) {
  fireEvent.click(toolButton(label));
}

function selectEnd(end: EndId) {
  fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));
}

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/** Strip and untwist an end from the precise controls, until it lies flat. */
function fanEnd(end: EndId, amountMm = 30) {
  selectEnd(end);
  tool("Strip");
  slide("Strip length", amountMm);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Strip end ${end}$`), hidden: true }));
  tool("Untwist");
  for (const pair of PAIR_IDS) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Untwist ${pair}`), hidden: true }));
  }
  tool("Arrange");
}

/** Cut end B's factory plug off first, so that end can be fanned as well. */
function openEndB() {
  selectEnd("B");
  tool("Cut");
  slide("Cut behind the jacket edge", 10);
  fireEvent.click(screen.getByRole("button", { name: /^Cut end B$/, hidden: true }));
  fanEnd("B");
}

/** The cable the model reaches when end A is stripped and fanned. */
const fannedA = (amountMm = 30) =>
  modelAfter([
    { type: "strip", end: "A", amountMm, slot: "correct" },
    ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  ]);

/** Where a conductor is drawn, from the bench's own row geometry. */
function grabPoint(cable: CableState, end: EndId, conductor: Conductor) {
  const region = conductorRegions(end, cable.ends[end], benchScale(cable).scale).find(
    (r) => r.conductor === conductor,
  );
  if (region === undefined) throw new Error(`${conductor} at end ${end} is not drawn`);

  return { clientX: region.x + region.width / 2, clientY: region.y + region.height / 2 };
}

/** Carry the conductor in hand to a point, in steps, and optionally let go. */
function carry(
  svg: Element,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
  { release = true, steps = 3 } = {},
) {
  fireEvent.pointerDown(svg, { pointerId: 1, ...from });

  for (let step = 1; step <= steps; step++) {
    fireEvent.pointerMove(svg, {
      pointerId: 1,
      clientX: from.clientX + ((to.clientX - from.clientX) * step) / steps,
      clientY: from.clientY + ((to.clientY - from.clientY) * step) / steps,
    });
  }

  if (release) fireEvent.pointerUp(svg, { pointerId: 1, ...to });
}

/** The middle of a lane, at the same x the conductor was taken from. */
const overLane = (from: { clientX: number }, index: number) => ({
  clientX: from.clientX,
  clientY: laneY(index, CY),
});

describe("arranging by carrying a conductor along the row", () => {
  it("moves the conductor the hand took hold of into the lane it was let go over", () => {
    const { svg } = benchAt();
    fanEnd("A");

    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 5));

    const expectation = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "moveConductor", end: "A", conductor: moved, toIndex: 5 },
    ]);

    expect(fanOf("A")).toEqual(expectation.ends.A.fan);
    expect(fanOf("A")[5]).toBe(moved);
    expect(feedback()).toHaveTextContent(/from position 1 to position 6/);
  });

  it("carries whichever conductor is under the hand, lane by lane", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();

    cable.ends.A.fan!.forEach((conductor, index) => {
      const from = grabPoint(cable, "A", conductor);

      // Somewhere other than its own lane, so the hand actually travels.
      carry(svg, from, overLane(from, (index + 4) % LANE_COUNT), { release: false });
      expect(screen.getByTestId("conductor-in-hand").getAttribute("data-conductor")).toBe(conductor);
      fireEvent.keyDown(window, { key: "Escape" });
    });
  });

  it("takes the pointer's capture so a drag off the drawing still arrives", () => {
    const { svg, capture } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const from = grabPoint(cable, "A", cable.ends.A.fan![1]);

    carry(svg, from, overLane(from, 4));

    expect(capture.set).toHaveBeenCalledWith(1);
    expect(capture.release).toHaveBeenCalledWith(1);
  });
});

describe("what the row shows while a conductor is in hand", () => {
  it("holds a lane open where the conductor would land", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 3), { release: false });

    expect(screen.getByTestId("insertion-A").getAttribute("data-index")).toBe("3");
    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-to-index")).toBe("3");
    // The conductor itself is out of the row, not drawn in it.
    expect(screen.queryByTestId(`lane-A-${moved}`)).toBeNull();
    expect(screen.getByTestId("held-A").getAttribute("data-conductor")).toBe(moved);
  });

  it("slides its neighbours over, exactly as the model would leave them", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const fan = cable.ends.A.fan!;
    const moved = fan[6];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 1), { release: false });

    const { lanes } = liftedRow(fan, moved, 1);

    for (const [conductor, lane] of lanes) expect(laneDrawnAt("A", conductor)).toBe(lane);
  });

  it("moves the lane it is holding open as the hand moves along the row", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    fireEvent.pointerDown(svg, { pointerId: 1, ...from });
    // A nudge along the conductor first: enough travel to be a drag, without
    // leaving the lane it started in.
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: from.clientX + 6, clientY: from.clientY });

    const seen: string[] = [];
    for (let index = 0; index < LANE_COUNT; index++) {
      fireEvent.pointerMove(svg, { pointerId: 1, ...overLane(from, index) });
      seen.push(screen.getByTestId("insertion-A").getAttribute("data-index")!);
    }

    expect(seen).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("reaches the first and last lanes at the edges of the row", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![3];
    const from = grabPoint(cable, "A", moved);
    const bounds = rowBounds("A", cable.ends.A, benchScale(cable).scale, CY)!;

    carry(svg, from, { clientX: from.clientX, clientY: bounds.y + 0.5 }, { release: false });
    expect(screen.getByTestId("insertion-A").getAttribute("data-index")).toBe("0");

    fireEvent.pointerMove(svg, { pointerId: 1, clientX: from.clientX, clientY: bounds.y + bounds.height - 0.5 });
    expect(screen.getByTestId("insertion-A").getAttribute("data-index")).toBe(String(LANE_COUNT - 1));

    fireEvent.keyDown(window, { key: "Escape" });
  });
});

describe("neutral space", () => {
  it("offers no lane while the hand is off the row, and holds nothing open", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![2];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, { clientX: WIDTH / 2, clientY: SHELF_TOP - 10 }, { release: false });

    const hand = screen.getByTestId("conductor-in-hand");

    expect(hand.getAttribute("data-conductor")).toBe(moved);
    expect(hand.getAttribute("data-to-index")).toBe("");
    expect(screen.queryByTestId("insertion-A")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("commits nothing when the conductor is let go off the row", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const from = grabPoint(cable, "A", cable.ends.A.fan![2]);

    carry(svg, from, { clientX: WIDTH / 2, clientY: SHELF_TOP - 10 });

    expect(fanOf("A")).toEqual(before);
    expect(feedback()).not.toHaveTextContent(/Moved/);
  });

  it("keeps the conductor in hand when it is carried over the other end's row", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![1];
    const from = grabPoint(cable, "A", moved);

    // End B is fanned too, but a conductor cannot move between ends: over B's
    // row the hand is offering it nowhere at all.
    carry(svg, from, grabPoint(cable, "B", cable.ends.B.fan![4]), { release: false });

    const hand = screen.getByTestId("conductor-in-hand");

    expect(hand.getAttribute("data-end")).toBe("A");
    expect(hand.getAttribute("data-conductor")).toBe(moved);
    expect(hand.getAttribute("data-to-index")).toBe("");
    expect(screen.queryByTestId("insertion-B")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("does nothing when the hand closes on empty bench", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const before = fanOf("A");

    carry(svg, { clientX: WIDTH / 2, clientY: CY }, { clientX: WIDTH / 2, clientY: CY - 30 });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(fanOf("A")).toEqual(before);
  });

  it("does nothing when the hand never travels", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const from = grabPoint(cable, "A", cable.ends.A.fan![0]);

    fireEvent.pointerDown(svg, { pointerId: 1, ...from });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: from.clientX + 1, clientY: from.clientY + 1 });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(fanOf("A")).toEqual(before);
  });
});

describe("putting the conductor back", () => {
  it("puts it back with nothing sent when Escape is pressed", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);
    const to = overLane(from, 6);

    carry(svg, from, to, { release: false });
    expect(screen.getByTestId("insertion-A")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(screen.queryByTestId("insertion-A")).toBeNull();
    expect(screen.getByTestId(`lane-A-${moved}`)).toBeInTheDocument();
    expect(laneDrawnAt("A", moved)).toBe(0);
    expect(fanOf("A")).toEqual(before);

    // The hand coming up afterwards sends nothing either.
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    expect(fanOf("A")).toEqual(before);
  });

  it("puts it back with nothing sent when the pointer is cancelled", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const from = grabPoint(cable, "A", cable.ends.A.fan![0]);

    carry(svg, from, overLane(from, 6), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(screen.queryByTestId("insertion-A")).toBeNull();
    expect(fanOf("A")).toEqual(before);
  });
});

describe("what the model says about a move", () => {
  it("marks a move the model would refuse, and refuses it on release", () => {
    const { svg } = benchAt();
    // S1's end B arrives with a plug on it: the wires are drawn and can be
    // taken hold of, and the model is what knows they cannot be moved.
    const cable = createInitialState(S1_PRACTICE);
    const moved = cable.ends.B.fan![0];
    const before = fanOf("B");
    const from = grabPoint(cable, "B", moved);

    carry(svg, from, overLane(from, 4), { release: false });

    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-refused")).toBe("true");
    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-to-index")).toBe("4");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 4) });

    expect(fanOf("B")).toEqual(before);
    expect(feedback()).toHaveTextContent(/plug/i);
    expect(feedback().getAttribute("data-tone")).toBe("refused");
  });

  it("rearranges nothing in the drawing while the model is refusing", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const fan = cable.ends.B.fan!;
    const from = grabPoint(cable, "B", fan[0]);

    carry(svg, from, overLane(from, 4), { release: false });

    // The lane is still marked — that is where it is being offered — but a
    // move the model will not make is never drawn as one that worked.
    expect(screen.getByTestId("insertion-B").getAttribute("data-index")).toBe("4");
    for (const conductor of fan.slice(1)) expect(laneDrawnAt("B", conductor)).toBe(fan.indexOf(conductor));

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("lets a conductor be put back where it came from, and takes the model's answer", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const moved = cable.ends.A.fan![2];
    const from = grabPoint(cable, "A", moved);

    // Carried away and brought back to its own lane: a real attempt, which the
    // model answers for itself.
    carry(svg, from, overLane(from, 6), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 1, ...overLane(from, 2) });

    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 2) });

    expect(fanOf("A")).toEqual(before);
    expect(feedback()).toHaveTextContent(/already in that position/);
  });

  it("accepts every other lane the model accepts", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 1), { release: false });

    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-refused")).toBe("false");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 1) });

    expect(fanOf("A")[1]).toBe(moved);
  });
});

describe("both ends", () => {
  it("arranges end B's own row, from end B's own geometry", () => {
    const { svg } = benchAt();
    openEndB();

    const cable = modelAfter([
      { type: "cut", end: "B", atMm: 22 },
      { type: "strip", end: "B", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "B", pair })),
    ]);
    const moved = cable.ends.B.fan![7];
    const from = grabPoint(cable, "B", moved);

    // Selected end is irrelevant: the hand is on end B's row.
    selectEnd("A");
    carry(svg, from, overLane(from, 0));

    const expectation = modelAfter([
      { type: "cut", end: "B", atMm: 22 },
      { type: "strip", end: "B", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "B", pair })),
      { type: "moveConductor", end: "B", conductor: moved, toIndex: 0 },
    ]);

    expect(fanOf("B")).toEqual(expectation.ends.B.fan);
    expect(fanOf("A")).toEqual([""]);
  });

  it("works on each end in turn without either disturbing the other", () => {
    const { svg } = benchAt();
    fanEnd("A");
    openEndB();

    const cable = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "cut", end: "B", atMm: 22 },
      { type: "strip", end: "B", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "B", pair })),
    ]);

    const atA = cable.ends.A.fan![0];
    const fromA = grabPoint(cable, "A", atA);
    carry(svg, fromA, overLane(fromA, 2));

    const bBefore = fanOf("B");
    expect(fanOf("A")[2]).toBe(atA);
    expect(bBefore).toEqual(cable.ends.B.fan);

    const atB = cable.ends.B.fan![1];
    const fromB = grabPoint(cable, "B", atB);
    carry(svg, fromB, overLane(fromB, 6));

    expect(fanOf("B")[6]).toBe(atB);
    expect(fanOf("A")[2]).toBe(atA);
  });
});

describe("the other ways in still work", () => {
  it("arranges from the precise controls", () => {
    benchAt();
    fanEnd("A");
    const moved = fannedA().ends.A.fan![0];

    fireEvent.click(screen.getByRole("button", { name: /^Position 1:/, hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: /^Position 8:/, hidden: true }));

    expect(fanOf("A")[7]).toBe(moved);
  });

  it("does not also take the click at the end of a drag as a precise move", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 4));
    // The browser sends a click after the pointer comes up; it must not move
    // anything a second time.
    fireEvent.click(svg);

    expect(fanOf("A")[4]).toBe(moved);
    expect(feedback()).toHaveTextContent(/from position 1 to position 5/);
  });

  it("leaves the stripper's own gesture alone", () => {
    const { svg } = benchAt();

    fireEvent.pointerDown(screen.getByTestId("take-correct"), { pointerId: 1, clientX: 450, clientY: SHELF_TOP + 30 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: LAYOUT.A.x0 + 100, clientY: CY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: LAYOUT.A.x0 + 100, clientY: CY });

    expect(Number(screen.getByTestId("end-A").getAttribute("data-jacket-edge-mm"))).toBeGreaterThan(0);
    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
  });

  it("leaves the untwist gesture alone on an end that is not fanned yet", () => {
    benchAt();
    selectEnd("A");
    tool("Strip");
    slide("Strip length", 30);
    fireEvent.click(screen.getByRole("button", { name: /^Strip end A$/, hidden: true }));

    // Twisted pairs, not a row: the hand takes a pair, not a conductor.
    const pair = screen.getByTestId("pair-A-orange");
    expect(pair.getAttribute("data-untwisted")).toBe("false");

    const cable = modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
    const { scale } = benchScale(cable);

    expect(conductorRegions("A", cable.ends.A, scale)).toEqual([]);
  });
});

describe("a conductor in hand belongs to the pointer that picked it up", () => {
  const inHand = () => screen.queryByTestId("conductor-in-hand");

  it("is carried and let go by the pointer that picked it up, whatever its id", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    fireEvent.pointerDown(svg, { pointerId: 7, ...from });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: from.clientX + 2, clientY: from.clientY });

    // Not yet a drag: nothing is out of the row until the hand travels.
    expect(inHand()).toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 7, ...overLane(from, 3) });

    expect(inHand()!.getAttribute("data-to-index")).toBe("3");

    fireEvent.pointerUp(svg, { pointerId: 7, ...overLane(from, 3) });

    expect(fanOf("A")[3]).toBe(moved);
    expect(feedback()).toHaveTextContent(/from position 1 to position 4/);
  });

  it("cannot be taken over by a second pointer closing on another conductor", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);
    const other = grabPoint(cable, "A", cable.ends.A.fan![5]);

    carry(svg, from, overLane(from, 3), { release: false });
    fireEvent.pointerDown(svg, { pointerId: 2, ...other });
    fireEvent.pointerMove(svg, { pointerId: 2, ...overLane(other, 6) });
    fireEvent.pointerUp(svg, { pointerId: 2, ...overLane(other, 6) });

    expect(inHand()!.getAttribute("data-conductor")).toBe(moved);
    expect(inHand()!.getAttribute("data-to-index")).toBe("3");
    expect(fanOf("A")).toEqual(before);

    // The first hand still has the first conductor, and puts it where it is offering it.
    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 3) });

    expect(fanOf("A")[3]).toBe(moved);
    expect(feedback()).toHaveTextContent(/from position 1 to position 4/);
  });

  it("offers only the lane the owner's hand is over", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const from = grabPoint(cable, "A", cable.ends.A.fan![0]);

    carry(svg, from, overLane(from, 3), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 2, ...overLane(from, 6) });

    expect(inHand()!.getAttribute("data-to-index")).toBe("3");
    expect(screen.getByTestId("insertion-A").getAttribute("data-index")).toBe("3");

    // The owner still moves the offer along the row.
    fireEvent.pointerMove(svg, { pointerId: 1, ...overLane(from, 5) });

    expect(inHand()!.getAttribute("data-to-index")).toBe("5");
    expect(screen.getByTestId("insertion-A").getAttribute("data-index")).toBe("5");

    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("cannot be let go into a lane by a pointer that never picked it up", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 3), { release: false });
    fireEvent.pointerUp(svg, { pointerId: 2, ...overLane(from, 3) });

    expect(fanOf("A")).toEqual(before);
    expect(feedback()).not.toHaveTextContent(/Moved/);
    expect(inHand()!.getAttribute("data-to-index")).toBe("3");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 3) });

    expect(fanOf("A")[3]).toBe(moved);
  });

  it("is not put back by another pointer's cancel", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 3), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 2 });

    expect(inHand()).not.toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 3) });

    expect(fanOf("A")[3]).toBe(moved);
  });

  it("is let go by its owner exactly once", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const moved = cable.ends.A.fan![0];
    const from = grabPoint(cable, "A", moved);

    carry(svg, from, overLane(from, 4));
    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 4) });
    fireEvent.click(svg);

    expect(fanOf("A")[4]).toBe(moved);
    expect(feedback()).toHaveTextContent(/from position 1 to position 5/);
    expect(feedback()).not.toHaveTextContent(/already in that position/);
  });

  it("is put back by its owner's cancel, and nothing is sent after", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const from = grabPoint(cable, "A", cable.ends.A.fan![0]);

    carry(svg, from, overLane(from, 6), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });

    expect(inHand()).toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 6) });

    expect(fanOf("A")).toEqual(before);
  });

  it("is put back by Escape, and neither pointer lifting afterwards sends anything", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const before = fanOf("A");
    const from = grabPoint(cable, "A", cable.ends.A.fan![0]);

    carry(svg, from, overLane(from, 6), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 2, ...overLane(from, 6) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overLane(from, 6) });

    expect(inHand()).toBeNull();
    expect(fanOf("A")).toEqual(before);
  });

  it("can be picked up by a different pointer once the first has let go", () => {
    const { svg } = benchAt();
    fanEnd("A");
    const cable = fannedA();
    const first = cable.ends.A.fan![0];
    const fromFirst = grabPoint(cable, "A", first);

    carry(svg, fromFirst, overLane(fromFirst, 4));

    const after = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "moveConductor", end: "A", conductor: first, toIndex: 4 },
    ]);
    const second = after.ends.A.fan![7];
    const fromSecond = grabPoint(after, "A", second);

    fireEvent.pointerDown(svg, { pointerId: 3, ...fromSecond });
    fireEvent.pointerMove(svg, { pointerId: 3, ...overLane(fromSecond, 3) });
    fireEvent.pointerMove(svg, { pointerId: 3, ...overLane(fromSecond, 0) });
    fireEvent.pointerUp(svg, { pointerId: 3, ...overLane(fromSecond, 0) });

    expect(fanOf("A")[0]).toBe(second);
  });
});
