// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId, EndpointId, Scenario } from "../../model";
import type { PhysicalEndpoint } from "../../integration/publicConfig";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { HEIGHT, WIDTH } from "../benchGeometry";
import { BenchView } from "../components/BenchView";
import { rejectionMessage } from "../messages";
import { UNPLUG_PULL, portSlots, seatedPlugBox } from "../portGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * Unplugging a cable: taking hold of a plug that sits in a port and pulling it
 * out.
 *
 * The seated plug's arithmetic is checked in portGeometry.test.ts; this drives
 * the whole chain with pointer events the way a browser sends them, the drawing
 * holding the pointer captured. Nothing below unplugs a cable with a click.
 *
 * Where a result is asserted it comes from apply() itself. No test knows when a
 * plug may come out of a port; the model is asked.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

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

const OPEN_BENCH: BenchSetup = {
  ...PRACTICE_BENCH,
  scenario: { ...PRACTICE_BENCH.scenario, initialEnds: { A: raw(), B: raw() } },
};
const OPEN_SCENARIO: Scenario = { ...S1_PRACTICE, ...OPEN_BENCH.scenario };

const S5_ENDPOINTS: PhysicalEndpoint[] = [
  { id: "tester-main", kind: "tester-main" },
  { id: "tester-remote", kind: "tester-remote" },
  { id: "pc-1:eth0", kind: "mdi", label: "PC-1" },
  { id: "pc-2:eth0", kind: "mdi", label: "PC-2" },
];
const S5_SCENARIO: Scenario = { ...OPEN_SCENARIO, endpoints: S5_ENDPOINTS };

const plugOn = (end: EndId, pushMm = 10): Action[] => [
  { type: "strip", end, amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })),
  { type: "trim", end, leaveMm: 12 },
  { type: "insert", end, orientation: "contacts-up", pushMm },
];

const CONNECT = (end: EndId, endpoint: EndpointId): Action => ({ type: "connect", end, endpoint });

function modelAfter(actions: Action[], scenario: Scenario = OPEN_SCENARIO): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

/** End A in MAIN, end B in REMOTE. */
const bothIn = () =>
  modelAfter([...plugOn("A"), ...plugOn("B"), CONNECT("A", "tester-main"), CONNECT("B", "tester-remote")]);
const aIn = () => modelAfter([...plugOn("A"), CONNECT("A", "tester-main")]);

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

function benchViewAt(
  cable: CableState,
  { selectedEnd = "A", scenario = OPEN_SCENARIO, unplugging = true }: { selectedEnd?: EndId; scenario?: Scenario; unplugging?: boolean } = {},
) {
  const spies = {
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onPush: vi.fn(),
    onWithdraw: vi.fn(),
    onCrimp: vi.fn(),
    onInsert: vi.fn(),
    onStrip: vi.fn(),
    onUntwist: vi.fn(),
    onArrange: vi.fn(),
    onTrim: vi.fn(),
    onCut: vi.fn(),
    onSelectEnd: vi.fn(),
  };
  const view = (next: CableState) => (
    <BenchView
      cable={next}
      scenario={scenario}
      selectedEnd={selectedEnd}
      markers={{ A: null, B: null }}
      {...spies}
      onDisconnect={unplugging ? spies.onDisconnect : undefined}
    />
  );
  const { rerender } = render(view(cable));

  return {
    ...watch(screen.getByRole("img", { name: /Workbench/ })),
    ...spies,
    rerender: (next: CableState) => rerender(view(next)),
  };
}

function benchAt(setup: BenchSetup = OPEN_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

type Point = { clientX: number; clientY: number };

/** The middle of the plug seated in a port, from the bench's own geometry. */
function seatedAt(endpoints: readonly { id: EndpointId }[], endpoint: EndpointId): Point {
  const slot = portSlots(endpoints).find((candidate) => candidate.endpoint === endpoint);
  if (slot === undefined) throw new Error(`there is no port ${endpoint}`);

  const box = seatedPlugBox(slot);

  return { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
}

const down = (point: Point, dy: number, dx = 0): Point => ({ clientX: point.clientX + dx, clientY: point.clientY + dy });

/** Take hold of a seated plug and move the hand to a point, optionally letting go there. */
function pull(svg: Element, from: Point, to: Point, { release = true, steps = 3, pointerId = 1 } = {}) {
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

const inHand = () => screen.queryByTestId("connected-plug-in-hand");
const port = (endpoint: EndpointId) => screen.getByTestId(`port-${endpoint}`);
const feedback = () => screen.getByTestId("feedback");
const MAIN = seatedAt(OPEN_SCENARIO.endpoints, "tester-main");
const REMOTE = seatedAt(OPEN_SCENARIO.endpoints, "tester-remote");
const PAST = UNPLUG_PULL + 6;

const toolButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}( \\(suggested\\))?$`), hidden: true });
const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const selectEnd = (end: EndId) => fireEvent.click(screen.getByRole("button", { name: `End ${end}`, hidden: true }));

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

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

describe("pulling a plug out of its port", () => {
  it("takes hold of the plug sitting in the port, and the pointer's capture, and sends nothing while pulling", () => {
    const cable = aIn();
    const { svg, capture, onDisconnect } = benchViewAt(cable);

    fireEvent.pointerDown(svg, { pointerId: 1, ...MAIN });

    expect(capture.set).toHaveBeenCalledWith(1);
    // Nothing is drawn moving until the hand has actually travelled.
    expect(inHand()).toBeNull();

    fireEvent.pointerMove(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(inHand()!.getAttribute("data-end")).toBe("A");
    expect(inHand()!.getAttribute("data-endpoint")).toBe("tester-main");
    expect(inHand()!.getAttribute("data-pulled")).toBe("true");
    expect(inHand()!.getAttribute("data-refused")).toBe("false");
    expect(screen.getByTestId("seated-plug-A").getAttribute("opacity")).toBe("0.35");
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("unplugs once it has been pulled far enough, with exactly one disconnect in the model's shape", () => {
    const cable = aIn();
    const { svg, onDisconnect, capture } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith("A");
    expect(capture.release).toHaveBeenCalledWith(1);
    expect(inHand()).toBeNull();

    const result = apply(cable, { type: "disconnect", end: onDisconnect.mock.calls[0][0] }, OPEN_SCENARIO);
    if ("rejected" in result) throw new Error("model refused the disconnect");
    expect(result.state.connections).toEqual({});

    fireEvent.click(svg);
    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("has let go before the disconnect is sent: a release during the send is not a second pull", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    onDisconnect.mockImplementation(() => {
      fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });
    });

    pull(svg, MAIN, down(MAIN, PAST));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("leaves it in when it is let go short of the pull", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, UNPLUG_PULL - 6), { release: false });

    expect(inHand()!.getAttribute("data-pulled")).toBe("false");

    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, UNPLUG_PULL - 6) });

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("does not unplug when pushed up into the port, slid sideways, pressed without travel, or clicked", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, -PAST));
    pull(svg, MAIN, down(MAIN, 0, 40));
    fireEvent.pointerDown(svg, { pointerId: 1, ...MAIN });
    fireEvent.pointerUp(svg, { pointerId: 1, ...MAIN });
    fireEvent.click(screen.getByTestId("seated-plug-A"));
    fireEvent.click(svg);

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("finds no plug to take in a port nothing is in", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, REMOTE, down(REMOTE, PAST));

    expect(inHand()).toBeNull();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("takes no hold on a bench with no way to unplug", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable, { unplugging: false });

    pull(svg, MAIN, down(MAIN, PAST));

    expect(inHand()).toBeNull();
    expect(onDisconnect).not.toHaveBeenCalled();
  });
});

describe("which plug is pulled out", () => {
  const cases: [EndpointId, EndId, EndId][] = [
    ["tester-main", "A", "A"],
    ["tester-main", "A", "B"],
    ["tester-remote", "B", "A"],
    ["tester-remote", "B", "B"],
  ];

  it.each(cases)("the plug in %s is end %s's, with end %s selected", (endpoint, end, selected) => {
    const cable = bothIn();
    const { svg, onDisconnect } = benchViewAt(cable, { selectedEnd: selected });
    const at = seatedAt(OPEN_SCENARIO.endpoints, endpoint);

    pull(svg, at, down(at, PAST));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith(end);
  });

  it("keeps the plug it took hold of when the hand is carried over the other port", () => {
    const cable = bothIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(REMOTE, PAST), { release: false });

    expect(inHand()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, ...down(REMOTE, PAST) });

    expect(onDisconnect).toHaveBeenCalledWith("A");
  });

  it("S5: finds end B's plug in PC-2 among four ports", () => {
    const cable = modelAfter([...plugOn("A"), ...plugOn("B"), CONNECT("A", "pc-1:eth0"), CONNECT("B", "pc-2:eth0")], S5_SCENARIO);
    const { svg, onDisconnect } = benchViewAt(cable, { scenario: S5_SCENARIO });
    const at = seatedAt(S5_ENDPOINTS, "pc-2:eth0");

    pull(svg, at, down(at, PAST));

    expect(onDisconnect).toHaveBeenCalledWith("B");
  });
});

describe("a plug being pulled belongs to the pointer that took hold of it", () => {
  it("is pulled out by the pointer that took hold, whatever its id", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { pointerId: 7 });

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("cannot be taken over by a second pointer closing on the other plug", () => {
    const cable = bothIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    fireEvent.pointerDown(svg, { pointerId: 1, ...MAIN });
    pull(svg, REMOTE, down(REMOTE, PAST), { pointerId: 2 });
    fireEvent.pointerCancel(svg, { pointerId: 2 });

    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.pointerMove(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(inHand()!.getAttribute("data-end")).toBe("A");

    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith("A");
  });

  it("ignores another pointer's movement: only the owner pulls it out", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    fireEvent.pointerDown(svg, { pointerId: 1, ...MAIN });
    fireEvent.pointerMove(svg, { pointerId: 2, ...down(MAIN, PAST * 3) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...MAIN });

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("cannot be let go, or cancelled, by a pointer that never took hold", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    fireEvent.pointerUp(svg, { pointerId: 9, ...down(MAIN, PAST) });
    fireEvent.pointerCancel(svg, { pointerId: 9 });

    expect(onDisconnect).not.toHaveBeenCalled();
    expect(inHand()).not.toBeNull();

    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("is left in by its owner's cancel, and by Escape, and nothing is sent after", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });

    expect(inHand()).toBeNull();

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST) });
    fireEvent.click(svg);

    expect(inHand()).toBeNull();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("can be taken by a different pointer once the first has let go", () => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    pull(svg, MAIN, down(MAIN, PAST), { pointerId: 3 });

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith("A");
  });
});

describe("the pull finishes once, wherever its release is delivered", () => {
  const targets: [string, () => Element][] = [
    ["the drawing", () => screen.getByRole("img", { name: /Workbench/ })],
    ["the plug in the port", () => screen.getByTestId("seated-plug-A")],
    ["another port", () => port("tester-remote")],
    ["the other end", () => screen.getByTestId("end-B")],
    ["another tool", () => screen.getByTestId("take-plug")],
    ["the shelf", () => screen.getByTestId("tool-shelf")],
  ];

  it.each(targets)("released on %s", (_name, target) => {
    const cable = aIn();
    const { svg, onDisconnect } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    fireEvent.pointerUp(target(), { pointerId: 1, ...down(MAIN, PAST) });
    fireEvent.click(svg);

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith("A");
  });
});

describe("the model decides", () => {
  it("marks a pull the model would refuse, and still sends it: the gesture does not decide", () => {
    const cable = aIn();
    const { svg, onDisconnect, rerender } = benchViewAt(cable);

    pull(svg, MAIN, down(MAIN, PAST), { release: false });
    // The end comes out underneath the hand, as another action would leave it.
    const unplugged = modelAfter(plugOn("A"));
    rerender(unplugged);
    fireEvent.pointerMove(svg, { pointerId: 1, ...down(MAIN, PAST + 1) });

    expect("rejected" in apply(unplugged, { type: "disconnect", end: "A" }, OPEN_SCENARIO)).toBe(true);
    expect(inHand()!.getAttribute("data-refused")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...down(MAIN, PAST + 1) });

    expect(onDisconnect).toHaveBeenCalledWith("A");
  });

  it("on the whole bench: unplugs through the page, and the plug is the model's again to push, withdraw or crimp", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    fireEvent.click(toolButton("Connect"));
    press(/^Plug end A into Tester MAIN/);

    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("A");

    pull(svg, MAIN, down(MAIN, PAST));

    expect(feedback()).toHaveTextContent("Unplugged end A.");
    expect(feedback().getAttribute("data-tone")).toBe("done");
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("");
    expect(screen.queryByTestId("lead-A")).toBeNull();
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("—");

    // No longer in a port, the plug is one the model will pull off.
    fireEvent.click(toolButton("Withdraw"));
    press(/^Pull plug off end A$/);

    expect(screen.getByTestId("end-A")).toHaveAttribute("data-plug", "none");
  });

  it("on the whole bench: a precise Unplug of a plug put in physically still works, and the refusal after is the model's", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    fireEvent.click(toolButton("Connect"));
    press(/^Plug end A into Tester MAIN/);
    press(/^Unplug end A$/);

    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("");

    press(/^Unplug end A$/);

    const cable = modelAfter(plugOn("A"));
    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "disconnect", end: "A" }, "not-connected", cable));

    // Nothing is left in the port to take hold of.
    pull(svg, MAIN, down(MAIN, PAST));
    expect(inHand()).toBeNull();
  });
});
