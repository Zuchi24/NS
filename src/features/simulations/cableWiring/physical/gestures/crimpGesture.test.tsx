// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId, Scenario } from "../../model";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { BenchView } from "../components/BenchView";
import { CRIMPER_SHELF_X } from "../components/CrimperTool";
import { rejectionMessage } from "../messages";
import { plugGrip } from "../plugGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * Crimping a plug by taking the crimper off the shelf, standing it on the plug
 * and squeezing.
 *
 * The crimper's arithmetic is checked in crimperGeometry.test.ts; this drives
 * the whole chain with pointer events the way a browser sends them — the press
 * on the crimper, then the release and any click delivered to whatever the
 * browser picks, the drawing holding the pointer captured. Nothing below
 * crimps a plug with a click.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to rules restated here. No test knows when a plug
 * may be crimped; every refusal that appears is asked of the model.
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

/** The work that puts a plug on an end: stripped, fanned flat, trimmed to 12 mm, pushed on. */
const plugOn = (end: EndId, pushMm = 10): Action[] => [
  { type: "strip", end, amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
  { type: "insert", end, orientation: "contacts-up", pushMm },
];

function modelAfter(actions: Action[], scenario: Scenario = OPEN_SCENARIO): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

const FULL = (end: EndId): Action => ({ type: "crimp", end, squeeze: "full" });

const pluggedA = () => modelAfter(plugOn("A"));
const bothPlugged = () => modelAfter([...plugOn("A"), ...plugOn("B")]);

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

/** The bench drawing on its own over a given cable, with every action it can send spied on. */
function benchViewAt(cable: CableState, { selectedEnd = "A", scenario = OPEN_SCENARIO }: { selectedEnd?: EndId; scenario?: Scenario } = {}) {
  const spies = {
    onCrimp: vi.fn(),
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

  render(<BenchView cable={cable} scenario={scenario} selectedEnd={selectedEnd} markers={{ A: null, B: null }} {...spies} />);

  return { ...watch(screen.getByRole("img", { name: /Workbench/ })), ...spies };
}

/** The whole bench page, with the drawing given a size and a pointer capture to watch. */
function benchAt(setup: BenchSetup = OPEN_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

const ON_SHELF = { clientX: CRIMPER_SHELF_X, clientY: SHELF_TOP + 28 };

/** A point over an end, a little out past its jacket edge — over its plug, when it has one. */
const overEnd = (end: EndId, dy = 0) => ({ clientX: LAYOUT[end].x0 + LAYOUT[end].dir * 20, clientY: CY + dy });
const OVER_NOTHING = { clientX: WIDTH / 2, clientY: CY };

const crimper = () => screen.queryByTestId("crimper");
const endGroup = (end: EndId) => screen.getByTestId(`end-${end}`);
const feedback = () => screen.getByTestId("feedback");

/**
 * Take the crimper off the shelf to crimp. On the whole page that is Crimp in
 * the toolbar first; the bench drawing on its own takes it to crimp unless told
 * otherwise.
 */
function takeCrimper(init: { pointerId: number; clientX: number; clientY: number }) {
  const button = screen.queryByRole("button", { name: /^Crimp( \(suggested\))?$/, hidden: true });
  if (button !== null && button.getAttribute("aria-pressed") !== "true") fireEvent.click(button);
  fireEvent.pointerDown(screen.getByTestId("take-crimper"), init);
}

/** Take the crimper off the shelf and carry it somewhere, optionally putting it down there. */
function placeCrimper(
  svg: Element,
  to: { clientX: number; clientY: number },
  { release = true, steps = 2, pointerId = 1, via = [] as { clientX: number; clientY: number }[] } = {},
) {
  takeCrimper({ pointerId, ...ON_SHELF });

  const path = [...via, to];
  let from = ON_SHELF;

  for (const point of path) {
    for (let step = 1; step <= steps; step++) {
      fireEvent.pointerMove(svg, {
        pointerId,
        clientX: from.clientX + ((point.clientX - from.clientX) * step) / steps,
        clientY: from.clientY + ((point.clientY - from.clientY) * step) / steps,
      });
    }
    from = point;
  }

  if (release) fireEvent.pointerUp(svg, { pointerId, ...to });
}

/**
 * Squeeze the crimper where it stands — the way a browser sends it: a press on
 * the tool, then the release and the click that follows it, delivered to the
 * drawing that holds the pointer captured unless told otherwise.
 */
function squeeze(
  svg: Element,
  { at = { clientX: 0, clientY: 0 }, upOn = null as Element | null, pointerId = 1 } = {},
) {
  fireEvent.pointerDown(crimper()!, { pointerId, ...at });
  fireEvent.pointerUp(upOn ?? svg, { pointerId, ...at });
  fireEvent.click(svg);
}

const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });
const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const selectEnd = (end: EndId) => fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/** Fit a plug to an end through the precise controls, the way `plugOn()` says. */
function plugThroughControls(end: EndId, pushMm = 10) {
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

describe("taking the crimper off the shelf", () => {
  it("picks it up and carries it, taking the pointer's capture, and sends nothing", () => {
    const cable = pluggedA();
    const { svg, capture, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"), { release: false });

    expect(capture.set).toHaveBeenCalledWith(1);
    expect(crimper()!.getAttribute("data-held")).toBe("true");
    expect(crimper()!.getAttribute("data-end")).toBe("A");
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("true");
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("stands it where it is let go over an end, without crimping", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.click(svg);

    expect(crimper()!.getAttribute("data-held")).toBe("false");
    expect(crimper()!.getAttribute("data-end")).toBe("A");
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("goes back on the shelf when let go over nothing, or pressed and let go where it lies", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, OVER_NOTHING);

    expect(crimper()).toBeNull();

    takeCrimper({ pointerId: 1, ...ON_SHELF });
    fireEvent.pointerUp(svg, { pointerId: 1, ...ON_SHELF });
    fireEvent.click(svg);

    expect(crimper()).toBeNull();
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("does nothing on a click alone, on the shelf or on the drawing", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    fireEvent.click(screen.getByTestId("take-crimper"));
    fireEvent.click(svg);

    expect(crimper()).toBeNull();
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("disturbs nothing else: no end chosen, no other gesture started, the plug's grip left alone", () => {
    const cable = pluggedA();
    const { svg, onSelectEnd, onPush, onWithdraw, onArrange } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerMove(svg, { pointerId: 1, ...overEnd("A", 2) });

    expect(screen.queryByTestId("fitted-plug-in-hand")).toBeNull();
    expect(screen.queryByTestId("conductor-in-hand")).toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A", 2) });

    expect(onSelectEnd).not.toHaveBeenCalled();
    expect(onPush).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
    expect(onArrange).not.toHaveBeenCalled();
  });

  it("does not crimp on a bench that has no way to send a crimp, though it is still on the shelf", () => {
    render(
      <BenchView
        cable={pluggedA()}
        scenario={OPEN_SCENARIO}
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

    // It is the bench's one hand tool, so it is still there to cut and strip
    // with; there is simply nothing for it to crimp.
    expect(screen.getByTestId("crimper-tool").getAttribute("data-operation")).toBe("");
    fireEvent.pointerDown(screen.getByTestId("take-crimper"), { pointerId: 1, ...ON_SHELF });
    expect(crimper()).toBeNull();
  });
});

describe("the squeeze is the crimp", () => {
  it("sends one full crimp of the end it stands on, in the model's own action shape", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
    expect(onCrimp).toHaveBeenCalledWith("A", "full");

    // The same arguments make an action the model takes as a full crimp.
    const [end, squeezed] = onCrimp.mock.calls[0];
    const result = apply(cable, { type: "crimp", end, squeeze: squeezed }, OPEN_SCENARIO);
    if ("rejected" in result) throw new Error(`model refused the crimp: ${result.rejected}`);
    expect(result.state.ends.A.plug!.crimp).toBe("full");
  });

  it("shows, while it stands there, what the model says squeezing it would do — the crimp it then sends", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);
    const result = apply(cable, FULL("A"), OPEN_SCENARIO);
    if ("rejected" in result) throw new Error("model refused the crimp");

    placeCrimper(svg, overEnd("A"));

    expect(crimper()!.getAttribute("data-refused")).toBe("false");
    expect(crimper()!.getAttribute("data-crimp")).toBe(result.state.ends.A.plug!.crimp);
    const shownEnd = crimper()!.getAttribute("data-end");

    squeeze(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
    expect(onCrimp).toHaveBeenCalledWith(shownEnd, "full");
  });

  it("goes back on the shelf once it has crimped, and a second press there crimps nothing", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(crimper()).toBeNull();
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("false");

    fireEvent.pointerDown(svg, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });
    fireEvent.click(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("has let go of the crimper before the crimp is sent: a release during the send is not a second squeeze", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    onCrimp.mockImplementation(() => {
      fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });
    });

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("is not the release, or the click, that ends the carry that stood it there", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.click(svg);
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });

    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("does not crimp on a click on the standing crimper: the click never reaches it in a browser", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.click(crimper()!);
    fireEvent.click(svg);

    expect(onCrimp).not.toHaveBeenCalled();
    expect(crimper()!.getAttribute("data-held")).toBe("false");
  });

  it("still crimps when the hand wobbles by less than a drag", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: overEnd("A").clientX + 2, clientY: CY + 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: overEnd("A").clientX + 2, clientY: CY + 1 });

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("moves it instead of crimping when the hand travels before lifting", () => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerMove(svg, { pointerId: 1, ...overEnd("B") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("B") });

    expect(onCrimp).not.toHaveBeenCalled();
    expect(crimper()!.getAttribute("data-held")).toBe("false");
    expect(crimper()!.getAttribute("data-end")).toBe("B");
  });

  it("can be used again: crimps one end, then is taken again and crimps the other", () => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);
    placeCrimper(svg, overEnd("B"));
    squeeze(svg);

    expect(onCrimp.mock.calls).toEqual([
      ["A", "full"],
      ["B", "full"],
    ]);
  });
});

describe("which end is crimped", () => {
  const cases: [EndId, EndId][] = [
    ["A", "A"],
    ["B", "A"],
    ["B", "B"],
    ["A", "B"],
  ];

  it.each(cases)("is end %s when the crimper stands on it, with end %s selected", (end, selected) => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable, { selectedEnd: selected });

    placeCrimper(svg, overEnd(end));
    squeeze(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
    expect(onCrimp).toHaveBeenCalledWith(end, "full");
  });

  it("is the end it was left on, whichever end it was carried across on the way", () => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"), { via: [overEnd("B")], release: false });

    expect(crimper()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });
    squeeze(svg, { at: overEnd("B") });

    expect(onCrimp).toHaveBeenCalledWith("A", "full");
  });

  it("crimps the end it stands on wherever on the crimper the hand comes down", () => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("B"));
    squeeze(svg, { at: { clientX: 5, clientY: 5 } });

    expect(onCrimp).toHaveBeenCalledWith("B", "full");
  });

  it("faces away from the cable on either end: as drawn at End A, turned round at End B", () => {
    const cable = bothPlugged();
    const { svg } = benchViewAt(cable);
    const drawn = () => crimper()!.querySelector(":scope > g")!.getAttribute("transform");

    placeCrimper(svg, overEnd("A"));
    expect(drawn()).not.toContain("scale(-1 1)");

    placeCrimper(svg, overEnd("B"));
    expect(crimper()!.getAttribute("data-end")).toBe("B");
    expect(drawn()).toContain("scale(-1 1)");

    // Carried over neither end, it is drawn as it lies on the shelf.
    placeCrimper(svg, OVER_NOTHING, { release: false });
    expect(drawn()).not.toContain("scale(-1 1)");
  });
});

describe("the crimper belongs to the pointer that took hold of it", () => {
  it("is carried, stood and squeezed by the pointer that took it, whatever its id", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"), { pointerId: 7 });
    squeeze(svg, { pointerId: 7 });

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("cannot be taken over, moved or put down by a second pointer while one hand carries it", () => {
    const cable = bothPlugged();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"), { release: false });
    takeCrimper({ pointerId: 2, ...ON_SHELF });
    fireEvent.pointerMove(svg, { pointerId: 2, ...overEnd("B") });

    expect(crimper()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 2, ...overEnd("B") });
    fireEvent.pointerCancel(svg, { pointerId: 2 });

    expect(crimper()!.getAttribute("data-held")).toBe("true");
    expect(crimper()!.getAttribute("data-end")).toBe("A");
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("cannot be squeezed by a second hand while another is on it", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerDown(crimper()!, { pointerId: 2, ...overEnd("A") });
    fireEvent.pointerUp(svg, { pointerId: 2, ...overEnd("A") });

    expect(onCrimp).not.toHaveBeenCalled();
    expect(crimper()!.getAttribute("data-held")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("is neither finished nor cancelled by a pointer that never pressed it", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerUp(svg, { pointerId: 9, ...overEnd("A") });
    fireEvent.pointerCancel(svg, { pointerId: 9 });

    expect(onCrimp).not.toHaveBeenCalled();
    expect(crimper()!.getAttribute("data-held")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });

    expect(onCrimp).toHaveBeenCalledTimes(1);
  });

  it("crimps nothing when its own pointer is cancelled halfway through a squeeze, and goes back on the shelf", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });
    fireEvent.click(svg);

    expect(onCrimp).not.toHaveBeenCalled();
    expect(crimper()).toBeNull();
  });

  it("crimps nothing when Escape is pressed halfway through a squeeze, or while it stands there", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overEnd("A") });

    expect(crimper()).toBeNull();

    placeCrimper(svg, overEnd("A"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(crimper()).toBeNull();
    expect(onCrimp).not.toHaveBeenCalled();
  });

  it("can be taken and squeezed by a different pointer once the first has let go", () => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    placeCrimper(svg, overEnd("A"), { pointerId: 4 });
    squeeze(svg, { pointerId: 4 });

    expect(onCrimp).toHaveBeenCalledTimes(1);
    expect(onCrimp).toHaveBeenCalledWith("A", "full");
  });
});

describe("the squeeze finishes once, wherever its release is delivered", () => {
  const targets: [string, () => Element][] = [
    ["the drawing", () => screen.getByRole("img", { name: /Workbench/ })],
    ["the crimper itself", () => crimper()!],
    ["another part of the drawing", () => screen.getByTestId("bench-length")],
    ["the other end", () => endGroup("B")],
    ["another tool", () => screen.getByTestId("take-plug")],
  ];

  it.each(targets)("released on %s", (_name, target) => {
    const cable = pluggedA();
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));
    fireEvent.pointerDown(crimper()!, { pointerId: 1, ...overEnd("A") });
    fireEvent.pointerUp(target(), { pointerId: 1, ...overEnd("A") });
    fireEvent.click(svg);

    expect(onCrimp).toHaveBeenCalledTimes(1);
    expect(onCrimp).toHaveBeenCalledWith("A", "full");
  });
});

describe("the model's refusals, surfaced as the model's own", () => {
  it("still sends the crimp over an end the model will refuse: the gesture does not decide", () => {
    const cable = createInitialState(OPEN_SCENARIO);
    const { svg, onCrimp } = benchViewAt(cable);

    placeCrimper(svg, overEnd("A"));

    expect(crimper()!.getAttribute("data-refused")).toBe("true");
    expect(crimper()!.getAttribute("data-crimp")).toBe("");

    squeeze(svg);

    expect(onCrimp).toHaveBeenCalledWith("A", "full");
  });

  it("an end with no plug on it", () => {
    const { svg } = benchAt();
    const cable = createInitialState(OPEN_SCENARIO);
    const answer = apply(cable, FULL("A"), OPEN_SCENARIO);
    if (!("rejected" in answer)) throw new Error("model crimped a raw end");

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(FULL("A"), answer.rejected, cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
  });

  it("an end with no plug on it, asked through the precise controls: the model's own refusal", () => {
    benchAt();
    const cable = createInitialState(OPEN_SCENARIO);
    const answer = apply(cable, FULL("A"), OPEN_SCENARIO);
    if (!("rejected" in answer)) throw new Error("model crimped a raw end");

    fireEvent.click(toolButton("Crimp"));
    fireEvent.click(screen.getByRole("button", { name: "Squeeze fully", hidden: true }));

    expect(feedback()).toHaveTextContent(rejectionMessage(FULL("A"), answer.rejected, cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
  });

  it("a plug that is already fully crimped", () => {
    const { svg } = benchAt(PRACTICE_BENCH);
    const cable = createInitialState(S1_PRACTICE);
    const answer = apply(cable, FULL("B"), S1_PRACTICE);
    if (!("rejected" in answer)) throw new Error("model crimped a crimped plug again");

    placeCrimper(svg, overEnd("B"));

    expect(crimper()!.getAttribute("data-refused")).toBe("true");

    squeeze(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(FULL("B"), answer.rejected, cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(endGroup("B")).toHaveAttribute("data-crimp", "full");
  });

  it("a plug that is plugged into a port", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    fireEvent.click(toolButton("Connect"));
    press(/^Plug end A into Tester MAIN/);
    const cable = modelAfter([...plugOn("A"), { type: "connect", end: "A", endpoint: "tester-main" }]);
    const answer = apply(cable, FULL("A"), OPEN_SCENARIO);
    if (!("rejected" in answer)) throw new Error("model crimped a connected plug");

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(FULL("A"), answer.rejected, cable));
    expect(endGroup("A")).toHaveAttribute("data-crimp", "none");
  });
});

describe("on the whole bench", () => {
  it("full-crimps a fitted plug, locks it as the model does, and selects its end", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    selectEnd("B");

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");
    expect(feedback()).toHaveTextContent("Crimped end A fully.");
    expect(feedback().getAttribute("data-tone")).toBe("done");
    expect(screen.getByRole("button", { name: "End A", hidden: true })).toHaveAttribute("aria-pressed", "true");
    // The plug is the model's: crimped, it can no longer be pulled off.
    fireEvent.click(toolButton("Withdraw"));
    press(/^Pull plug off end A$/);
    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
  });

  it("is used again on the other end", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    plugThroughControls("B");

    placeCrimper(svg, overEnd("A"));
    squeeze(svg);
    placeCrimper(svg, overEnd("B"));
    squeeze(svg);

    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");
    expect(endGroup("B")).toHaveAttribute("data-crimp", "full");
    expect(screen.getByTestId("tray-count")).toHaveTextContent("2 left · 2 used");
  });

  it("leaves the precise Half squeeze and Squeeze fully controls working, and finishes a half crimp", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    plugThroughControls("B");

    selectEnd("A");
    fireEvent.click(toolButton("Crimp"));
    press(/^Half squeeze$/);

    expect(endGroup("A")).toHaveAttribute("data-crimp", "partial");

    // The crimper on the bench always closes fully: it finishes the half crimp.
    placeCrimper(svg, overEnd("A"));
    squeeze(svg);

    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");

    selectEnd("B");
    press(/^Squeeze fully$/);

    expect(endGroup("B")).toHaveAttribute("data-crimp", "full");
  });

  it("leaves PUSH and WITHDRAW on the fitted plug working, and the crimped plug the model will not move", () => {
    const { svg } = benchAt();
    plugThroughControls("A", -5);
    const slidePlug = (cable: CableState, inwardMm: number) => {
      const scale = benchScale(cable).scale;
      const grip = plugGrip("A", cable.ends.A, scale)!;
      const from = { clientX: grip.x + grip.width / 2, clientY: grip.bands[0].y + grip.bands[0].height / 2 };
      const to = { clientX: from.clientX - LAYOUT.A.dir * inwardMm * scale, clientY: from.clientY };

      fireEvent.pointerDown(svg, { pointerId: 1, ...from });
      fireEvent.pointerMove(svg, { pointerId: 1, ...to });
      fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    };
    const atMinus5 = modelAfter(plugOn("A", -5));

    slidePlug(atMinus5, 8);
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "3");

    const at3 = modelAfter([...plugOn("A", -5), { type: "push", end: "A", pushMm: 3 }]);
    slidePlug(at3, -6);
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");

    plugThroughControls("A", -5);
    placeCrimper(svg, overEnd("A"));
    squeeze(svg);
    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");

    const crimped = modelAfter([...plugOn("A", -5), FULL("A")]);
    slidePlug(crimped, 8);

    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "push", end: "A", pushMm: 3 }, "plug-locked", crimped));
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "-5");
  });
});
