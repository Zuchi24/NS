// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../../model";
import type { Action, CableState, EndId, EndpointId, Scenario } from "../../model";
import type { PhysicalEndpoint } from "../../integration/publicConfig";
import { PhysicalCableChallenge } from "../PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { conductorRegions } from "../conductorGeometry";
import { BenchView } from "../components/BenchView";
import { CRIMPER_SHELF_X } from "../components/CrimperTool";
import { rejectionMessage } from "../messages";
import { plugGrip } from "../plugGeometry";
import { PORT_REACH, leadHandle, portSlots } from "../portGeometry";
import { PRACTICE_BENCH } from "../setup";
import type { BenchSetup } from "../setup";

/**
 * Plugging a cable in: taking up a plug's lead, carrying it to a port, holding
 * it there, and pressing it in.
 *
 * The ports' arithmetic is checked in portGeometry.test.ts; this drives the
 * whole chain with pointer events the way a browser sends them — the press on
 * the lead, and the release and any click delivered to whatever the browser
 * picks, the drawing holding the pointer captured. Nothing below plugs a cable
 * in with a click.
 *
 * Where a result is asserted it comes from apply() itself, so these pin the UI
 * to the model rather than to rules restated here. No test knows which port a
 * plug belongs in, or when a port will take one.
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

/** S1's bench with both ends raw, so either end can take a plug. */
const OPEN_BENCH: BenchSetup = {
  ...PRACTICE_BENCH,
  scenario: { ...PRACTICE_BENCH.scenario, initialEnds: { A: raw(), B: raw() } },
};
const OPEN_SCENARIO: Scenario = { ...S1_PRACTICE, ...OPEN_BENCH.scenario };

/** S5's four ports, as its public config names them, on a bench with both ends raw. */
const S5_ENDPOINTS: PhysicalEndpoint[] = [
  { id: "tester-main", kind: "tester-main" },
  { id: "tester-remote", kind: "tester-remote" },
  { id: "pc-1:eth0", kind: "mdi", label: "PC-1" },
  { id: "pc-2:eth0", kind: "mdi", label: "PC-2" },
];
const S5_BENCH: BenchSetup = {
  ...OPEN_BENCH,
  scenario: { ...OPEN_BENCH.scenario, endpoints: S5_ENDPOINTS },
  objectives: { minLengthMm: null, inspection: [], link: ["pc-1:eth0", "pc-2:eth0"] },
  assist: null,
};
const S5_SCENARIO: Scenario = { ...S1_PRACTICE, ...S5_BENCH.scenario };

/** The work that puts a plug on an end: stripped, fanned flat, trimmed to 12 mm, pushed on. */
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

const pluggedA = () => modelAfter(plugOn("A"));
const bothPlugged = (scenario: Scenario = OPEN_SCENARIO) => modelAfter([...plugOn("A"), ...plugOn("B")], scenario);

function watch(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(RECT);

  const capture = { set: vi.fn(), release: vi.fn() };
  Object.assign(svg, { setPointerCapture: capture.set, releasePointerCapture: capture.release });

  return { svg, capture };
}

/** The bench drawing on its own over a given cable, with every action it can send spied on. */
function benchViewAt(
  cable: CableState,
  { selectedEnd = "A", scenario = OPEN_SCENARIO, ports = true }: { selectedEnd?: EndId; scenario?: Scenario; ports?: boolean } = {},
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

  render(
    <BenchView
      cable={cable}
      scenario={scenario}
      selectedEnd={selectedEnd}
      markers={{ A: null, B: null }}
      {...spies}
      onConnect={ports ? spies.onConnect : undefined}
      onDisconnect={ports ? spies.onDisconnect : undefined}
    />,
  );

  return { ...watch(screen.getByRole("img", { name: /Workbench/ })), ...spies };
}

/** The whole bench page, with the drawing given a size and a pointer capture to watch. */
function benchAt(setup: BenchSetup = OPEN_BENCH) {
  render(<PhysicalCableChallenge {...setup} />);

  return watch(screen.getByRole("img", { name: /Workbench/ }));
}

type Point = { clientX: number; clientY: number };

/** The middle of a plug's lead handle, from the bench's own geometry. */
function leadAt(cable: CableState, end: EndId): Point {
  const handle = leadHandle(end, cable.ends[end], benchScale(cable).scale);
  if (handle === null) throw new Error(`there is no plug on end ${end}`);

  return { clientX: handle.cx, clientY: handle.cy };
}

/** Just below a port's mouth, where a lead is held to offer it to that port. */
function portAt(endpoints: readonly { id: EndpointId }[], endpoint: EndpointId): Point {
  const slot = portSlots(endpoints).find((candidate) => candidate.endpoint === endpoint);
  if (slot === undefined) throw new Error(`there is no port ${endpoint}`);

  return { clientX: slot.mouthX, clientY: slot.mouthY + PORT_REACH / 2 };
}

const OFF_ANY_PORT: Point = { clientX: WIDTH / 2, clientY: CY + 60 };

/** Take up a lead, carry it to a point by way of others, and optionally let go there. */
function carryLead(
  svg: Element,
  from: Point,
  to: Point,
  { release = true, steps = 2, pointerId = 1, via = [] as Point[] } = {},
) {
  fireEvent.pointerDown(svg, { pointerId, ...from });

  let previous = from;
  for (const point of [...via, to]) {
    for (let step = 1; step <= steps; step++) {
      fireEvent.pointerMove(svg, {
        pointerId,
        clientX: previous.clientX + ((point.clientX - previous.clientX) * step) / steps,
        clientY: previous.clientY + ((point.clientY - previous.clientY) * step) / steps,
      });
    }
    previous = point;
  }

  if (release) fireEvent.pointerUp(svg, { pointerId, ...to });
}

const waiting = () => screen.queryByTestId("plug-at-port");

/**
 * Press the waiting lead in — the way a browser sends it: a press on the lead,
 * then the release and the click that follows it, delivered to the drawing that
 * holds the pointer captured unless told otherwise.
 */
function pressIn(svg: Element, { at = { clientX: 0, clientY: 0 } as Point, upOn = null as Element | null, pointerId = 1 } = {}) {
  fireEvent.pointerDown(waiting()!, { pointerId, ...at });
  fireEvent.pointerUp(upOn ?? svg, { pointerId, ...at });
  fireEvent.click(svg);
}

const port = (endpoint: EndpointId) => screen.getByTestId(`port-${endpoint}`);
const endGroup = (end: EndId) => screen.getByTestId(`end-${end}`);
const feedback = () => screen.getByTestId("feedback");

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

describe("taking up a plug's lead", () => {
  it("takes hold of the lead of the plug under the hand, and the pointer's capture, and sends nothing", () => {
    const cable = pluggedA();
    const { svg, capture, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), OFF_ANY_PORT, { release: false });

    expect(capture.set).toHaveBeenCalledWith(1);
    expect(waiting()!.getAttribute("data-held")).toBe("true");
    expect(waiting()!.getAttribute("data-end")).toBe("A");
    expect(waiting()!.getAttribute("data-endpoint")).toBe("");
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("offers it to the port it is carried to, and shows what the model says plugging in there would do", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const result = apply(cable, CONNECT("A", "tester-main"), OPEN_SCENARIO);
    if ("rejected" in result) throw new Error("model refused the connect");

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"), { release: false });

    expect(waiting()!.getAttribute("data-endpoint")).toBe("tester-main");
    expect(waiting()!.getAttribute("data-refused")).toBe("false");
    expect(waiting()!.getAttribute("data-connects")).toBe(result.state.connections.A);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("waits at the port it is let go at, without plugging in — and the click after is not a press", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-remote"));
    fireEvent.click(svg);

    expect(waiting()!.getAttribute("data-held")).toBe("false");
    expect(waiting()!.getAttribute("data-endpoint")).toBe("tester-remote");
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("goes back to its plug when let go over no port, or when the hand lifts without carrying it", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), OFF_ANY_PORT);

    expect(waiting()).toBeNull();

    fireEvent.pointerDown(svg, { pointerId: 1, ...leadAt(cable, "A") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...leadAt(cable, "A") });
    fireEvent.click(svg);

    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("claims nothing on an end without a plug, and draws no lead there", () => {
    const withPlug = pluggedA();
    const cable = modelAfter(plugOn("A").slice(0, -1));
    const { svg, onConnect } = benchViewAt(cable);

    expect(screen.queryByTestId("plug-lead-A")).toBeNull();

    carryLead(svg, leadAt(withPlug, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));

    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("leaves the plug's grip and the conductors inside it to their own gestures", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const scale = benchScale(cable).scale;
    const grip = plugGrip("A", cable.ends.A, scale)!;
    const lane = conductorRegions("A", cable.ends.A, scale)[0];

    carryLead(svg, { clientX: grip.x + grip.width / 2, clientY: grip.bands[0].y + 2 }, portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    expect(waiting()).toBeNull();

    carryLead(svg, { clientX: lane.x + lane.width / 2, clientY: lane.y + lane.height / 2 }, portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("offers a lead on a crimped plug just the same: whether it goes in is the model's answer", () => {
    benchViewAt(createInitialState(S1_PRACTICE), { scenario: S1_PRACTICE });

    expect(screen.getByTestId("plug-lead-B")).toBeInTheDocument();
    expect(screen.queryByTestId("plug-lead-A")).toBeNull();
  });

  it("offers no ports and no leads on a bench with no way to plug a cable in", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable, { ports: false });

    expect(screen.queryByTestId("ports")).toBeNull();
    expect(screen.queryByTestId("plug-lead-A")).toBeNull();

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));

    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("pressing the waiting lead in", () => {
  it("sends one connect — the end whose lead it is, and the port it waits at — in the model's own action shape", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith("A", "tester-main");
    expect(waiting()).toBeNull();

    const [end, endpoint] = onConnect.mock.calls[0];
    const result = apply(cable, { type: "connect", end, endpoint }, OPEN_SCENARIO);
    if ("rejected" in result) throw new Error(`model refused the connect: ${result.rejected}`);
    expect(result.state.connections).toEqual({ A: "tester-main" });

    // What a browser may send next, and a second press and release there, plug nothing more in.
    fireEvent.click(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, ...portAt(OPEN_SCENARIO.endpoints, "tester-main") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...portAt(OPEN_SCENARIO.endpoints, "tester-main") });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("has let go of the lead before the connect is sent: a release during the send is not a second press", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    onConnect.mockImplementation(() => {
      fireEvent.pointerUp(svg, { pointerId: 1, clientX: 0, clientY: 0 });
    });

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("does not plug in on a click on the waiting lead: the click never reaches it in a browser", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    fireEvent.click(waiting()!);
    fireEvent.click(svg);

    expect(onConnect).not.toHaveBeenCalled();
    expect(waiting()!.getAttribute("data-held")).toBe("false");
  });

  it("still plugs in when the hand wobbles by less than a drag", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: at.clientX + 2, clientY: at.clientY + 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: at.clientX + 2, clientY: at.clientY + 1 });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith("A", "tester-main");
  });

  it("carries it on to another port instead when the hand travels before lifting", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable, { scenario: S5_SCENARIO });

    carryLead(svg, leadAt(cable, "A"), portAt(S5_ENDPOINTS, "tester-main"));
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...portAt(S5_ENDPOINTS, "tester-main") });
    fireEvent.pointerMove(svg, { pointerId: 1, ...portAt(S5_ENDPOINTS, "pc-1:eth0") });
    fireEvent.pointerUp(svg, { pointerId: 1, ...portAt(S5_ENDPOINTS, "pc-1:eth0") });

    expect(onConnect).not.toHaveBeenCalled();
    expect(waiting()!.getAttribute("data-endpoint")).toBe("pc-1:eth0");

    pressIn(svg);

    expect(onConnect).toHaveBeenCalledWith("A", "pc-1:eth0");
  });

  it("plugs into the port it waits at, whatever ports it was carried across and wherever the press lands", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable, { scenario: S5_SCENARIO });

    carryLead(svg, leadAt(cable, "A"), portAt(S5_ENDPOINTS, "pc-2:eth0"), {
      via: [portAt(S5_ENDPOINTS, "tester-main"), portAt(S5_ENDPOINTS, "pc-1:eth0")],
    });

    expect(waiting()!.getAttribute("data-endpoint")).toBe("pc-2:eth0");

    pressIn(svg, { at: portAt(S5_ENDPOINTS, "tester-remote") });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith("A", "pc-2:eth0");
  });

  it("can be taken up again once it has plugged in, for the other end and another port", () => {
    const cable = bothPlugged();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);
    carryLead(svg, leadAt(cable, "B"), portAt(OPEN_SCENARIO.endpoints, "tester-remote"));
    pressIn(svg);

    expect(onConnect.mock.calls).toEqual([
      ["A", "tester-main"],
      ["B", "tester-remote"],
    ]);
  });

  it("puts a waiting lead back when another lead is taken up", () => {
    const cable = bothPlugged();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    carryLead(svg, leadAt(cable, "B"), portAt(OPEN_SCENARIO.endpoints, "tester-remote"));

    expect(waiting()!.getAttribute("data-end")).toBe("B");
    expect(waiting()!.getAttribute("data-endpoint")).toBe("tester-remote");
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("which end, and which port", () => {
  const cases: [EndId, EndId][] = [
    ["A", "A"],
    ["B", "A"],
    ["A", "B"],
    ["B", "B"],
  ];

  it.each(cases)("plugs end %s's lead in, with end %s selected", (end, selected) => {
    const cable = bothPlugged();
    const { svg, onConnect } = benchViewAt(cable, { selectedEnd: selected });

    carryLead(svg, leadAt(cable, end), portAt(OPEN_SCENARIO.endpoints, "tester-remote"));
    pressIn(svg);

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(end, "tester-remote");
  });

  it("names each of S5's four ports by its endpoint id, never by its label", () => {
    const cable = bothPlugged(S5_SCENARIO);
    const { svg, onConnect } = benchViewAt(cable, { scenario: S5_SCENARIO });

    for (const endpoint of S5_ENDPOINTS) {
      carryLead(svg, leadAt(cable, "B"), portAt(S5_ENDPOINTS, endpoint.id));
      pressIn(svg);
    }

    expect(onConnect.mock.calls).toEqual(S5_ENDPOINTS.map((endpoint) => ["B", endpoint.id]));
  });

  it("draws a port for every endpoint, named as the scenario names it, and says nothing about which is wanted", () => {
    benchViewAt(bothPlugged(S5_SCENARIO), { scenario: S5_SCENARIO });

    // The name drawn on the port — its tooltip carries the same name, and nothing else.
    const drawnName = (endpoint: EndpointId, name: string) =>
      within(port(endpoint)).getByText(name, { selector: "text" });

    expect(drawnName("tester-main", "Tester MAIN")).toBeInTheDocument();
    expect(drawnName("tester-remote", "Tester REMOTE")).toBeInTheDocument();
    expect(drawnName("pc-1:eth0", "PC-1")).toBeInTheDocument();
    expect(drawnName("pc-2:eth0", "PC-2")).toBeInTheDocument();
    expect(port("pc-1:eth0").querySelector("title")!.textContent).toBe("PC-1");
    expect(screen.getByTestId("ports").textContent).not.toMatch(/correct|wrong|expected|right|should|link/i);
  });
});

describe("a lead belongs to the pointer that took it up", () => {
  it("is carried and pressed in by the pointer that took it, whatever its id", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"), { pointerId: 7 });
    pressIn(svg, { pointerId: 7 });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("cannot be taken over, moved, put down or cancelled by a second pointer while one hand carries it", () => {
    const cable = bothPlugged();
    const { svg, onConnect } = benchViewAt(cable);
    const main = portAt(OPEN_SCENARIO.endpoints, "tester-main");
    const remote = portAt(OPEN_SCENARIO.endpoints, "tester-remote");

    carryLead(svg, leadAt(cable, "A"), main, { release: false });
    fireEvent.pointerDown(svg, { pointerId: 2, ...leadAt(cable, "B") });
    fireEvent.pointerMove(svg, { pointerId: 2, ...remote });
    fireEvent.pointerUp(svg, { pointerId: 2, ...remote });
    fireEvent.pointerCancel(svg, { pointerId: 2 });

    expect(waiting()!.getAttribute("data-held")).toBe("true");
    expect(waiting()!.getAttribute("data-end")).toBe("A");
    expect(waiting()!.getAttribute("data-endpoint")).toBe("tester-main");

    fireEvent.pointerUp(svg, { pointerId: 1, ...main });

    expect(waiting()!.getAttribute("data-held")).toBe("false");
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("cannot be pressed in by a second hand while another is on it", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.pointerDown(waiting()!, { pointerId: 2, ...at });
    fireEvent.pointerUp(svg, { pointerId: 2, ...at });

    expect(onConnect).not.toHaveBeenCalled();
    expect(waiting()!.getAttribute("data-held")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("is neither finished nor cancelled by a pointer that never pressed it", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.pointerUp(svg, { pointerId: 9, ...at });
    fireEvent.pointerCancel(svg, { pointerId: 9 });

    expect(onConnect).not.toHaveBeenCalled();
    expect(waiting()!.getAttribute("data-held")).toBe("true");

    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("plugs nothing in when its own pointer is cancelled, carrying or pressing, and the lead goes back", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at, { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(waiting()).toBeNull();

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    fireEvent.click(svg);

    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("plugs nothing in when Escape is pressed while carrying, while waiting, or halfway through a press", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at, { release: false });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });
    expect(waiting()).toBeNull();

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(waiting()).toBeNull();

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at });

    expect(waiting()).toBeNull();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("can be taken up and pressed in by a different pointer once the first has let go", () => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at, { release: false });
    fireEvent.pointerCancel(svg, { pointerId: 1 });
    carryLead(svg, leadAt(cable, "A"), at, { pointerId: 4 });
    pressIn(svg, { pointerId: 4 });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith("A", "tester-main");
  });
});

describe("the press finishes once, wherever its release is delivered", () => {
  const targets: [string, () => Element][] = [
    ["the drawing", () => screen.getByRole("img", { name: /Workbench/ })],
    ["the waiting lead itself", () => waiting()!],
    ["another port", () => port("tester-remote")],
    ["the other end", () => endGroup("B")],
    ["another tool", () => screen.getByTestId("take-plug")],
    ["the shelf", () => screen.getByTestId("tool-shelf")],
  ];

  it.each(targets)("released on %s", (_name, target) => {
    const cable = pluggedA();
    const { svg, onConnect } = benchViewAt(cable);
    const at = portAt(OPEN_SCENARIO.endpoints, "tester-main");

    carryLead(svg, leadAt(cable, "A"), at);
    fireEvent.pointerDown(waiting()!, { pointerId: 1, ...at });
    fireEvent.pointerUp(target(), { pointerId: 1, ...at });
    fireEvent.click(svg);

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith("A", "tester-main");
  });
});

describe("the model's refusals, surfaced as the model's own", () => {
  it("still sends a connect the model will refuse: the gesture does not decide", () => {
    // End B is already in MAIN; end A's lead is offered to MAIN too.
    const cable = modelAfter([...plugOn("A"), ...plugOn("B"), CONNECT("B", "tester-main")]);
    const { svg, onConnect } = benchViewAt(cable);

    expect("rejected" in apply(cable, CONNECT("A", "tester-main"), OPEN_SCENARIO)).toBe(true);

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));

    expect(waiting()!.getAttribute("data-refused")).toBe("true");
    expect(waiting()!.getAttribute("data-connects")).toBe("");

    pressIn(svg);

    expect(onConnect).toHaveBeenCalledWith("A", "tester-main");
  });

  it("a port the other end is already in", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    plugThroughControls("B");
    fireEvent.click(toolButton("Connect"));
    press(/^Plug end B into Tester MAIN/);
    const cable = modelAfter([...plugOn("A"), ...plugOn("B"), CONNECT("B", "tester-main")]);
    const answer = apply(cable, CONNECT("A", "tester-main"), OPEN_SCENARIO);
    if (!("rejected" in answer)) throw new Error("model put two ends in one port");

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(CONNECT("A", "tester-main"), answer.rejected, cable));
    expect(feedback().getAttribute("data-tone")).toBe("refused");
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("B");
  });

  it("an end that is already plugged in", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    const cable = pluggedA();

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    const plugged = modelAfter([...plugOn("A"), CONNECT("A", "tester-main")]);
    const answer = apply(plugged, CONNECT("A", "tester-remote"), OPEN_SCENARIO);
    if (!("rejected" in answer)) throw new Error("model plugged one end into two ports");

    carryLead(svg, leadAt(plugged, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-remote"));
    pressIn(svg);

    expect(feedback()).toHaveTextContent(rejectionMessage(CONNECT("A", "tester-remote"), answer.rejected, plugged));
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("A");
    expect(port("tester-remote").getAttribute("data-occupied-by")).toBe("");
  });
});

describe("on the whole bench", () => {
  it("plugs a fitted plug into the tester, and draws it there from the model's own connections", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    selectEnd("B");
    const cable = pluggedA();

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    expect(feedback()).toHaveTextContent("Plugged end A into Tester MAIN.");
    expect(feedback().getAttribute("data-tone")).toBe("done");
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("End A");
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("A");
    expect(screen.getByTestId("seated-plug-A")).toBeInTheDocument();
    expect(screen.getByTestId("lead-A").getAttribute("data-endpoint")).toBe("tester-main");
    expect(screen.getByTestId("plug-lead-A").getAttribute("data-plugged-in")).toBe("true");
    expect(screen.getByRole("button", { name: "End A", hidden: true })).toHaveAttribute("aria-pressed", "true");
  });

  it("S5: plugs both ends into the two PCs, each by its own port, and the link is the model's to report", () => {
    const { svg } = benchAt(S5_BENCH);
    plugThroughControls("A");
    plugThroughControls("B");
    const cable = bothPlugged(S5_SCENARIO);

    carryLead(svg, leadAt(cable, "A"), portAt(S5_ENDPOINTS, "pc-1:eth0"));
    pressIn(svg);
    const once = modelAfter([...plugOn("A"), ...plugOn("B"), CONNECT("A", "pc-1:eth0")], S5_SCENARIO);
    carryLead(svg, leadAt(once, "B"), portAt(S5_ENDPOINTS, "pc-2:eth0"));
    pressIn(svg);

    expect(port("pc-1:eth0").getAttribute("data-occupied-by")).toBe("A");
    expect(port("pc-2:eth0").getAttribute("data-occupied-by")).toBe("B");
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("");
    expect(screen.getByTestId("link-state")).toHaveTextContent("PC-1 ↔ PC-2");
    expect(screen.getByTestId("ports").textContent).not.toMatch(/correct|wrong|expected|should/i);
  });

  it("leaves the precise Connect controls working, and the ports show what they did", () => {
    benchAt(PRACTICE_BENCH);
    selectEnd("B");
    fireEvent.click(toolButton("Connect"));

    press(/^Plug end B into Tester MAIN/);
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("B");

    press(/^Unplug end B$/);
    expect(port("tester-main").getAttribute("data-occupied-by")).toBe("");
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("—");
  });

  it("a plug the model has in a port is one it will not crimp, until it is unplugged", () => {
    const { svg } = benchAt();
    plugThroughControls("A");
    const cable = pluggedA();

    carryLead(svg, leadAt(cable, "A"), portAt(OPEN_SCENARIO.endpoints, "tester-main"));
    pressIn(svg);

    const overA = { clientX: LAYOUT.A.x0 + LAYOUT.A.dir * 20, clientY: CY };
    const crimpHere = () => {
      fireEvent.pointerDown(screen.getByTestId("take-crimper"), { pointerId: 1, clientX: CRIMPER_SHELF_X, clientY: SHELF_TOP + 28 });
      fireEvent.pointerMove(svg, { pointerId: 1, ...overA });
      fireEvent.pointerUp(svg, { pointerId: 1, ...overA });
      fireEvent.pointerDown(screen.getByTestId("crimper"), { pointerId: 1, ...overA });
      fireEvent.pointerUp(svg, { pointerId: 1, ...overA });
    };
    const plugged = modelAfter([...plugOn("A"), CONNECT("A", "tester-main")]);

    crimpHere();

    expect(feedback()).toHaveTextContent(rejectionMessage({ type: "crimp", end: "A", squeeze: "full" }, "plug-connected", plugged));
    expect(endGroup("A")).toHaveAttribute("data-crimp", "none");

    fireEvent.click(toolButton("Connect"));
    press(/^Unplug end A$/);
    crimpHere();

    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");
  });
});
