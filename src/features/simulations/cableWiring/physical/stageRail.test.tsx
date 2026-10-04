// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { createInitialState } from "../model";
import type { CableState, Crimp, EndId } from "../model";
import { StageRail } from "./components/StageRail";
import { PRACTICE_BENCH } from "./setup";

/**
 * The rail above the bench: one row per end, saying where its work stands.
 *
 * A half crimp is terminated in the model's sense but makes no contact, so it
 * must not get the same finished-looking pill as a full crimp.
 */

const scenario = PRACTICE_BENCH.scenario;

/**
 * The starting cable with a plug on end A, crimped as far as given — and on
 * end B too when asked. (The practice cable's end B starts factory-crimped.)
 */
function plugged(crimp: Crimp, crimpB?: Crimp): CableState {
  const state = createInitialState(scenario);
  const plug = (how: Crimp) => ({ orientation: "contacts-up" as const, jacketInMm: 6, crimp: how });

  return {
    ...state,
    ends: {
      A: { ...state.ends.A, plug: plug(crimp) },
      B: crimpB === undefined ? state.ends.B : { ...state.ends.B, plug: plug(crimpB) },
    },
  };
}

function Rail({ cable, initialEnd = "A" }: { cable: CableState; initialEnd?: EndId }) {
  const [selectedEnd, setSelectedEnd] = useState<EndId>(initialEnd);

  return (
    <StageRail cable={cable} selectedEnd={selectedEnd} onSelectEnd={setSelectedEnd} instruction={null} instructionEnd={null} />
  );
}

const endRow = (id: EndId) => screen.getByTestId(`stage-${id}`);
const pill = (id: EndId) => within(endRow(id)).queryByText("terminated");

afterEach(cleanup);

describe("the crimp pill", () => {
  it("marks a fully crimped end as terminated", () => {
    render(<Rail cable={plugged("full")} />);

    expect(endRow("A")).toHaveTextContent("crimped");
    expect(pill("A")).toBeInTheDocument();
    expect(pill("A")).toHaveClass("bg-emerald-100");
  });

  it("gives a half-crimped end no finished-looking pill, only its own words", () => {
    render(<Rail cable={plugged("partial")} />);

    expect(endRow("A")).toHaveTextContent("half-crimped");
    expect(pill("A")).toBeNull();
    expect(endRow("A").querySelector(".bg-emerald-100")).toBeNull();
  });

  it("shows no pill on a plug that has not been crimped at all", () => {
    render(<Rail cable={plugged("none")} />);

    expect(endRow("A")).toHaveTextContent("plug fitted, not crimped");
    expect(pill("A")).toBeNull();
  });

  it("judges each end by its own crimp", () => {
    render(<Rail cable={plugged("full", "partial")} />);

    expect(pill("A")).toBeInTheDocument();
    expect(endRow("B")).toHaveTextContent("half-crimped");
    expect(pill("B")).toBeNull();
  });
});

describe("choosing an end", () => {
  it("offers both ends, with the selected one pressed", () => {
    render(<Rail cable={createInitialState(scenario)} />);

    expect(endRow("A")).toHaveAttribute("aria-pressed", "true");
    expect(endRow("B")).toHaveAttribute("aria-pressed", "false");
  });

  it("moves to end B, and back to end A", () => {
    render(<Rail cable={createInitialState(scenario)} />);

    fireEvent.click(endRow("B"));
    expect(endRow("B")).toHaveAttribute("aria-pressed", "true");
    expect(endRow("A")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(endRow("A"));
    expect(endRow("A")).toHaveAttribute("aria-pressed", "true");
    expect(endRow("B")).toHaveAttribute("aria-pressed", "false");
  });
});
