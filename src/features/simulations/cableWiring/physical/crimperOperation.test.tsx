// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, makeEnd } from "../model";
import type { Action, CableEnd, CableState, EndId, Scenario, StripSlot } from "../model";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import { CY, HEIGHT, LAYOUT, SHELF_TOP, WIDTH, benchScale } from "./benchGeometry";
import { BenchView } from "./components/BenchView";
import { CRIMPER_SHELF_X } from "./components/CrimperTool";
import { crimperOperationFor } from "./crimperOperation";
import { PRACTICE_BENCH } from "./setup";
import { TOOLS } from "./tools";
import type { ToolId } from "./tools";

/**
 * The bench's one hand tool. Cutting the cable, stripping, trimming and
 * crimping are all done with the RJ45 crimper, and which of them taking it
 * starts is the operation chosen in the toolbar — authoritatively: where it is
 * put down never turns one operation into another. Each operation is still its
 * own gesture sending its own action, and results are checked against apply().
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

type Point = { clientX: number; clientY: number };

const ON_SHELF = { clientX: CRIMPER_SHELF_X, clientY: SHELF_TOP + 28 };

const raw = () => makeEnd({ jacketEdgeMm: 0, tipMm: 0 });
const OPEN_SCENARIO: Scenario = { ...S1_PRACTICE, initialEnds: { A: raw(), B: raw() } };

function modelAfter(actions: Action[], scenario: Scenario = OPEN_SCENARIO): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, scenario);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(scenario));
}

const stripA: Action = { type: "strip", end: "A", amountMm: 30, slot: "correct" };
const plugOnA: Action[] = [
  stripA,
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
  { type: "trim", end: "A", leaveMm: 12 },
  { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
];

/** Over an end's jacket, this far in from its edge. */
const onJacket = (cable: CableState, end: EndId, mm: number): Point => ({
  clientX: LAYOUT[end].x0 - LAYOUT[end].dir * mm * benchScale(cable).scale,
  clientY: CY,
});
/** Over an end's bare conductor, leaving this much of it. */
const onWires = (cable: CableState, end: EndId, leaveMm: number): Point => ({
  clientX: LAYOUT[end].x0 + LAYOUT[end].dir * leaveMm * benchScale(cable).scale,
  clientY: CY,
});
/** Over the plug on end A. */
const OVER_PLUG_A = { clientX: LAYOUT.A.x0 + LAYOUT.A.dir * 20, clientY: CY };

function watch(svg: Element) {
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

  return svg;
}

/** The bench drawing on its own, told the toolbar's operation, every action it can send spied on. */
function benchViewAt(cable: CableState, operation: ToolId, stripSlot: StripSlot = "correct") {
  const spies = {
    onStrip: vi.fn(),
    onUntwist: vi.fn(),
    onArrange: vi.fn(),
    onTrim: vi.fn(),
    onCut: vi.fn(),
    onCrimp: vi.fn(),
    onSelectEnd: vi.fn(),
  };

  render(
    <BenchView
      cable={cable}
      scenario={OPEN_SCENARIO}
      selectedEnd="A"
      markers={{ A: null, B: null }}
      operation={operation}
      stripSlot={stripSlot}
      {...spies}
    />,
  );

  return { svg: watch(screen.getByRole("img", { name: /Workbench/ })), ...spies };
}

/** Take the crimper off the shelf and carry it to a point, optionally letting go there. */
function carry(svg: Element, to: Point, { release = true } = {}) {
  fireEvent.pointerDown(screen.getByTestId("take-crimper"), { pointerId: 1, ...ON_SHELF });
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: (ON_SHELF.clientX + to.clientX) / 2, clientY: (ON_SHELF.clientY + to.clientY) / 2 });
  fireEvent.pointerMove(svg, { pointerId: 1, ...to });
  if (release) fireEvent.pointerUp(svg, { pointerId: 1, ...to });
}

/** Close a hand on the crimper where it stands, and lift it without travelling. */
function squeeze(svg: Element, tool: Element, at: Point) {
  fireEvent.pointerDown(tool, { pointerId: 1, ...at });
  fireEvent.pointerUp(svg, { pointerId: 1, ...at });
  fireEvent.click(svg);
}

describe("which job the crimper does", () => {
  it("maps CUT, STRIP, TRIM and CRIMP to the crimper, and nothing else", () => {
    expect(crimperOperationFor("cut")).toBe("cut");
    expect(crimperOperationFor("strip")).toBe("strip");
    expect(crimperOperationFor("trim")).toBe("trim");
    expect(crimperOperationFor("crimp")).toBe("crimp");
    for (const tool of ["untwist", "arrange", "insert", "withdraw", "connect"] as const) {
      expect(crimperOperationFor(tool)).toBeNull();
    }
    expect(TOOLS.map((tool) => tool.id).sort()).toEqual(
      ["arrange", "connect", "crimp", "cut", "insert", "strip", "trim", "untwist", "withdraw"].sort(),
    );
  });

  it("CUT → the cable cut, on the jacket", () => {
    const cable = createInitialState(OPEN_SCENARIO);
    const { svg, onCut, onTrim } = benchViewAt(cable, "cut");

    carry(svg, onJacket(cable, "A", 15));
    const standing = screen.getByTestId("cable-cutters");
    squeeze(svg, standing, onJacket(cable, "A", 15));

    expect(onCut).toHaveBeenCalledWith("A", Number(standing.getAttribute("data-at-mm")));
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("STRIP → the strip, through the slot chosen in the strip controls — the wrong one included", () => {
    for (const slot of ["correct", "too-deep"] as const) {
      const cable = createInitialState(OPEN_SCENARIO);
      const { svg, onStrip, onCut } = benchViewAt(cable, "strip", slot);

      carry(svg, onJacket(cable, "A", 20));

      expect(onStrip).toHaveBeenCalledWith("A", 20, slot);
      expect(onCut).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("TRIM → the trim, on the exposed wires", () => {
    const cable = modelAfter([stripA]);
    const { svg, onTrim, onCut } = benchViewAt(cable, "trim");

    carry(svg, onWires(cable, "A", 14));
    squeeze(svg, screen.getByTestId("cutters"), onWires(cable, "A", 14));

    expect(onTrim).toHaveBeenCalledWith("A", 14);
    expect(onCut).not.toHaveBeenCalled();
  });

  it("CRIMP → the crimp, on the plug", () => {
    const cable = modelAfter(plugOnA);
    const { svg, onCrimp } = benchViewAt(cable, "crimp");

    carry(svg, OVER_PLUG_A);
    squeeze(svg, screen.getByTestId("crimper"), OVER_PLUG_A);

    expect(onCrimp).toHaveBeenCalledWith("A", "full");
  });

  it("is authoritative: CUT over the exposed wires does not become a trim", () => {
    const cable = modelAfter([stripA]);
    const { svg, onCut, onTrim } = benchViewAt(cable, "cut");

    carry(svg, onWires(cable, "A", 14));

    // There is no jacket under the cable cut, so it goes back on the shelf.
    expect(screen.queryByTestId("cutters")).toBeNull();
    expect(screen.queryByTestId("cable-cutters")).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
    expect(onTrim).not.toHaveBeenCalled();
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("false");
  });

  it("is authoritative: TRIM on the grey jacket does not become a cut", () => {
    const cable = modelAfter([stripA]);
    const { svg, onCut, onTrim } = benchViewAt(cable, "trim");

    carry(svg, onJacket(cable, "A", 10));

    expect(screen.queryByTestId("cable-cutters")).toBeNull();
    expect(screen.queryByTestId("cutters")).toBeNull();
    expect(onCut).not.toHaveBeenCalled();
    expect(onTrim).not.toHaveBeenCalled();
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("false");
  });

  it("takes nothing for a job the crimper does not do", () => {
    for (const operation of ["untwist", "arrange", "insert", "withdraw", "connect"] as const) {
      const cable = createInitialState(OPEN_SCENARIO);
      const { svg } = benchViewAt(cable, operation);

      expect(screen.getByTestId("crimper-tool").getAttribute("data-operation")).toBe("");
      carry(svg, onJacket(cable, "A", 15));

      for (const out of ["cable-cutters", "cutters", "stripper-in-hand", "crimper"]) {
        expect(screen.queryByTestId(out)).toBeNull();
      }
      cleanup();
    }
  });
});

describe("on the whole page", () => {
  function page(initialEnds: Record<EndId, CableEnd> = { A: raw(), B: raw() }) {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} scenario={{ ...PRACTICE_BENCH.scenario, initialEnds }} />);
    const svg = watch(screen.getByRole("img", { name: /Workbench/ }));
    const toolbar = screen.getByRole("toolbar", { name: "Tools", hidden: true });
    const choose = (name: string) =>
      fireEvent.click(within(toolbar).getByRole("button", { name: new RegExp(`^${name}`), hidden: true }));
    const endA = () => screen.getByTestId("end-A");

    return { svg, choose, endA };
  }

  it("Cut → crimper → grey cable → cut", () => {
    const { svg, choose, endA } = page();
    const cable = createInitialState(OPEN_SCENARIO);

    choose("Cut");
    carry(svg, onJacket(cable, "A", 15));
    const atMm = Number(screen.getByTestId("cable-cutters").getAttribute("data-at-mm"));
    squeeze(svg, screen.getByTestId("cable-cutters"), onJacket(cable, "A", 15));

    const cut = modelAfter([{ type: "cut", end: "A", atMm }]);
    expect(Number(endA().getAttribute("data-jacket-edge-mm"))).toBe(cut.ends.A.jacketEdgeMm);
    expect(screen.getByTestId("feedback")).toHaveTextContent(/Cut end A/);
  });

  it("Strip → UTP slot → crimper → jacket → strip", () => {
    const { svg, choose, endA } = page();

    choose("Strip");
    fireEvent.click(screen.getByLabelText("UTP slot (Cat5e/6)"));
    carry(svg, onJacket(createInitialState(OPEN_SCENARIO), "A", 30));

    expect(Number(endA().getAttribute("data-jacket-edge-mm"))).toBe(30);
    expect(screen.queryAllByTestId("nick-A")).toHaveLength(0);
  });

  it("Strip → the wrong jaw → the insulation is nicked, as before", () => {
    const { svg, choose, endA } = page();

    choose("Strip");
    fireEvent.click(screen.getByLabelText("Small round slot"));
    carry(svg, onJacket(createInitialState(OPEN_SCENARIO), "A", 30));

    expect(Number(endA().getAttribute("data-jacket-edge-mm"))).toBe(30);
    expect(screen.getAllByTestId("nick-A").length).toBeGreaterThan(0);
  });

  it("Trim → crimper → exposed wires → trim", () => {
    const { svg, choose, endA } = page({ A: modelAfter([stripA]).ends.A, B: raw() });
    const cable = modelAfter([stripA]);

    choose("Trim");
    carry(svg, onWires(cable, "A", 14));
    squeeze(svg, screen.getByTestId("cutters"), onWires(cable, "A", 14));

    expect(Number(endA().getAttribute("data-exposed-max-mm"))).toBe(14);
    expect(screen.getByTestId("feedback")).toHaveTextContent(/Trimmed end A/);
  });

  it("Crimp → crimper → RJ45 plug → crimp", () => {
    const { svg, choose } = page({ A: modelAfter(plugOnA).ends.A, B: raw() });

    choose("Crimp");
    carry(svg, OVER_PLUG_A);
    squeeze(svg, screen.getByTestId("crimper"), OVER_PLUG_A);

    expect(screen.getByTestId("feedback")).toHaveTextContent(/Crimped end A fully/);
  });

  it("follows the toolbar: the crimper's job is the one chosen there", () => {
    const { choose } = page();
    const operation = () => screen.getByTestId("crimper-tool").getAttribute("data-operation");

    for (const [name, expected] of [
      ["Cut", "cut"],
      ["Strip", "strip"],
      ["Trim", "trim"],
      ["Crimp", "crimp"],
      ["Untwist", ""],
    ] as const) {
      choose(name);
      expect(operation()).toBe(expected);
    }
  });

  it("cannot be taken off the shelf for one job while it is out doing another", () => {
    const { svg, choose, endA } = page();
    const cable = createInitialState(OPEN_SCENARIO);

    choose("Cut");
    carry(svg, onJacket(cable, "A", 15));
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("true");

    choose("Strip");
    carry(svg, onJacket(cable, "A", 20));

    expect(screen.queryByTestId("stripper-in-hand")).toBeNull();
    expect(Number(endA().getAttribute("data-jacket-edge-mm"))).toBe(0);
    expect(screen.getByTestId("cable-cutters")).toBeInTheDocument();
  });

  it("keeps the precise controls working on their own", () => {
    const { choose, endA } = page();

    choose("Strip");
    fireEvent.change(screen.getByLabelText("Strip length"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /^Strip end A$/, hidden: true }));
    expect(Number(endA().getAttribute("data-jacket-edge-mm"))).toBe(25);
    expect(screen.getByTestId("crimper-tool").getAttribute("data-lifted")).toBe("false");
  });

  it("has one crimper and the plug tray on the shelf, and no part picker", () => {
    page();

    expect(screen.getAllByTestId("crimper-tool")).toHaveLength(1);
    expect(screen.getAllByTestId("take-crimper")).toHaveLength(1);
    expect(screen.getByTestId("take-plug")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Blade|stripping slot|Crimp die/, hidden: true })).toBeNull();
    expect(screen.queryByTestId("crimper-in-hand")).toBeNull();
    for (const gone of ["cutters-tool", "cable-cutters-tool", "take-cutters", "take-cable-cutters", "take-correct", "take-too-deep"]) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
  });
});
