// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId, Scenario } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { laneY } from "../conductorGeometry";
import { BenchView } from "../components/BenchView";
import { PLUG_SHELF_X } from "../components/PlugTool";
import { rejectionMessage } from "../messages";
import { plugRearXAt } from "../plugGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * R6: fitting a plug by taking one off the shelf, standing it on an end,
 * turning it over if need be, and pressing it on.
 *
 * The plug's arithmetic is checked in plugGeometry.test.ts; this drives the
 * whole chain with pointer events the way a browser sends them — the press on
 * the plug, and the release and any click delivered to the drawing that holds
 * the pointer captured. Nothing below pushes a plug on with a click.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to numbers restated here. No test knows how far a
 * plug may go on; every rule that appears is asked of the model.
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

/** S1's bench with end B left raw as well, so either end can be made ready for a plug. */
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

function modelAfter(actions: Action[], scenario: Scenario = S1_PRACTICE): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

/** What the model says an action would do, asked directly: its refusal, or null. */
function refusalOf(cable: CableState, action: Action, scenario: Scenario = S1_PRACTICE) {
  const result = apply(cable, action, scenario);

  return "rejected" in result ? result.rejected : null;
}

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

/** The whole bench page, with the drawing given a size and a pointer capture to watch. */
function benchAt(setup: BenchSetup = PRACTICE_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

/**
 * The bench drawing on its own over a given cable, with every action it can
 * send spied on — so a test can count exactly how many inserts were sent. The
 * cable can be swapped underneath it, as another action would.
 */
function benchViewAt(cable: CableState, selectedEnd: EndId = "A") {
  const spies = {
    onInsert: vi.fn(),
    onStrip: vi.fn(),
    onUntwist: vi.fn(),
    onArrange: vi.fn(),
    onTrim: vi.fn(),
    onCut: vi.fn(),
    onSelectEnd: vi.fn(),
  };
  const view = (next: CableState) => (
    <BenchView cable={next} scenario={S1_PRACTICE} selectedEnd={selectedEnd} markers={{ A: null, B: null }} {...spies} />
  );
  const { rerender } = render(view(cable));

  return {
    ...watch(screen.getByRole("img", { name: /Workbench/ })),
    ...spies,
    rerender: (next: CableState) => rerender(view(next)),
  };
}

const plug = () => screen.queryByTestId("physical-plug");
const flip = () => screen.queryByTestId("flip-plug");
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

/** Make an end ready for a plug through the precise controls, the way `ready()` says. */
function readyThroughControls(end: EndId) {
  selectEnd(end);
  fireEvent.click(toolButton("Strip"));
  slide("Strip length", 30);
  press(new RegExp(`^Strip end ${end}$`));
  fireEvent.click(toolButton("Untwist"));
  for (const pair of PAIR_IDS) press(new RegExp(`^Untwist ${pair}`));
  fireEvent.click(toolButton("Trim"));
  slide("Leave exposed", 12);
  press(new RegExp(`^Trim end ${end}$`));
}

/** Where a plug's rear opening stands for the jacket to be pushed this far into it. */
function standingAt(cable: CableState, end: EndId, pushMm: number, clientY: number = CY) {
  return { clientX: plugRearXAt(pushMm, end, benchScale(cable).scale), clientY };
}

const ON_SHELF = { clientX: PLUG_SHELF_X, clientY: SHELF_TOP + 28 };

/** Take a plug off the shelf and put it down somewhere. */
function placePlug(svg: Element, to: { clientX: number; clientY: number }, { release = true, steps = 2 } = {}) {
  fireEvent.pointerDown(screen.getByTestId("take-plug"), { pointerId: 1, ...ON_SHELF });

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
 * Push the standing plug on — the way a browser sends it: a press on the plug,
 * then the release and the click that follows it, both delivered to the drawing
 * that has the pointer captured.
 */
function pushOn(svg: Element, at = { clientX: 0, clientY: 0 }) {
  fireEvent.pointerDown(plug()!, { pointerId: 1, ...at });
  fireEvent.pointerUp(svg, { pointerId: 1, ...at });
  fireEvent.click(svg);
}

const readyA = () => modelAfter(ready("A"));

describe("taking a plug off the shelf", () => {
  it("picks one up and carries it with the hand", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    expect(plug()).toBeNull();

    placePlug(svg, standingAt(cable, "A", 5), { release: false });

    expect(plug()!.getAttribute("data-held")).toBe("true");
    expect(plug()!.getAttribute("data-end")).toBe("A");
    expect(plug()!.getAttribute("data-push-mm")).toBe("5");
    expect(screen.getByTestId("plug-tool").getAttribute("data-lifted")).toBe("true");
  });

  it("takes the pointer's capture so a carry off the drawing still arrives", () => {
    const cable = readyA();
    const { svg, capture } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 5));

    expect(capture.set).toHaveBeenCalledWith(1);
  });

  it("does not select an end, start any other gesture, or send anything", () => {
    const { svg } = benchAt();
    selectEnd("B");

    placePlug(svg, standingAt(createInitialState(S1_PRACTICE), "A", 5), { release: false });

    expect(screen.queryByTestId("pair-in-hand")).toBeNull();
    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();
    expect(screen.queryByTestId("stripper-in-hand")).toBeNull();
    expect(screen.getByTestId("stage-B").getAttribute("aria-pressed")).toBe("true");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });

  it("stays on the shelf when the hand closes on it and lifts without travelling", () => {
    const { svg, onInsert } = benchViewAt(readyA());

    fireEvent.pointerDown(screen.getByTestId("take-plug"), { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, ...ON_SHELF });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });
});

describe("carrying a plug", () => {
  it("follows the hand that took it, and no other", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 5), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 9, ...standingAt(cable, "B", 5) });

    expect(plug()!.getAttribute("data-end")).toBe("A");
    expect(plug()!.getAttribute("data-push-mm")).toBe("5");

    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", -3) });

    expect(plug()!.getAttribute("data-push-mm")).toBe("-3");
  });

  it("does not move until the hand has travelled far enough to be carrying it", () => {
    const { svg } = benchViewAt(readyA());

    fireEvent.pointerDown(screen.getByTestId("take-plug"), { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: ON_SHELF.clientX + 2, clientY: ON_SHELF.clientY + 1 });

    // Still where it was taken, on the shelf: over no end.
    expect(plug()!.getAttribute("data-end")).toBe("");

    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 850, clientY: CY });

    expect(plug()!.getAttribute("data-end")).toBe("B");
  });

  it("offers no flip handle while it is in hand", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 5), { release: false });

    expect(flip()).toBeNull();
  });
});

describe("standing a plug on an end", () => {
  it("stands it on end A where it was let go, without fitting it", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));

    expect(plug()!.getAttribute("data-held")).toBe("false");
    expect(plug()!.getAttribute("data-end")).toBe("A");
    expect(plug()!.getAttribute("data-push-mm")).toBe("6");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("stands it on end B just the same", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "B", 6));

    expect(plug()!.getAttribute("data-held")).toBe("false");
    expect(plug()!.getAttribute("data-end")).toBe("B");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("changes nothing about the cable while it is only being positioned", () => {
    const { svg } = benchAt();
    readyThroughControls("A");
    const cable = readyA();

    placePlug(svg, standingAt(cable, "A", 8), { release: false, steps: 5 });
    for (const pushMm of [6, 4, 2, 0, -2]) fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", pushMm) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", -2) });

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
    expect(feedback()).not.toHaveTextContent(/Fitted/);
  });

  it("goes back on the shelf when let go over the out-of-scale middle, and sends nothing", () => {
    const { svg, onInsert } = benchViewAt(readyA());

    placePlug(svg, { clientX: WIDTH / 2, clientY: CY });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("goes back on the shelf when let go off the bench, and sends nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 5), { release: false });
    fireEvent.pointerMove(svg, { pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, ...ON_SHELF });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });
});

describe("a press and a release on the standing plug is what pushes it on, never a click", () => {
  it("sends one insert when the hand that pressed it lifts without travelling", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });

    expect(onInsert).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith("A", "contacts-up", 6);
    expect(plug()).toBeNull();

    // What a browser sends next — the click on the captured drawing — and a
    // second press and release on the same spot push nothing on.
    fireEvent.click(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a click alone: the click never reaches the plug in a browser", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    fireEvent.click(plug()!);
    fireEvent.click(svg);

    expect(onInsert).not.toHaveBeenCalled();
    expect(plug()!.getAttribute("data-held")).toBe("false");
  });

  it("is not the click that ends the carry that stood it there", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    fireEvent.click(svg);

    expect(onInsert).not.toHaveBeenCalled();
  });

  it("still pushes it on when the hand wobbles by less than a drag", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);
    const wobble = { clientX: spot.clientX + 2, clientY: spot.clientY + 1 };

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });
    fireEvent.pointerMove(svg, { pointerId: 1, ...wobble });
    fireEvent.pointerUp(svg, { pointerId: 1, ...wobble });

    // Where it was standing, not where the hand wobbled to.
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith("A", "contacts-up", 6);
  });

  it("pushes it on where it stands, wherever on the plug the hand comes down", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    pushOn(svg, standingAt(cable, "A", -10, CY + 20));

    expect(onInsert).toHaveBeenCalledWith("A", "contacts-up", 6);
  });

  it("moves it instead when the hand travels before lifting", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...standingAt(cable, "A", 6) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...standingAt(cable, "A", 1) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 1) });

    expect(onInsert).not.toHaveBeenCalled();
    expect(plug()!.getAttribute("data-held")).toBe("false");
    expect(plug()!.getAttribute("data-push-mm")).toBe("1");
  });

  it("cannot be pushed on by a second hand while another is on it", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });
    fireEvent.pointerDown(plug()!, { pointerId: 2, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 2, ...spot });

    expect(onInsert).not.toHaveBeenCalled();
    expect(plug()!.getAttribute("data-held")).toBe("true");

    // The hand that pressed it is still the one that pushes it on.
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("is not finished by a release from a pointer that never pressed it", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 9, ...spot });

    expect(onInsert).not.toHaveBeenCalled();
    expect(plug()!.getAttribute("data-held")).toBe("true");
  });
});

describe("putting a plug back without fitting it", () => {
  it("Escape puts it back while it is in hand", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 6) });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("Escape puts it back once it is standing, and a press where it stood then fits nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(plug()).toBeNull();

    fireEvent.pointerDown(svg, { pointerId: 1, ...spot });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });
    fireEvent.click(svg);

    expect(onInsert).not.toHaveBeenCalled();
  });

  it("Escape halfway through pressing it on fits nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("a cancelled pointer while carrying it puts it back and fits nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 6) });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("a cancelled pointer halfway through pressing it on fits nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);
    const spot = standingAt(cable, "A", 6);

    placePlug(svg, spot);
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...spot });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...spot });

    expect(plug()).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("a cancel from another pointer does not take it out of the hand holding it", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 7 });

    expect(plug()!.getAttribute("data-held")).toBe("true");
  });
});

describe("which way up", () => {
  it("starts contacts up", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));

    expect(plug()!.getAttribute("data-orientation")).toBe("contacts-up");
  });

  it("turns over on the flip handle, which changes nothing else and sends nothing", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.click(svg);

    expect(plug()!.getAttribute("data-orientation")).toBe("contacts-down");
    expect(screen.getByTestId("plug-latch")).toBeInTheDocument();
    expect(plug()!.getAttribute("data-held")).toBe("false");
    expect(plug()!.getAttribute("data-push-mm")).toBe("6");
    expect(onInsert).not.toHaveBeenCalled();

    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(plug()!.getAttribute("data-orientation")).toBe("contacts-up");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("does not touch the cable when it is turned over", () => {
    const { svg } = benchAt();
    readyThroughControls("A");

    placePlug(svg, standingAt(readyA(), "A", 6));
    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });

  it("goes to the model the way up it was turned", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });
    pushOn(svg);

    expect(onInsert).toHaveBeenCalledWith("A", "contacts-down", 6);
  });

  it("is fitted that way up by the model", () => {
    const { svg } = benchAt();
    readyThroughControls("A");

    placePlug(svg, standingAt(readyA(), "A", 6));
    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });
    pushOn(svg);

    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-down");
  });
});

describe("which end a plug goes on", () => {
  it("is the end it stands on, not the end that is selected: end B, with end A selected", () => {
    const { svg } = benchAt(OPEN_BENCH);
    readyThroughControls("B");
    const cable = modelAfter(ready("B"), OPEN_SCENARIO);

    selectEnd("A");
    placePlug(svg, standingAt(cable, "B", 6));
    pushOn(svg);

    expect(endGroup("B")).toHaveAttribute("data-plug", "contacts-up");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(feedback()).toHaveTextContent(/Fitted a plug to end B/);
  });

  it("the other way round too: end A, with end B selected", () => {
    const { svg } = benchAt(OPEN_BENCH);
    readyThroughControls("A");
    const cable = modelAfter(ready("A"), OPEN_SCENARIO);

    selectEnd("B");
    placePlug(svg, standingAt(cable, "A", 6));
    pushOn(svg);

    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
    expect(endGroup("B")).toHaveAttribute("data-plug", "none");
    expect(feedback()).toHaveTextContent(/Fitted a plug to end A/);
  });

  it("sends the end it stands on from the drawing alone", () => {
    const cable = readyA();
    const { svg, onInsert } = benchViewAt(cable, "A");

    placePlug(svg, standingAt(cable, "B", 4));
    pushOn(svg);

    expect(onInsert).toHaveBeenCalledWith("B", "contacts-up", 4);
  });
});

describe("a plug standing over a fanned row", () => {
  it("keeps its own pointer: pressing and dragging it moves the plug, never a conductor", () => {
    const cable = readyA();
    const { svg, onArrange, onInsert } = benchViewAt(cable);
    const overRow = { clientX: 170, clientY: laneY(2) };

    placePlug(svg, standingAt(cable, "A", 4));
    // The plug lies over end A's conductors, and the hand comes down on it right
    // over one of them.
    fireEvent.pointerDown(plug()!, { pointerId: 1, ...overRow });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: overRow.clientX, clientY: overRow.clientY - 20 });

    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: overRow.clientX, clientY: overRow.clientY - 20 });

    expect(onArrange).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
    expect(plug()!.getAttribute("data-held")).toBe("false");
  });
});

describe("the plugs on the shelf", () => {
  it("are the model's tray, counted", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);

    expect(screen.getByTestId("plug-tool").getAttribute("data-count")).toBe(String(cable.tray.plugs));
    expect(screen.getByTestId("label-plugs")).toHaveTextContent(`Plugs · ${cable.tray.plugs}`);

    placePlug(svg, standingAt(cable, "A", 6));

    expect(screen.getByTestId("label-plugs")).toHaveTextContent(`Plugs · ${cable.tray.plugs - 1}`);
  });

  it("cannot be picked up when the model's tray is empty", () => {
    benchViewAt({ ...readyA(), tray: { plugs: 0 } });

    expect(screen.queryByTestId("take-plug")).toBeNull();
    expect(screen.getByTestId("label-plugs")).toHaveTextContent("Plugs · 0");
  });

  it("go down by exactly one when a plug is pushed on", () => {
    const { svg } = benchAt();
    readyThroughControls("A");

    placePlug(svg, standingAt(readyA(), "A", 6));
    pushOn(svg);

    expect(trayCount()).toHaveTextContent("3 left · 1 used");
    expect(screen.getByTestId("label-plugs")).toHaveTextContent("Plugs · 3");
  });

  it("are not offered on a bench that has no way to send an insert", () => {
    render(
      <BenchView
        cable={readyA()}
        scenario={S1_PRACTICE}
        selectedEnd="A"
        markers={{ A: null, B: null }}
        onSelectEnd={vi.fn()}
        onStrip={vi.fn()}
        onUntwist={vi.fn()}
        onArrange={vi.fn()}
        onTrim={vi.fn()}
        onCut={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("plug-tool")).toBeNull();
  });
});

describe("what the model says about a plug, surfaced as the model's own", () => {
  it("an end that is not fanned yet: marked refused while it stands, refused when pushed on", () => {
    const { svg } = benchAt();
    selectEnd("A");
    fireEvent.click(toolButton("Strip"));
    slide("Strip length", 30);
    press(/^Strip end A$/);
    const cable = modelAfter([{ type: "strip", end: "A", amountMm: 30, slot: "correct" }]);
    const action: Action = { type: "insert", end: "A", orientation: "contacts-up", pushMm: 5 };

    expect(refusalOf(cable, action)).toBe("no-fan");

    placePlug(svg, standingAt(cable, "A", 5));

    expect(plug()!.getAttribute("data-refused")).toBe("true");
    expect(plug()!.getAttribute("data-seat-mm")).toBe("");

    pushOn(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(action, "no-fan", cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });

  it("an end that already has a plug on it", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const action: Action = { type: "insert", end: "B", orientation: "contacts-up", pushMm: 5 };

    expect(refusalOf(cable, action)).toBe("plug-present");

    placePlug(svg, standingAt(cable, "B", 5));

    expect(plug()!.getAttribute("data-refused")).toBe("true");

    pushOn(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(action, "plug-present", cable));
    expect(endGroup("B").getAttribute("data-crimp")).toBe("full");
    expect(trayCount()).toHaveTextContent("4 left · 0 used");
  });

  it("an empty tray, once a standing plug is the last one: marked refused, and still put to the model", () => {
    const cable = readyA();
    const { svg, onInsert, rerender } = benchViewAt(cable);

    placePlug(svg, standingAt(cable, "A", 6));
    // The tray empties underneath it, as another insert would leave it.
    const empty: CableState = { ...cable, tray: { plugs: 0 } };
    rerender(empty);

    expect(refusalOf(empty, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 6 })).toBe("tray-empty");
    expect(plug()!.getAttribute("data-refused")).toBe("true");

    pushOn(svg);

    // The gesture does not decide; the model will refuse it.
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith("A", "contacts-up", 6);
  });

  it("an accepted position the model does not move is shown as exactly that", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);
    const result = apply(cable, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 5 }, S1_PRACTICE);
    if ("rejected" in result) throw new Error("model refused insert");

    placePlug(svg, standingAt(cable, "A", 5));

    expect(plug()!.getAttribute("data-refused")).toBe("false");
    expect(plug()!.getAttribute("data-seat-mm")).toBe(String(result.state.ends.A.plug!.jacketInMm));
    expect(plug()!.getAttribute("data-seat-mm")).toBe("5");
    expect(screen.queryByTestId("plug-seat")).toBeNull();
  });
});

describe("where the plug would stop is the model's number", () => {
  it("previews the seat the model reports, and fits the plug exactly there, once", () => {
    const { svg } = benchAt();
    readyThroughControls("A");
    const cable = readyA();
    const result = apply(cable, { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 }, S1_PRACTICE);
    if ("rejected" in result) throw new Error("model refused insert");
    const seat = result.state.ends.A.plug!.jacketInMm;

    // The model really does stop this push short of where the plug was put.
    expect(seat).not.toBe(10);

    placePlug(svg, standingAt(cable, "A", 10));

    expect(plug()!.getAttribute("data-push-mm")).toBe("10");
    expect(plug()!.getAttribute("data-seat-mm")).toBe(String(seat));
    expect(screen.getByTestId("plug-seat")).toBeInTheDocument();
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");

    pushOn(svg);

    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", String(seat));
    expect(trayCount()).toHaveTextContent("3 left · 1 used");
    expect(plug()).toBeNull();
  });

  it("previews a push the model pulls back out just the same", () => {
    const cable = readyA();
    const { svg } = benchViewAt(cable);
    const result = apply(cable, { type: "insert", end: "A", orientation: "contacts-up", pushMm: -20 }, S1_PRACTICE);
    if ("rejected" in result) throw new Error("model refused insert");

    placePlug(svg, standingAt(cable, "A", -20));

    expect(plug()!.getAttribute("data-seat-mm")).toBe(String(result.state.ends.A.plug!.jacketInMm));
    expect(plug()!.getAttribute("data-seat-mm")).not.toBe("-20");
  });
});

describe("the physical plug and the precise controls", () => {
  it("leaves the precise INSERT path working exactly as it did", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    readyThroughControls("A");

    fireEvent.click(toolButton("Insert"));
    press(/^Pick up a plug$/);
    press(/^Insert end A$/);

    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
    expect(trayCount()).toHaveTextContent("3 left · 1 used");
    expect(screen.getByTestId("label-plugs")).toHaveTextContent("Plugs · 3");
  });
});

describe("the bench never judges a plug", () => {
  it("says nothing of right or wrong while a plug is carried, standing, turned or refused", () => {
    const { svg } = benchAt();
    const cable = createInitialState(S1_PRACTICE);
    const bench = () => screen.getByRole("img", { name: /Workbench/ }).textContent ?? "";

    placePlug(svg, standingAt(cable, "A", 5), { release: false });
    expect(bench()).not.toMatch(/correct|incorrect|wrong|right/i);

    fireEvent.pointerUp(svg, { pointerId: 1, ...standingAt(cable, "A", 5) });
    expect(bench()).not.toMatch(/correct|incorrect|wrong|right/i);

    fireEvent.pointerDown(flip()!, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(bench()).not.toMatch(/correct|incorrect|wrong|right/i);

    placePlug(svg, standingAt(cable, "B", 5));
    expect(bench()).not.toMatch(/correct|incorrect|wrong|right/i);
  });
});
