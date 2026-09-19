// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { PAIR_IDS, S1_PRACTICE, apply, createInitialState, toRecord } from "../model";
import type { Action, CableRecord, CableState } from "../model";
import { PhysicalCableChallenge } from "./PhysicalCableChallenge";
import type { HandIn } from "./PhysicalCableChallenge";
import { PRACTICE_BENCH } from "./setup";

/**
 * Handing the cable in — the bench's half of it.
 *
 * The bench's whole part in a submission is to give someone the record the
 * model made, once per press, and to stop offering while that someone is busy.
 * It does not know who is listening or what they do with it, and these tests
 * do not tell it: the listener here is a spy, exactly as the standalone preview
 * is no listener at all.
 *
 * What is handed over is checked against the model's own toRecord() of the same
 * actions, so nothing here restates the record's shape — if the bench ever
 * built a second record of its own, this is what would catch it.
 */

afterEach(cleanup);

/** jsdom has no PointerEvent; the bench mounts handlers that name it. */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

Object.defineProperty(window, "PointerEvent", { writable: true, configurable: true, value: TestPointerEvent });

const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name, hidden: true }));
/** The tool shelf, scoped — "Strip" names both a tool and the button that uses it. */
const tool = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("toolbar", { name: "Tools", hidden: true })).getByRole("button", {
      name: new RegExp(`^${name}`),
      hidden: true,
    }),
  );
const slide = (label: string, value: number) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
const handInButton = () => screen.getByRole("button", { name: /^(HAND IN|SENDING…|HANDED IN)$/, hidden: true });
const shownRecord = (): CableRecord => JSON.parse(screen.getByTestId("handin-record").textContent!);

/** Some real work on the cable, so the record under test is not the empty one. */
const STRIP_AND_UNTWIST: Action[] = [
  { type: "strip", end: "A", amountMm: 30, slot: "correct" },
  ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
];

function doStripAndUntwistThroughUi() {
  tool("Strip");
  slide("Strip length", 30);
  press(/^Strip end A$/);
  tool("Untwist");
  for (const pair of PAIR_IDS) press(new RegExp(`^Untwist ${pair}`));
}

function modelAfter(actions: Action[]): CableState {
  return actions.reduce((state, action) => {
    const result = apply(state, action, S1_PRACTICE);
    if ("rejected" in result) throw new Error(`model refused ${action.type}: ${result.rejected}`);

    return result.state;
  }, createInitialState(S1_PRACTICE));
}

function wiring(over: Partial<HandIn> = {}): HandIn {
  return { submit: vi.fn(), submitting: false, submitted: false, ...over };
}

describe("handing the physical cable in", () => {
  it("gives the listener the model's own record, once per press", () => {
    const handIn = wiring();

    render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);
    doStripAndUntwistThroughUi();

    press(/^HAND IN$/);

    expect(handIn.submit).toHaveBeenCalledTimes(1);

    // The record handed over is the model's toRecord() of the same work — not
    // a rebuild, and not anything derived.
    const handed = vi.mocked(handIn.submit).mock.calls[0][0];

    expect(handed).toEqual(toRecord(modelAfter(STRIP_AND_UNTWIST)));
    expect(handed.schema).toBe("cable/1");

    // And it is the very object the panel is showing, so a student cannot be
    // looking at one record while another is sent.
    expect(handed).toEqual(shownRecord());
    for (const derived of ["verdict", "pattern", "map", "standard", "passed"]) {
      expect(JSON.stringify(handed)).not.toContain(`"${derived}"`);
    }
  });

  it("hands over again only when pressed again, not when the page re-renders", () => {
    const handIn = wiring();
    const { rerender } = render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);

    press(/^HAND IN$/);
    expect(handIn.submit).toHaveBeenCalledTimes(1);

    // A caller that builds a fresh callback every render — which is what a
    // route with an inline arrow does — must not make this fire again.
    rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={{ ...handIn, submit: handIn.submit }} />);
    rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={{ ...handIn, submit: handIn.submit }} />);
    expect(handIn.submit).toHaveBeenCalledTimes(1);

    press(/^HAND IN$/);
    expect(handIn.submit).toHaveBeenCalledTimes(2);
  });

  it("stops offering to hand in while the listener is busy", () => {
    const handIn = wiring({ submitting: true });

    render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);

    expect(handInButton()).toBeDisabled();
    expect(handInButton()).toHaveTextContent("SENDING…");

    fireEvent.click(handInButton());

    expect(handIn.submit).not.toHaveBeenCalled();
  });

  it("stops offering to hand in once the work is in", () => {
    const handIn = wiring({ submitted: true });

    render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);

    expect(handInButton()).toBeDisabled();
    expect(handInButton()).toHaveTextContent("HANDED IN");

    fireEvent.click(handInButton());

    expect(handIn.submit).not.toHaveBeenCalled();
  });

  it("leaves the cable exactly as it was when a handover fails", () => {
    const handIn = wiring();
    const { rerender } = render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);

    doStripAndUntwistThroughUi();
    const before = screen.getByTestId("end-A").outerHTML;

    press(/^HAND IN$/);
    const sent = vi.mocked(handIn.submit).mock.calls[0][0];

    // The listener takes it, is busy, and comes back having failed: no mark, so
    // `submitted` never turns true. That is the whole of what the bench sees.
    rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={{ ...handIn, submitting: true }} />);
    rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={{ ...handIn, submitting: false }} />);

    // The physical state is untouched by any of it, and the record still
    // matches the model — a failed send corrupts nothing.
    expect(screen.getByTestId("end-A").outerHTML).toBe(before);
    expect(shownRecord()).toEqual(toRecord(modelAfter(STRIP_AND_UNTWIST)));
    expect(sent).toEqual(shownRecord());

    // And the student may try again, because nothing was ever marked.
    expect(handInButton()).toBeEnabled();
    press(/^HAND IN$/);
    expect(handIn.submit).toHaveBeenCalledTimes(2);
  });

  it("says where the record goes, and says nothing about whether it is right", () => {
    const handIn = wiring();
    const { rerender } = render(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={handIn} />);

    press(/^HAND IN$/);

    expect(screen.getByText(/sent to be marked/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing has been submitted/i)).not.toBeInTheDocument();

    rerender(<PhysicalCableChallenge {...PRACTICE_BENCH} handIn={{ ...handIn, submitted: true }} />);

    expect(screen.getByText(/Handed in\./)).toBeInTheDocument();
    expect(screen.getByTestId("handin-summary")).not.toHaveTextContent(/pass|fail|correct|straight/i);
  });
});

describe("the standalone preview, which has no listener at all", () => {
  it("renders and prepares the record with no wiring supplied", () => {
    // Exactly how preview/main.tsx mounts it: the setup, and nothing else.
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);
    doStripAndUntwistThroughUi();

    press(/^HAND IN$/);

    expect(shownRecord()).toEqual(toRecord(modelAfter(STRIP_AND_UNTWIST)));
    expect(screen.getByText(/nothing has been submitted and no mark is given here/)).toBeInTheDocument();
  });

  it("keeps offering hand-in, because nothing is ever in flight", () => {
    render(<PhysicalCableChallenge {...PRACTICE_BENCH} />);

    expect(handInButton()).toBeEnabled();
    expect(handInButton()).toHaveTextContent("HAND IN");

    press(/^HAND IN$/);
    press(/^HAND IN$/);

    expect(handInButton()).toBeEnabled();
  });
});
