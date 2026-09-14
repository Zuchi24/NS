// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import {
  NATURAL_ORDER,
  PAIR_IDS,
  S1_PRACTICE,
  T568B,
  apply,
  createInitialState,
  inspect,
  toRecord,
  wiremap,
} from "../model";
import type { Action, CableState, EndInspection } from "../model";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import { CRIMPER_SHELF_X } from "./components/CrimperTool";
import { VERDICT_LABEL } from "./messages";
import { WITHDRAW_PULL_MM, plugGrip } from "./plugGeometry";
import { PORT_REACH, leadHandle, portSlots } from "./portGeometry";
import { PRACTICE_BENCH } from "./setup";

/**
 * The physical bench, driven the way a student drives it.
 *
 * Where a test checks a result, the expected value comes from the P1 model
 * itself — the same actions applied with apply() — so these tests pin the UI
 * to the model rather than to numbers restated here. The model is never mocked.
 */

afterEach(cleanup);

/*
 * These tests drive whole terminations click by click — thirty-odd renders of
 * the full bench each. Alone they take a second or two; under the full suite's
 * parallel load they can pass the 5 s default. The limit is raised for this
 * file only; no assertion is relaxed.
 */
vi.setConfig({ testTimeout: 20_000 });

/**
 * jsdom has no PointerEvent, and without the constructor testing-library falls
 * back to a plain Event — which drops clientX, clientY and pointerId, so a tap
 * on the bench would carry no position. A MouseEvent carries the coordinates
 * already; this only adds the pointer id. The same scaffolding as the gesture
 * tests: the bench itself uses the platform's own events.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(window, "PointerEvent", { writable: true, configurable: true, value: TestPointerEvent });

/* ------------------------------------------------------------
   Driving the bench
   ------------------------------------------------------------ */

const toolbar = () => screen.getByRole("toolbar", { name: "Tools", hidden: true });
const tool = (name: string) => fireEvent.click(within(toolbar()).getByRole("button", { name: new RegExp(`^${name}`), hidden: true }));
const selectEnd = (id: "A" | "B") =>
  fireEvent.click(within(screen.getByRole("group", { name: "Cable end", hidden: true })).getByRole("button", { name: `End ${id}`, hidden: true }));
const slide = (label: string, value: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
/**
 * `hidden: true` skips testing-library's visibility walk (a getComputedStyle per
 * ancestor, per query), which dominates these click-by-click flows in jsdom.
 * Every control here is visible, so what is matched is unchanged.
 */
const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const feedback = () => screen.getByTestId("feedback");
const endGroup = (id: "A" | "B") => screen.getByTestId(`end-${id}`);
const fanOf = (id: "A" | "B") => endGroup(id).getAttribute("data-fan");

function strip(mm: number) {
  tool("Strip");
  slide("Strip length", mm);
  press(/^Strip end A$/);
}

function untwistAll() {
  tool("Untwist");
  for (const pair of PAIR_IDS) press(new RegExp(`^Untwist ${pair}`));
}

/** Natural order → T568B: blue to position 4, then green to position 6. */
function arrangeT568B() {
  tool("Arrange");
  press(/^Position 5: Blue/);
  press(/^Position 4: Green/);
  press(/^Position 5: Green/);
  press(/^Position 6: White\/blue/);
}

function trim(mm: number) {
  tool("Trim");
  slide("Leave exposed", mm);
  press(/^Trim end A$/);
}

function insertPlug() {
  press(/^Pick up a plug$/);
  press(/^Insert end A$/);
}

function crimpFully() {
  tool("Crimp");
  press(/^Squeeze fully$/);
}

/** The same work, as model actions, for computing what the UI should show. */
const TERMINATE_A: Action[] = [
  { type: "strip", end: "A", amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  { type: "moveConductor", end: "A", conductor: "blue", toIndex: 3 },
  { type: "moveConductor", end: "A", conductor: "green", toIndex: 5 },
  { type: "trim", end: "A", leaveMm: 12 },
  { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
  { type: "crimp", end: "A", squeeze: "full" },
];

function modelAfter(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

function terminateAThroughUi() {
  strip(30);
  untwistAll();
  arrangeT568B();
  trim(12);
  insertPlug();
  crimpFully();
}

function inspectionShown(end: "A" | "B"): EndInspection {
  const read = (key: keyof EndInspection) =>
    within(screen.getByTestId(`inspect-${end}-${key}`)).getByLabelText(/pass|fail/).getAttribute("aria-label") === "pass";

  return {
    jacketClamped: read("jacketClamped"),
    untwistOk: read("untwistOk"),
    conductorsAtFront: read("conductorsAtFront"),
    insulationIntact: read("insulationIntact"),
  };
}

/* ============================================================ */

describe("the S1 bench", () => {
  it("1. renders S1's starting state", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terminate a straight-through cable");
    expect(screen.getByText("beginner")).toBeInTheDocument();
    expect(screen.getByText(/end A wired to T568B, end B wired to T568B/)).toBeInTheDocument();
    expect(screen.getByTestId("cable-length")).toHaveTextContent("988 mm");
    expect(screen.getByTestId("tray-count")).toHaveTextContent("4 left · 0 used");
    expect(screen.getByTestId("hint")).toHaveTextContent(/Strip the jacket off end A/);
  });

  it("2. draws end A as a raw, clean cut end", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(endGroup("A")).toHaveAttribute("data-jacket-edge-mm", "0");
    expect(endGroup("A")).toHaveAttribute("data-exposed-max-mm", "0");
    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(screen.getByTestId("measure-A-exposed")).toHaveTextContent("none");
    expect(screen.getByRole("img", { name: /End A: clean cut end/ })).toBeInTheDocument();
  });

  it("3. draws end B as a factory T568B termination", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(endGroup("B")).toHaveAttribute("data-plug", "contacts-up");
    expect(endGroup("B")).toHaveAttribute("data-crimp", "full");
    expect(endGroup("B")).toHaveAttribute("data-jacket-in-mm", "9");
    expect(fanOf("B")).toBe(T568B.join(" "));
    expect(screen.getByTestId("measure-B-depth")).toHaveTextContent("21 mm");
    expect(inspectionShown("B")).toEqual(inspect(createInitialState(S1_PRACTICE)).B);
  });
});

describe("physical actions", () => {
  it("4. CUT removes cable and shows the new end; the model refuses a cut through a plug", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    tool("Cut");
    slide("Cut behind the jacket edge", 10);
    press(/^Cut end A$/);

    expect(endGroup("A")).toHaveAttribute("data-jacket-edge-mm", "10");
    expect(screen.getByTestId("cable-length")).toHaveTextContent("978 mm");
    expect(feedback()).toHaveTextContent("Cut end A 10 mm behind its jacket edge");

    // End B's plug rear is 9 mm behind its jacket edge: 5 mm in is through the plug.
    selectEnd("B");
    slide("Cut behind the jacket edge", 5);
    press(/^Cut end B$/);

    expect(feedback()).toHaveAttribute("data-tone", "refused");
    expect(feedback()).toHaveTextContent("The cutters can't go through the plug");
    expect(endGroup("B")).toHaveAttribute("data-plug", "contacts-up");

    slide("Cut behind the jacket edge", 9);
    press(/^Cut end B$/);

    expect(endGroup("B")).toHaveAttribute("data-plug", "none");
    expect(feedback()).toHaveTextContent("The crimped plug went with the offcut.");
  });

  it("5. STRIP moves the jacket edge back and exposes conductor", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);

    expect(endGroup("A")).toHaveAttribute("data-jacket-edge-mm", "30");
    expect(endGroup("A")).toHaveAttribute("data-exposed-max-mm", "30");
    expect(screen.getByTestId("measure-A-exposed")).toHaveTextContent("30 mm");
    expect(screen.getByTestId("cable-length")).toHaveTextContent("958 mm");
    expect(feedback()).toHaveTextContent("Stripped 30 mm of jacket from end A.");
  });

  it("5b. STRIP through the small slot leaves a nick the bench shows", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    tool("Strip");
    fireEvent.click(screen.getByLabelText("Small round slot"));
    slide("Strip length", 30);
    press(/^Strip end A$/);

    expect(screen.getByTestId("nick-A")).toBeInTheDocument();
    expect(feedback()).toHaveTextContent("The blade scored the insulation");
  });

  it("6. UNTWIST untwists the chosen pair, from the tool or the bench", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    tool("Untwist");

    press(/^Untwist orange/);
    expect(screen.getByTestId("pair-A-orange")).toHaveAttribute("data-untwisted", "true");
    expect(screen.getByRole("button", { name: /^Untwist orange/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pair-A-green")).toHaveAttribute("data-untwisted", "false");

    // On the bench, a tap is a press and a release on the pair, read off the
    // pointer — never a click. The drawing is given a size, one unit to a pixel,
    // and the hand comes down in the middle of the green pair's grab band.
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
    const band = screen.getByTestId("pair-grab-A-green").querySelector("rect")!;
    const at = {
      clientX: Number(band.getAttribute("x")) + Number(band.getAttribute("width")) / 2,
      clientY: Number(band.getAttribute("y")) + Number(band.getAttribute("height")) / 2,
    };

    fireEvent.pointerDown(screen.getByTestId("pair-A-green"), { pointerId: 1, ...at });
    fireEvent.pointerUp(screen.getByTestId("pair-A-green"), { pointerId: 1, ...at });
    expect(screen.getByTestId("pair-A-green")).toHaveAttribute("data-untwisted", "true");
  });

  it("7. ARRANGE is the model's reorder — the others shift, nothing swaps", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    expect(fanOf("A")).toBe(NATURAL_ORDER.join(" "));

    tool("Arrange");
    press(/^Position 1: White\/orange/);
    press(/^Position 8: Brown/);

    const expected = modelAfter([
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "moveConductor", end: "A", conductor: "white-orange", toIndex: 7 },
    ]);

    expect(fanOf("A")).toBe(expected.ends.A.fan!.join(" "));
    expect(expected.ends.A.fan![0]).toBe("orange"); // shifted, not swapped
    expect(feedback()).toHaveTextContent("Moved White/orange from position 1 to position 8.");
  });

  it("8. TRIM shortens the conductors and leaves the cable length alone", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    trim(12);

    expect(endGroup("A")).toHaveAttribute("data-exposed-max-mm", "12");
    expect(screen.getByTestId("measure-A-exposed")).toHaveTextContent("12 mm");
    expect(screen.getByTestId("cable-length")).toHaveTextContent("958 mm");
  });

  it("9. INSERT needs a plug in hand, then fits it where the model puts it", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    arrangeT568B();
    trim(12);

    tool("Insert");
    expect(screen.getByRole("button", { name: /^Insert end A$/ })).toBeDisabled();

    press(/^Pick up a plug$/);
    fireEvent.click(screen.getByLabelText("Contacts down"));
    press(/^Insert end A$/);

    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-down");
    // Pushed to the slider's 10 mm; the model stops it at 9, where the conductors meet the front.
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "9");
    expect(screen.getByTestId("tray-count")).toHaveTextContent("3 left · 1 used");
    expect(screen.queryByText("Plug in hand")).not.toBeInTheDocument();
  });

  it("10. WITHDRAW takes an uncrimped plug off and returns it to the tray", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    trim(12);
    insertPlug();

    tool("Withdraw");
    press(/^Pull plug off end A$/);

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(screen.getByTestId("tray-count")).toHaveTextContent("4 left · 0 used");
  });

  it("10b. PUSH and WITHDRAW on the bench itself: the fitted plug is taken by its grip, pushed on, and pulled off", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    trim(12);
    tool("Insert");
    slide("Push the jacket into the plug", -5);
    press(/^Pick up a plug$/);
    press(/^Insert end A$/);
    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "-5");

    // The drawing is given a size, one unit to a pixel, and the hand works the
    // plug by its grip, read off the bench's own geometry — never a click.
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
    const slidePlug = (cable: CableState, inwardMm: number) => {
      const scale = benchScale(cable).scale;
      const grip = plugGrip("A", cable.ends.A, scale)!;
      const from = { clientX: grip.x + grip.width / 2, clientY: grip.bands[0].y + grip.bands[0].height / 2 };
      const to = { clientX: from.clientX - LAYOUT.A.dir * inwardMm * scale, clientY: from.clientY };

      fireEvent.pointerDown(svg, { pointerId: 1, ...from });
      fireEvent.pointerMove(svg, { pointerId: 1, ...to });
      fireEvent.pointerUp(svg, { pointerId: 1, ...to });
    };
    const fittedA: Action[] = [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "trim", end: "A", leaveMm: 12 },
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: -5 },
    ];

    slidePlug(modelAfter(fittedA), 8);

    expect(endGroup("A")).toHaveAttribute("data-jacket-in-mm", "3");
    expect(feedback()).toHaveTextContent("Pushed the plug further on — jacket 3 mm inside the plug.");

    slidePlug(modelAfter([...fittedA, { type: "push", end: "A", pushMm: 3 }]), -(WITHDRAW_PULL_MM + 1));

    expect(endGroup("A")).toHaveAttribute("data-plug", "none");
    expect(screen.getByTestId("tray-count")).toHaveTextContent("4 left · 0 used");
    expect(feedback()).toHaveTextContent("Pulled the plug off end A and put it back in the tray.");
  });

  it("11. CRIMP shows the model's crimp state, partial then full, and locks the plug", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    trim(12);
    insertPlug();

    tool("Crimp");
    expect(screen.getByTestId("crimp-state")).toHaveTextContent("not crimped");

    press(/^Half squeeze$/);
    expect(endGroup("A")).toHaveAttribute("data-crimp", "partial");
    expect(screen.getByTestId("crimp-state")).toHaveTextContent("partial");

    press(/^Squeeze fully$/);
    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");

    tool("Withdraw");
    press(/^Pull plug off end A$/);
    expect(feedback()).toHaveTextContent("is crimped and can't move");
    expect(endGroup("A")).toHaveAttribute("data-plug", "contacts-up");
  });

  it("11b. CRIMP on the bench itself: the crimper from the shelf full-crimps the plug it stands on", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    trim(12);
    insertPlug();
    expect(endGroup("A")).toHaveAttribute("data-crimp", "none");

    // The drawing is given a size, one unit to a pixel. The crimper is carried
    // from its shelf spot to end A, put down, and squeezed — never clicked.
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
    const shelf = { clientX: CRIMPER_SHELF_X, clientY: SHELF_TOP + 28 };
    const overA = { clientX: LAYOUT.A.x0 + LAYOUT.A.dir * 20, clientY: CY };

    fireEvent.pointerDown(screen.getByTestId("take-crimper"), { pointerId: 1, ...shelf });
    fireEvent.pointerMove(svg, { pointerId: 1, ...overA });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overA });

    // Standing on the plug is not a crimp.
    expect(endGroup("A")).toHaveAttribute("data-crimp", "none");

    fireEvent.pointerDown(screen.getByTestId("crimper"), { pointerId: 1, ...overA });
    fireEvent.pointerUp(svg, { pointerId: 1, ...overA });
    fireEvent.click(svg);

    expect(endGroup("A")).toHaveAttribute("data-crimp", "full");
    expect(feedback()).toHaveTextContent("Crimped end A fully.");
  });

  it("12b. CONNECT and DISCONNECT on the bench itself: a plug's lead is carried to a port and pressed in, then pulled out", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    // The drawing is given a size, one unit to a pixel. End B arrives with a
    // plug on it, so its lead is on the bench.
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
    const cable = createInitialState(S1_PRACTICE);
    const handle = leadHandle("B", cable.ends.B, benchScale(cable).scale)!;
    const main = portSlots(S1_PRACTICE.endpoints).find((slot) => slot.endpoint === "tester-main")!;
    const lead = { clientX: handle.cx, clientY: handle.cy };
    const atMain = { clientX: main.mouthX, clientY: main.mouthY + PORT_REACH / 2 };

    // Carried to MAIN and let go there: waiting, not plugged in.
    fireEvent.pointerDown(svg, { pointerId: 1, ...lead });
    fireEvent.pointerMove(svg, { pointerId: 1, ...atMain });
    fireEvent.pointerUp(svg, { pointerId: 1, ...atMain });
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("—");

    // Pressed in: never clicked.
    fireEvent.pointerDown(screen.getByTestId("plug-at-port"), { pointerId: 1, ...atMain });
    fireEvent.pointerUp(svg, { pointerId: 1, ...atMain });
    fireEvent.click(svg);

    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("End B");
    expect(feedback()).toHaveTextContent("Plugged end B into Tester MAIN.");

    // Pulled down, out of the port.
    const seated = { clientX: main.mouthX, clientY: main.mouthY + 10 };
    fireEvent.pointerDown(svg, { pointerId: 1, ...seated });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: seated.clientX, clientY: seated.clientY + 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: seated.clientX, clientY: seated.clientY + 40 });

    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("—");
    expect(feedback()).toHaveTextContent("Unplugged end B.");
  });

  it("12. CONNECT and DISCONNECT move an end in and out of the tester", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    selectEnd("B");
    tool("Connect");

    press(/^Plug end B into Tester MAIN/);
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("End B");

    press(/^Unplug end B$/);
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("—");

    // A raw end has no plug to plug in — the model says so.
    selectEnd("A");
    press(/^Plug end A into Tester REMOTE/);
    expect(feedback()).toHaveTextContent("End A has no plug on it.");
  });
});

describe("readouts", () => {
  it("13. the tester shows the model's wiremap, verdict and pattern", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    // Leave end A in natural order: a miswire against B's T568B, split pairs at A.
    strip(30);
    untwistAll();
    trim(12);
    insertPlug();
    crimpFully();

    tool("Connect");
    press(/Tester MAIN/);
    selectEnd("B");
    press(/Tester REMOTE/);
    press(/^TEST$/);

    const model = wiremap(
      modelAfter([
        { type: "strip", end: "A", amountMm: 30, slot: "correct" },
        ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
        { type: "trim", end: "A", leaveMm: 12 },
        { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
        { type: "crimp", end: "A", squeeze: "full" },
      ]),
    );

    expect(screen.getByTestId("tester-verdict")).toHaveTextContent(VERDICT_LABEL[model.verdict]);
    expect(model.verdict).toBe("miswired");
    const shownMap = within(screen.getByTestId("tester-map")).getAllByRole("listitem").map((li) => li.textContent);
    expect(shownMap).toEqual(model.map.map((far, index) => `${index + 1}→${far ?? "—"}`));
    expect(screen.getByText(/Pins 3–6 at end A carry White\/green and White\/blue/)).toBeInTheDocument();
  });

  it("13b. the tester explains an idle or remote-less reading, and flags a stale one", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    press(/^TEST$/);
    expect(screen.getByTestId("tester-readout")).toHaveTextContent("Nothing in the MAIN jack");

    selectEnd("B");
    tool("Connect");
    press(/Tester MAIN/);
    press(/^TEST$/);
    expect(screen.getByTestId("tester-readout")).toHaveTextContent("finds no REMOTE unit");

    press(/^Unplug end B$/);
    expect(screen.getByTestId("tester-readout")).toHaveTextContent("The cable has changed since this reading");
  });

  it("14. inspection shows the model's inspect() for each end", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    // A 17 mm trim seats the jacket at 4 mm: unclamped and over-untwisted.
    strip(30);
    untwistAll();
    arrangeT568B();
    trim(17);
    insertPlug();

    const expected = inspect(
      modelAfter([
        ...TERMINATE_A.slice(0, 7),
        { type: "trim", end: "A", leaveMm: 17 },
        { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
      ]),
    );

    expect(inspectionShown("A")).toEqual(expected.A);
    expect(expected.A.jacketClamped).toBe(false);
    expect(expected.A.untwistOk).toBe(false);
  });

  it("15. HAND IN previews exactly the model's toRecord(), and nothing derived", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    terminateAThroughUi();

    press(/^HAND IN$/);

    const shown = JSON.parse(screen.getByTestId("handin-record").textContent!);

    expect(shown).toEqual(toRecord(modelAfter(TERMINATE_A)));
    for (const derived of ["verdict", "pattern", "map", "standard", "passed", "untwisted", "tray"]) {
      expect(screen.getByTestId("handin-record").textContent).not.toContain(`"${derived}"`);
    }
    expect(screen.getByText(/nothing has been submitted and no mark is given here/)).toBeInTheDocument();
    expect(screen.getByTestId("handin-summary")).toHaveTextContent("End A: plug on, contacts up, fully crimped");
    expect(screen.getByTestId("handin-summary")).not.toHaveTextContent(/pass|fail|correct|straight/i);
  });
});

describe("refusals", () => {
  it("16. a refused action changes nothing on screen but the feedback", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    // Taken with the tool already out: changing tools legitimately changes the drawing.
    tool("Untwist");

    const before = {
      a: endGroup("A").outerHTML,
      b: endGroup("B").outerHTML,
      length: screen.getByTestId("cable-length").textContent,
      tray: screen.getByTestId("tray-count").textContent,
    };

    press(/^Untwist blue/);

    expect(feedback()).toHaveAttribute("data-tone", "refused");
    expect(feedback()).toHaveTextContent("There isn't enough conductor to grip");
    expect(feedback().textContent).not.toMatch(/too-short-to-grip/);
    expect(endGroup("A").outerHTML).toBe(before.a);
    expect(endGroup("B").outerHTML).toBe(before.b);
    expect(screen.getByTestId("cable-length").textContent).toBe(before.length);
    expect(screen.getByTestId("tray-count").textContent).toBe(before.tray);
  });

  it("17. feedback is announced politely and carries no internal codes", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    tool("Crimp");
    press(/^Squeeze fully$/);

    expect(screen.getByRole("status")).toBe(feedback());
    expect(feedback()).toHaveTextContent("End A has no plug on it.");
    expect(feedback().textContent).not.toMatch(/no-plug/);
  });
});

describe("the whole S1 path", () => {
  it("18. can be completed through the UI: terminate A, test end to end, hand in", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    terminateAThroughUi();

    expect(fanOf("A")).toBe(T568B.join(" "));
    expect(inspectionShown("A")).toEqual({
      jacketClamped: true,
      untwistOk: true,
      conductorsAtFront: true,
      insulationIntact: true,
    });

    tool("Connect");
    press(/Tester MAIN/);
    selectEnd("B");
    press(/Tester REMOTE/);
    press(/^TEST$/);

    expect(screen.getByTestId("tester-verdict")).toHaveTextContent("Straight-through");
    expect(wiremap(modelAfter(TERMINATE_A)).verdict).toBe("straight");
    expect(screen.getByTestId("hint")).toHaveTextContent(/Both ends are crimped/);

    press(/^HAND IN$/);
    const shown = JSON.parse(screen.getByTestId("handin-record").textContent!);
    expect(shown.ends.A.fan).toEqual([...T568B]);
    expect(shown.connections).toEqual({ A: "tester-main", B: "tester-remote" });
  });

  it("asks before resetting, and resets to the scenario's starting cable only when confirmed", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);

    press(/^Reset bench$/);
    press(/^Keep working$/);
    expect(endGroup("A")).toHaveAttribute("data-jacket-edge-mm", "30");

    press(/^Reset bench$/);
    press(/^Yes, reset$/);
    expect(endGroup("A")).toHaveAttribute("data-jacket-edge-mm", "0");
    expect(screen.getByTestId("cable-length")).toHaveTextContent("988 mm");
  });
});

describe("P2 review fixes", () => {
  it("says what each action did to the graded cable length", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    expect(feedback()).toHaveTextContent("Cable now 958 mm, 30 mm shorter.");

    untwistAll();
    trim(12);
    expect(feedback()).toHaveTextContent("Cable still 958 mm — trimming shortens only the exposed conductors.");
  });

  it("tells the student how far back to cut behind a plug", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    selectEnd("B");
    tool("Cut");
    slide("Cut behind the jacket edge", 5);
    press(/^Cut end B$/);

    expect(feedback()).toHaveTextContent("it covers the first 9 mm behind the jacket edge. Cut at least 9 mm back.");
  });

  it("previews what a strip, cut or trim would remove", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(within(endGroup("A")).getByTestId("tool-removed")).toHaveTextContent("jacket comes off");

    tool("Cut");
    expect(within(endGroup("A")).getByTestId("tool-removed")).toHaveTextContent("cut off");

    strip(30);
    tool("Trim");
    slide("Leave exposed", 12);
    expect(within(endGroup("A")).getByTestId("tool-removed")).toHaveTextContent("trimmed away");
  });

  it("numbers the fanned conductors on the bench to match the Arrange row", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();

    const numbers = within(screen.getByTestId("positions-A")).getAllByText(/^[1-8]$/).map((node) => node.textContent);
    expect(numbers).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("keeps the step buttons inside the row and explains the reorder while a conductor is held", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    tool("Arrange");

    press(/^Position 1: White\/orange/);
    expect(screen.getByRole("button", { name: /one place left/ })).toBeDisabled();
    expect(screen.getByText(/conductors in between slide over one place — nothing swaps/)).toBeInTheDocument();

    press(/^Position 1: White\/orange/); // put it down
    press(/^Position 8: Brown/);
    expect(screen.getByRole("button", { name: /one place right/ })).toBeDisabled();
    expect(screen.getByRole("list", { name: "T568B reference, pin 1 to pin 8" })).toBeInTheDocument();
  });

  it("labels a tester reading as a fault, a recognised pattern, or not measurable yet", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    selectEnd("B");
    tool("Connect");
    press(/Tester MAIN/);
    selectEnd("A");
    strip(30);
    untwistAll();
    arrangeT568B();
    trim(12);
    insertPlug();
    tool("Connect");
    press(/Tester REMOTE/);

    press(/^TEST$/);
    expect(screen.getByTestId("tester-kind")).toHaveTextContent("Can't measure yet");
    expect(screen.getByTestId("tester-help")).toHaveTextContent("isn't crimped");

    press(/^Unplug end A$/);
    crimpFully();
    tool("Connect");
    press(/Tester REMOTE/);
    press(/^TEST$/);
    expect(screen.getByTestId("tester-kind")).toHaveTextContent("Recognised wiring pattern");
    expect(screen.getByTestId("tester-help")).toHaveTextContent("depends on what you were asked to make");
    expect(feedback()).toHaveTextContent("Tester reads: Straight-through.");
  });

  it("explains a failed inspection check in plain words", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    strip(30);
    untwistAll();
    arrangeT568B();
    trim(17);
    insertPlug();

    expect(screen.getByTestId("inspection-why")).toHaveTextContent("End A: the jacket stops short");
    expect(screen.getByTestId("inspection-why")).toHaveTextContent("more than 13 mm of conductor is untwisted");
  });

  it("keeps one live region and announces each new message in it", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    const region = feedback();
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");

    strip(30);
    expect(feedback()).toBe(region);
    tool("Untwist");
    press(/^Untwist orange/);
    expect(feedback()).toBe(region);
    expect(region).toHaveTextContent("Untwisted the orange pair.");
  });

  it("marks suggested tools for screen readers without an aria-label on a bare span", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(within(toolbar()).getByRole("button", { name: "Untwist" })).toBeInTheDocument();
    strip(30);
    expect(within(toolbar()).getByRole("button", { name: "Untwist (suggested)" })).toBeInTheDocument();
  });
});
