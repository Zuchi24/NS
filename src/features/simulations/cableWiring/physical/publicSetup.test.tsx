// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import contractText from "../contract/cable-contract.v1.json?raw";
import { parsePhysicalChallengeConfig } from "../integration/publicConfig";
import { S1_PRACTICE } from "../model";
import type { Difficulty } from "@/features/content/types";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import { ToolControls, DEFAULT_CONTROLS } from "./components/ToolControls";
import { endpointLabel, eventsMessage } from "./messages";
import { PRACTICE_BENCH } from "./setup";
import type { BenchSetup } from "./setup";

/**
 * P3.4b: the bench runs on a challenge's public side only — the parsed public
 * config plus the challenge's title, difficulty and description. Every setup
 * here comes from the frozen contract's public_config through the P3.4 parser;
 * nothing private is supplied, so a bench that needed it would fail here.
 */

afterEach(cleanup);
vi.setConfig({ testTimeout: 20_000 });

const contract = JSON.parse(contractText) as { scenarios: Record<string, { public_config: unknown }> };

function setupFor(key: string, challenge: { title: string; difficulty: Difficulty; description: string | null }): BenchSetup {
  const parsed = parsePhysicalChallengeConfig(JSON.parse(JSON.stringify(contract.scenarios[key].public_config)));
  if (!parsed.ok) throw new Error(`${key} did not parse`);

  return { ...parsed.value, ...challenge };
}

const S1 = () => setupFor("S1", { title: "Terminate a straight-through cable", difficulty: "beginner", description: "Wire both ends to T568B." });
const S2 = () => setupFor("S2", { title: "Terminate a cable on a tight budget", difficulty: "intermediate", description: null });
const S5 = () => setupFor("S5", { title: "Make a cable to link two PCs", difficulty: "advanced", description: null });

const toolbar = () => screen.getByRole("toolbar", { name: "Tools", hidden: true });
const tool = (name: string) => fireEvent.click(within(toolbar()).getByRole("button", { name: new RegExp(`^${name}`), hidden: true }));
const selectEnd = (id: "A" | "B") =>
  fireEvent.click(within(screen.getByRole("group", { name: "Cable end", hidden: true })).getByRole("button", { name: `End ${id}`, hidden: true }));
const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
const objectives = () => screen.queryByRole("list", { name: "Objectives" });
const reference = () => screen.queryByRole("list", { name: /reference, pin 1 to pin 8$/ });

/** End B arrives fanned in S1, so the Arrange tool shows its reference card straight away. */
function openArrangeOnB() {
  selectEnd("B");
  tool("Arrange");
}

describe("S1 from its public config", () => {
  it("shows the challenge's title, difficulty and description, and no extra objectives", () => {
    render(<PhysicalCableChallenge {...S1()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terminate a straight-through cable");
    expect(screen.getByText("beginner")).toBeInTheDocument();
    expect(screen.getByText("Wire both ends to T568B.")).toBeInTheDocument();
    expect(objectives()).toBeNull();
  });

  it("shows the T568B reference card, from assist.reference", () => {
    render(<PhysicalCableChallenge {...S1()} />);
    openArrangeOnB();

    expect(reference()).toHaveAccessibleName("T568B reference, pin 1 to pin 8");
  });

  it("keeps the tester ports usable, named as the tester names them", () => {
    render(<PhysicalCableChallenge {...S1()} />);
    selectEnd("B");
    tool("Connect");
    press(/^Plug end B into Tester MAIN/);

    expect(screen.getByTestId("feedback")).toHaveTextContent("Plugged end B into Tester MAIN.");
    expect(screen.getByTestId("tester-main-end")).toHaveTextContent("End B");
  });

  it("falls back to a plain objective when the challenge gives no description", () => {
    render(<PhysicalCableChallenge {...S1()} description={null} />);

    expect(screen.getByText("Terminate the cable.")).toBeInTheDocument();
  });

  it("is what the practice bench already is: the same scenario, objectives and help", () => {
    const { scenario, objectives: goals, assist } = S1();
    const { id, startLengthMm, plugs, initialEnds, endpoints } = S1_PRACTICE;

    expect(PRACTICE_BENCH.scenario).toEqual(scenario);
    expect(scenario).toEqual({ id, startLengthMm, plugs, initialEnds, endpoints });
    expect(PRACTICE_BENCH.objectives).toEqual(goals);
    expect(PRACTICE_BENCH.assist).toEqual(assist);
  });
});

describe("S2 from its public config", () => {
  it("shows the length budget and the inspections as objectives", () => {
    render(<PhysicalCableChallenge {...S2()} />);

    const list = within(objectives()!);
    expect(list.getByText("Keep at least 290 mm of cable, jacket to jacket.")).toBeInTheDocument();
    expect(list.getByText("Both ends are inspected for the jacket gripped by the strain relief; no more than 13 mm untwisted.")).toBeInTheDocument();
    expect(screen.getByText("Terminate the cable.")).toBeInTheDocument();
  });

  it("runs with assist null: no hint, no reference card, no invented standard", () => {
    render(<PhysicalCableChallenge {...S2()} />);

    expect(screen.queryByTestId("hint")).toBeNull();
    expect(document.body.textContent).not.toMatch(/T568/);
  });
});

describe("the contract 1.1.0 scenarios from their public configs", () => {
  const S6 = () => setupFor("S6", { title: "Match the factory end", difficulty: "intermediate", description: null });
  const S8 = () => setupFor("S8", { title: "Make a cable to link a PC to a switch", difficulty: "advanced", description: null });
  const S9 = () => setupFor("S9", { title: "Fix the link", difficulty: "advanced", description: null });

  it("opens S6 as an intermediate bench: no reference card and no hint", () => {
    render(<PhysicalCableChallenge {...S6()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Match the factory end");
    openArrangeOnB();
    expect(reference()).toBeNull();
    expect(document.body.textContent).not.toMatch(/T568A|T568B/);
  });

  it.each([
    ["S8", S8],
    ["S9", S9],
  ])("names %s's link objective by its devices' labels, and never the cable it takes", (_key, setup) => {
    render(<PhysicalCableChallenge {...setup()} />);

    expect(within(objectives()!).getByText("PC-1 and Switch-1 must show a link.")).toBeInTheDocument();
    tool("Connect");
    for (const name of ["Tester MAIN", "Tester REMOTE", "PC-1", "Switch-1"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^Plug end A into ${name}`), hidden: true })).toBeInTheDocument();
    }
    expect(document.body.textContent).not.toContain("sw-1:port1");
    expect(document.body.textContent).not.toMatch(/crossover|straight-through|\bMDI-?X?\b/i);
  });
});

describe("S5 from its public config", () => {
  it("names the link objective by the PCs' labels, and lists all four inspections", () => {
    render(<PhysicalCableChallenge {...S5()} />);

    const list = within(objectives()!);
    expect(list.getByText("PC-1 and PC-2 must show a link.")).toBeInTheDocument();
    expect(list.getByText(/^Both ends are inspected for .*reaching the front of the plug; no damaged insulation\.$/)).toBeInTheDocument();
  });

  it("offers each port by its label, never by its id", () => {
    render(<PhysicalCableChallenge {...S5()} />);
    tool("Connect");

    for (const name of ["Tester MAIN", "Tester REMOTE", "PC-1", "PC-2"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^Plug end A into ${name}`), hidden: true })).toBeInTheDocument();
    }
    expect(document.body.textContent).not.toContain("pc-1:eth0");
    expect(document.body.textContent).not.toMatch(/crossover|straight-through/i);
  });
});

describe("endpoint identity: the id is what connects, the label is only what it is called", () => {
  const scenarioWithLabel = (label: string) => {
    const { scenario } = S5();

    return { ...scenario, endpoints: scenario.endpoints.map((e) => (e.id === "pc-1:eth0" ? { ...e, label } : e)) };
  };

  it("sends the same connect action whatever the port's label says", () => {
    const sent = (label: string) => {
      const act = vi.fn();
      render(
        <ToolControls
          tool="connect"
          endId="A"
          end={S5().scenario.initialEnds.A}
          connections={{}}
          scenario={scenarioWithLabel(label)}
          assist={null}
          beginner={false}
          controls={DEFAULT_CONTROLS}
          setControls={() => {}}
          act={act}
        />,
      );
      press(new RegExp(`^Plug end A into ${label}`));
      cleanup();

      return act.mock.calls;
    };

    expect(sent("PC-1")).toEqual([[{ type: "connect", end: "A", endpoint: "pc-1:eth0" }]]);
    expect(sent("Office PC")).toEqual([[{ type: "connect", end: "A", endpoint: "pc-1:eth0" }]]);
  });

  it("records the endpoint's id in the hand-in record, not its label", () => {
    const setup = S1();
    const relabelled = { ...setup, scenario: { ...setup.scenario, endpoints: setup.scenario.endpoints.map((e) => ({ ...e, label: `Bench ${e.kind}` })) } };

    render(<PhysicalCableChallenge {...relabelled} />);
    selectEnd("B");
    tool("Connect");
    press(/^Plug end B into Bench tester-main/);
    press(/^HAND IN$/);

    expect(JSON.parse(screen.getByTestId("handin-record").textContent!).connections).toEqual({ B: "tester-main" });
  });

  it("words a label where there is one, the tester's names where there is none, and the id as a last resort", () => {
    const { scenario } = S5();
    const unlabelled = { endpoints: [{ id: "switch-1:gi0/1", kind: "mdix" as const }] };

    expect(endpointLabel(scenario, "pc-2:eth0")).toBe("PC-2");
    expect(endpointLabel(scenario, "tester-remote")).toBe("Tester REMOTE");
    expect(endpointLabel(unlabelled, "switch-1:gi0/1")).toBe("switch-1:gi0/1");
    expect(eventsMessage([{ type: "connected", end: "A", endpoint: "pc-1:eth0" }], scenario)).toBe("Plugged end A into PC-1.");
  });
});

describe("assist changes only what is shown", () => {
  const variants: [string, BenchSetup["assist"], string | null][] = [
    ["T568B", { reference: { A: "T568B", B: "T568B" } }, "T568B reference, pin 1 to pin 8"],
    ["T568A", { reference: { A: "T568A", B: "T568A" } }, "T568A reference, pin 1 to pin 8"],
    ["null", null, null],
  ];

  it("swaps or removes the reference card, while the same work hands in the same record", () => {
    const records = variants.map(([, assist, card]) => {
      render(<PhysicalCableChallenge {...S1()} assist={assist} />);

      openArrangeOnB();
      if (card === null) expect(reference()).toBeNull();
      else expect(reference()).toHaveAccessibleName(card);

      tool("Connect");
      press(/^Plug end B into Tester MAIN/);
      press(/^HAND IN$/);
      const record = screen.getByTestId("handin-record").textContent;
      cleanup();

      return record;
    });

    expect(records[0]).not.toBeNull();
    expect(new Set(records).size).toBe(1);
  });
});
