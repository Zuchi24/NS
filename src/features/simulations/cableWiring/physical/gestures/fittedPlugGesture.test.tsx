// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId, Scenario } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { HEIGHT, LAYOUT, WIDTH, benchScale } from "../benchGeometry";
import { conductorRegions, laneY } from "../conductorGeometry";
import { BenchView } from "../components/BenchView";
import { rejectionMessage } from "../messages";
import { WITHDRAW_PULL_MM, plugGrip } from "../plugGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * Taking hold of a plug already on an end, and pushing it further on or
 * pulling it off.
 *
 * The grip's arithmetic is checked in fittedPlugGeometry.test.ts; this drives
 * the whole chain with pointer events the way a browser sends them — the press
 * on the plug's grip, and the release and any click delivered to whatever the
 * browser picks, the drawing holding the pointer captured. Nothing below moves
 * a plug with a click.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to numbers restated here. No test knows how far a
 * plug may go on, or when it may come off; every rule that appears is asked of
 * the model.
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

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });

/** S1's bench with end B left raw as well, so either end can take a plug. */
const OPEN_BENCH: BenchSetup = {
  ...PRACTICE_BENCH,
  scenario: { ...PRACTICE_BENCH.scenario, initialEnds: { A: raw(), B: raw() } },
};
const OPEN_SCENARIO: Scenario = { ...S1_PRACTICE, ...OPEN_BENCH.scenario };

/** The work that makes an end ready for a plug: stripped, fanned flat, trimmed to 12 mm. */
const ready = (end: EndId): Action[] => [
  { type: "strip", end, amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
];

const insertOn = (end: EndId, pushMm: number): Action => ({ type: "insert", end, orientation: "contacts-up", pushMm });

function modelAfter(actions: Action[], scenario: Scenario = OPEN_SCENARIO): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

/** What the model says an action would do: the state it leaves, or its refusal. */
function modelSays(cable: CableState, action: Action, scenario: Scenario = OPEN_SCENARIO) {
  return apply(cable, action, scenario);
}

/** End A with a plug on it, 5 mm short of the jacket — room to push it further. */
const pluggedA = () => modelAfter([...ready("A"), insertOn("A", -5)]);
const bothPlugged = () => modelAfter([...ready("A"), insertOn("A", -5), ...ready("B"), insertOn("B", -5)]);

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

/**
 * The bench drawing on its own over a given cable, with every action it can
 * send spied on — so a test can count exactly what was sent. `moving` is the
 * bench offering a way to move a fitted plug at all.
 */
function benchViewAt(
  cable: CableState,
  { selectedEnd = "A", scenario = OPEN_SCENARIO, moving = true }: { selectedEnd?: EndId; scenario?: Scenario; moving?: boolean } = {},
) {
  const spies = {
    onPush: vi.fn(),
    onWithdraw: vi.fn(),
    onInsert: vi.fn(),
    onStrip: vi.fn(),
    onUntwist: vi.fn(),
    onArrange: vi.fn(),
    onTrim: vi.fn(),
    onCut: vi.fn(),
    onSelectEnd: vi.fn(),
  };

  render(
    <BenchView
      cable={cable}
      scenario={scenario}
      selectedEnd={selectedEnd}
      markers={{ A: null, B: null }}
      {...spies}
      onPush={moving ? spies.onPush : undefined}
      onWithdraw={moving ? spies.onWithdraw : undefined}
    />,
  );

  return { ...watch(screen.getByRole("img", { name: /Workbench/ })), ...spies };
}

/** The whole bench page, with the drawing given a size and a pointer capture to watch. */
function benchAt(setup: BenchSetup = OPEN_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

/** The middle of a fitted plug's grip, above the row or below it, from the bench's own geometry. */
function gripPoint(cable: CableState, end: EndId, band: 0 | 1 = 0) {
  const grip = plugGrip(end, cable.ends[end], benchScale(cable).scale);
  if (grip === null) throw new Error(`there is no plug on end ${end}`);

  const { y, height } = grip.bands[band];

  return { clientX: grip.x + grip.width / 2, clientY: y + height / 2 };
}

/** A point this many millimetres further inward along the end, toward the cable body. Negative is outward. */
function inward(cable: CableState, end: EndId, point: { clientX: number; clientY: number }, mm: number) {
  return { clientX: point.clientX - LAYOUT[end].dir * mm * benchScale(cable).scale, clientY: point.clientY };
}

/** Close a hand on a point, move it to another in steps, and optionally let go there. */
function move(
  svg: Element,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
  { pointerId = 1, release = true, steps = 3 }: { pointerId?: number; release?: boolean; steps?: number } = {},
) {
  fireEvent.pointerDown(svg, { pointerId, ...from });

  for (let step = 1; step <= steps; step++) {
    fireEvent.pointerMove(svg, {
      pointerId,
      clientX: from.clientX + ((to.clientX - from.clientX) * step) / steps,
      clientY: from.clientY + ((to.clientY - from.clientY) * step) / steps,
    });
  }

  if (release) fireEvent.pointerUp(svg, { pointerId, ...to });
}

const inHand = () => screen.queryByTestId("fitted-plug-in-hand");
const endGroup = (end: EndId) => screen.getByTestId(`end-${end}`);
const feedback = () => screen.getByTestId("feedback");
const trayCount = () => screen.getByTestId("tray-count");

const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });
const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const selectEnd = (end: EndId) => fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/** Fit a plug to an end through the precise controls: stripped, fanned, trimmed to 12 mm, inserted at `pushMm`. */
function plugThroughControls(end: EndId, pushMm: number) {
  selectEnd(end);
  fireEvent.click(toolButton("Strip"));
  slide("Strip length", 30);
  press(new RegExp(`^Strip end ${end}$`));
  fireEvent.click(toolButton("Untwist"));
  for (const pair of PAIR_IDS) press(new RegExp(`^Untwist ${pair}`));
  fireEvent.click(toolButton("Trim"));
  slide("Leave exposed", 12);
  press(new RegExp(`^Trim end ${end}$`));
  fireEvent.click(toolButton("Insert"));
  slide("Push the jacket into the plug", pushMm);
  press(/^Pick up a plug$/);
  press(new RegExp(`^Insert end ${end}$`));
}

/* ============================================================ */

describe("taking hold of a fitted plug", () => {
  it("takes hold of the plug under the hand, and the pointer's capture", () => {
    const cable = pluggedA();
    const { svg, capture } = benchViewAt(cable);

    fireEvent.pointerDown(svg, { pointerId: 1, ...gripPoint(cable, "A") });

    expect(capture.set).toHaveBeenCalledWith(1);
    // Nothing is drawn moving until the hand has actually travelled.
    expect(inHand()).toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 1, ...inward(cable, "A", gripPoint(cable, "A"), 4) });

    expect(inHand()!.getAttribute("data-end")).toBe("A");
  });

  it("takes it by the grip below the row just the same", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A", 1);

    move(svg, from, inward(cable, "A", from, 8));

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("A", 3);
  });

  it("draws the grip exactly where the gesture takes hold", () => {
    const cable = pluggedA();
    benchViewAt(cable);
    const grip = plugGrip("A", cable.ends.A, benchScale(cable).scale)!;
    const drawn = screen.getByTestId("plug-grip-A");

    expect(Number(drawn.getAttribute("data-x"))).toBeCloseTo(grip.x, 6);
    expect(Number(drawn.getAttribute("data-width"))).toBeCloseTo(grip.width, 6);
    expect(screen.queryByTestId("plug-grip-B")).toBeNull();
  });

  it("offers no grip, and takes no hold, on a bench with no way to move a plug", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable, { moving: false });
    const from = gripPoint(cable, "A");

    expect(screen.queryByTestId("plug-grip-A")).toBeNull();

    move(svg, from, inward(cable, "A", from, 8));

    expect(inHand()).toBeNull();
    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("leaves the conductors inside the plug to the row: a hand there picks up a conductor, not the plug", () => {
    const cable = pluggedA();
    const { svg, onPush, onArrange } = benchViewAt(cable);
    const lane = conductorRegions("A", cable.ends.A, benchScale(cable).scale)[0];
    const from = { clientX: lane.x + lane.width / 2, clientY: lane.y + lane.height / 2 };

    move(svg, from, { clientX: from.clientX, clientY: laneY(4) }, { release: false });

    expect(inHand()).toBeNull();
    expect(screen.getByTestId("conductor-in-hand").getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: from.clientX, clientY: laneY(4) });

    expect(onPush).not.toHaveBeenCalled();
    // The row's own gesture sent its move; the model is what refuses it under a plug.
    expect(onArrange).toHaveBeenCalledTimes(1);
  });

  it("claims nothing on an end without a plug", () => {
    const withPlug = pluggedA();
    const cable = modelAfter(ready("A"));
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(withPlug, "A");

    move(svg, from, inward(withPlug, "A", from, 8));
    move(svg, from, inward(withPlug, "A", from, -(WITHDRAW_PULL_MM + 2)));

    expect(inHand()).toBeNull();
    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });
});

describe("pushing a fitted plug further on", () => {
  it("shows where the model would seat it while the hand pushes, and sends nothing yet", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const result = modelSays(cable, { type: "push", end: "A", pushMm: 3 });
    if ("rejected" in result) throw new Error("model refused push");

    move(svg, from, inward(cable, "A", from, 8), { release: false });

    expect(inHand()!.getAttribute("data-move")).toBe("push");
    expect(inHand()!.getAttribute("data-push-mm")).toBe("3");
    expect(inHand()!.getAttribute("data-seat-mm")).toBe(String(result.state.ends.A.plug!.jacketInMm));
    expect(inHand()!.getAttribute("data-refused")).toBe("false");
    expect(onPush).not.toHaveBeenCalled();
  });

  it("sends exactly one push on release — the one it was showing", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw, capture } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const to = inward(cable, "A", from, 8);

    move(svg, from, to, { release: false });
    const shown = Number(inHand()!.getAttribute("data-push-mm"));

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("A", shown);
    expect(onWithdraw).not.toHaveBeenCalled();
    expect(capture.release).toHaveBeenCalledWith(1);
    expect(inHand()).toBeNull();

    // What a browser may send next — the click on the captured drawing, and a
    // stray second release — sends nothing more.
    fireEvent.click(svg);
    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(onPush).toHaveBeenCalledTimes(1);
  });

  it("shows the model's own stop when pushed past it, and sends the push as held", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const result = modelSays(cable, { type: "push", end: "A", pushMm: 15 });
    if ("rejected" in result) throw new Error("model refused push");

    move(svg, from, inward(cable, "A", from, 20), { release: false });

    expect(inHand()!.getAttribute("data-push-mm")).toBe("15");
    expect(inHand()!.getAttribute("data-seat-mm")).toBe(String(result.state.ends.A.plug!.jacketInMm));
    expect(screen.getByTestId("plug-seat")).toBeInTheDocument();

    fireEvent.pointerUp(svg, { pointerId: 1, ...inward(cable, "A", from, 20) });

    // The gesture does not clamp; the model does.
    expect(onPush).toHaveBeenCalledWith("A", 15);
  });

  it("finishes once when the release is delivered to another part of the bench", () => {
    const targets = [() => endGroup("B"), () => screen.getByTestId("take-plug"), () => screen.getByTestId("end-A")];

    for (const target of targets) {
      const cable = pluggedA();
      const { svg, onPush } = benchViewAt(cable);
      const from = gripPoint(cable, "A");
      const to = inward(cable, "A", from, 8);

      move(svg, from, to, { release: false });
      fireEvent.pointerUp(target(), { pointerId: 1, ...to });
      fireEvent.click(svg);

      expect(onPush).toHaveBeenCalledTimes(1);
      expect(onPush).toHaveBeenCalledWith("A", 3);
      cleanup();
    }
  });

  it("sends nothing on a click alone, or on a press that never travels", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const at = gripPoint(cable, "A");

    fireEvent.click(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, ...at });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: at.clientX + 1, clientY: at.clientY + 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: at.clientX + 1, clientY: at.clientY + 1 });
    fireEvent.click(svg);

    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("sends nothing for a slide across the cable", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    move(svg, from, { clientX: from.clientX, clientY: from.clientY + 30 }, { release: false });

    expect(inHand()!.getAttribute("data-move")).toBe("");

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: from.clientX, clientY: from.clientY + 30 });

    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("sends nothing for an outward pull short of the release, and pushes nothing either", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const short = inward(cable, "A", from, -(WITHDRAW_PULL_MM - 1));

    move(svg, from, short, { release: false });

    expect(inHand()!.getAttribute("data-move")).toBe("");

    fireEvent.pointerUp(svg, { pointerId: 1, ...short });

    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("marks a push the model would refuse, and still sends it: the gesture does not decide", () => {
    // S1's end B arrives crimped: the model will not move that plug.
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onPush } = benchViewAt(cable, { scenario: S1_PRACTICE });
    const from = gripPoint(cable, "B");
    const to = inward(cable, "B", from, 3);

    expect("rejected" in modelSays(cable, { type: "push", end: "B", pushMm: 12 }, S1_PRACTICE)).toBe(true);

    move(svg, from, to, { release: false });

    expect(inHand()!.getAttribute("data-refused")).toBe("true");
    expect(inHand()!.getAttribute("data-seat-mm")).toBe("");

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("B", 12);
  });
});

describe("pulling a fitted plug off", () => {
  it("pulls it off once it has been drawn back far enough, with one withdraw", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const out = inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1));

    move(svg, from, out, { release: false });

    expect(inHand()!.getAttribute("data-move")).toBe("withdraw");
    expect(inHand()!.getAttribute("data-refused")).toBe("false");
    expect(onWithdraw).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg, { pointerId: 1, ...out });
    fireEvent.click(svg);
    fireEvent.pointerUp(svg, { pointerId: 1, ...out });

    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(onWithdraw).toHaveBeenCalledWith("A");
    expect(onPush).not.toHaveBeenCalled();
  });

  it("is a push again when the hand comes back in past the seat before letting go", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, -(WITHDRAW_PULL_MM + 3)), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 1, ...inward(cable, "A", from, 8) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...inward(cable, "A", from, 8) });

    expect(onWithdraw).not.toHaveBeenCalled();
    expect(onPush).toHaveBeenCalledWith("A", 3);
  });

  it("marks a pull the model would refuse, and still sends it", () => {
    const cable = createInitialState(S1_PRACTICE);
    const { svg, onWithdraw } = benchViewAt(cable, { scenario: S1_PRACTICE });
    const from = gripPoint(cable, "B");
    const out = inward(cable, "B", from, -(WITHDRAW_PULL_MM + 1));

    move(svg, from, out, { release: false });

    expect(inHand()!.getAttribute("data-move")).toBe("withdraw");
    expect(inHand()!.getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...out });

    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(onWithdraw).toHaveBeenCalledWith("B");
  });
});

describe("which plug is moved", () => {
  it("is the plug on end A when the hand closes on end A's grip, with end B selected", () => {
    const cable = bothPlugged();
    const { svg, onPush, onWithdraw } = benchViewAt(cable, { selectedEnd: "B" });
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 8));
    move(svg, from, inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1)));

    expect(onPush).toHaveBeenCalledWith("A", 3);
    expect(onWithdraw).toHaveBeenCalledWith("A");
  });

  it("is the plug on end B when the hand closes on end B's grip, with end A selected", () => {
    const cable = bothPlugged();
    const { svg, onPush, onWithdraw } = benchViewAt(cable, { selectedEnd: "A" });
    const from = gripPoint(cable, "B");

    // End B points the other way: inward is to the left.
    expect(inward(cable, "B", from, 8).clientX).toBeLessThan(from.clientX);

    move(svg, from, inward(cable, "B", from, 8));
    move(svg, from, inward(cable, "B", from, -(WITHDRAW_PULL_MM + 1)));

    expect(onPush).toHaveBeenCalledWith("B", 3);
    expect(onWithdraw).toHaveBeenCalledWith("B");
  });

  it("keeps the plug it took hold of when the hand is carried over the other end", () => {
    const cable = bothPlugged();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const overB = gripPoint(cable, "B");

    move(svg, from, overB, { release: false });

    expect(inHand()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overB });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush.mock.calls[0][0]).toBe("A");
  });
});

describe("a plug in hand belongs to the pointer that took hold of it", () => {
  it("is moved and let go by the pointer that took hold, whatever its id", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 8), { pointerId: 7 });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("A", 3);
  });

  it("cannot be taken over by a second pointer closing on the other plug", () => {
    const cable = bothPlugged();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const fromA = gripPoint(cable, "A");
    const fromB = gripPoint(cable, "B");

    fireEvent.pointerDown(svg, { pointerId: 1, ...fromA });
    move(svg, fromB, inward(cable, "B", fromB, 8), { pointerId: 2 });

    expect(onPush).not.toHaveBeenCalled();

    fireEvent.pointerMove(svg, { pointerId: 1, ...inward(cable, "A", fromA, 8) });

    expect(inHand()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, ...inward(cable, "A", fromA, 8) });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("A", 3);
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("ignores another pointer's movement: only the owner moves the plug", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    fireEvent.pointerDown(svg, { pointerId: 1, ...from });
    fireEvent.pointerMove(svg, { pointerId: 2, ...inward(cable, "A", from, -(WITHDRAW_PULL_MM + 10)) });

    expect(inHand()).toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 1, ...inward(cable, "A", from, 8) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...inward(cable, "A", from, 8) });

    expect(onWithdraw).not.toHaveBeenCalled();
    expect(onPush).toHaveBeenCalledWith("A", 3);
  });

  it("cannot be let go by a pointer that never took hold, pushing or pulling", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 8), { release: false });
    fireEvent.pointerUp(svg, { pointerId: 9, ...inward(cable, "A", from, 8) });

    expect(onPush).not.toHaveBeenCalled();
    expect(inHand()).not.toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 1, ...inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1)) });
    fireEvent.pointerUp(svg, { pointerId: 9, ...inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1)) });

    expect(onWithdraw).not.toHaveBeenCalled();
    expect(inHand()!.getAttribute("data-move")).toBe("withdraw");
  });

  it("is not put back by another pointer's cancel", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");
    const to = inward(cable, "A", from, 8);

    move(svg, from, to, { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 4 });

    expect(inHand()).not.toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...to });

    expect(onPush).toHaveBeenCalledTimes(1);
  });

  it("is put back by its owner's cancel, pushing or pulling, and nothing is sent after", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    for (const mm of [8, -(WITHDRAW_PULL_MM + 1)]) {
      const to = inward(cable, "A", from, mm);

      move(svg, from, to, { release: false });
      fireEvent.pointerCancel(svg, { pointerId: 1 });

      expect(inHand()).toBeNull();

      fireEvent.pointerUp(svg, { pointerId: 1, ...to });
      fireEvent.click(svg);
    }

    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("is put back by Escape, pushing or pulling, and neither pointer lifting afterwards sends anything", () => {
    const cable = pluggedA();
    const { svg, onPush, onWithdraw } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    for (const mm of [8, -(WITHDRAW_PULL_MM + 1)]) {
      const to = inward(cable, "A", from, mm);

      move(svg, from, to, { release: false });
      fireEvent.keyDown(window, { key: "Escape" });

      expect(inHand()).toBeNull();

      fireEvent.pointerUp(svg, { pointerId: 1, ...to });
      fireEvent.pointerUp(svg, { pointerId: 2, ...to });
    }

    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it("can be taken by a different pointer once the first has let go", () => {
    const cable = pluggedA();
    const { svg, onPush } = benchViewAt(cable);
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 8), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    move(svg, from, inward(cable, "A", from, 8), { pointerId: 3 });

    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith("A", 3);
  });
});

describe("on the whole bench, the model decides and the bench shows its answer", () => {
  it("pushes the plug further on and draws it where the model seated it", () => {
    const { svg } = benchAt();
    plugThroughControls("A", -5);
    const cable = pluggedA();

    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "-5");

    const from = gripPoint(cable, "A");
    move(svg, from, inward(cable, "A", from, 8));

    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "3");
    expect(feedback()).toHaveTextContent("Pushed the plug further on — jacket 3 mm inside the plug.");
    expect(feedback().getAttribute("data-tone")).toBe("done");
    // The plug's grip moved with it.
    const pushed = modelAfter([...ready("A"), insertOn("A", -5), { type: "push", end: "A", pushMm: 3 }]);
    expect(Number(screen.getByTestId("plug-grip-A").getAttribute("data-x"))).toBeCloseTo(
      plugGrip("A", pushed.ends.A, benchScale(pushed).scale)!.x,
      6,
    );
  });

  it("pushes again until the model will take it no further, and says so", () => {
    const { svg } = benchAt();
    plugThroughControls("A", -5);
    const cable = pluggedA();
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 20));

    const seated = modelAfter([...ready("A"), insertOn("A", -5), { type: "push", end: "A", pushMm: 15 }]);
    const stop = seated.ends.A.plug!.jacketInMm;
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", String(stop));

    const again = gripPoint(seated, "A");
    const further = inward(seated, "A", again, 3);
    const action: Action = { type: "push", end: "A", pushMm: stop + 3 };
    const answer = modelSays(seated, action);
    if (!("rejected" in answer)) throw new Error("model accepted a push past its own stop");

    move(svg, again, further, { release: false });

    expect(inHand()!.getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...further });

    expect(feedback()).toHaveTextContent(rejectionMessage(action, answer.rejected, seated));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", String(stop));
  });

  it("pulls an uncrimped plug off and puts it back in the tray", () => {
    const { svg } = benchAt();
    plugThroughControls("A", -5);
    const cable = pluggedA();

    expect(trayCount()).toHaveTextContent("3 left · 1 used");

    const from = gripPoint(cable, "A");
    move(svg, from, inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1)));

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
    expect(feedback()).toHaveTextContent("Pulled the plug off end A and put it back in the tray.");
    expect(screen.queryByTestId("plug-grip-A")).toBeNull();
    // The conductors are the model's, untouched: still fanned, still 12 mm.
    expect(endGroup("A")).toHaveAttribute("data-exposed-max-mm", "12");
    expect(endGroup("A").getAttribute("data-fan")).not.toBe("");
  });

  it("refuses to push or pull off a crimped plug, with the model's own words, and selects its end", () => {
    const { svg } = benchAt(PRACTICE_BENCH);
    const cable = createInitialState(S1_PRACTICE);
    const from = gripPoint(cable, "B");

    const push: Action = { type: "push", end: "B", pushMm: 12 };
    move(svg, from, inward(cable, "B", from, 3));

    expect(feedback()).toHaveTextContent(rejectionMessage(push, "plug-locked", cable));
    expect(screen.getByRole("button", { name: "End B", hidden: true })).toHaveAttribute("aria-pressed", "true");

    move(svg, from, inward(cable, "B", from, -(WITHDRAW_PULL_MM + 1)));

    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "withdraw", end: "B" }, "plug-locked", cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("B")).toHaveAttribute("data-jacket-in-mm", "9");
    expect(endGroup("B")).toHaveAttribute("data-crimp", "full");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });

  it("refuses to push or pull off a plug that is plugged into a port", () => {
    const { svg } = benchAt();
    plugThroughControls("A", -5);
    fireEvent.click(toolButton("Connect"));
    press(/^Plug end A into Tester MAIN/);
    const cable = modelAfter([...ready("A"), insertOn("A", -5), { type: "connect", end: "A", endpoint: "tester-main" }]);
    const from = gripPoint(cable, "A");

    move(svg, from, inward(cable, "A", from, 8));

    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "push", end: "A", pushMm: 3 }, "plug-connected", cable));
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "-5");

    move(svg, from, inward(cable, "A", from, -(WITHDRAW_PULL_MM + 1)));

    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "withdraw", end: "A" }, "plug-connected", cable));
    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
    expect(trayCount()).toHaveTextContent("3 left · 1 used");
  });

  it("leaves the precise Push further and Withdraw controls working", () => {
    benchAt();
    plugThroughControls("A", -5);

    slide("Push the jacket into the plug", 4);
    press(/^Push further$/);

    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "4");

    fireEvent.click(toolButton("Withdraw"));
    press(/^Pull plug off end A$/);

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });
});
