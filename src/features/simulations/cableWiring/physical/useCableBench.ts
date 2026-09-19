import { useCallback, useMemo, useReducer } from "react";

import { apply, createInitialState, jacketedLengthMm, testerReadout, toRecord } from "../model";
import type { Action, CableRecord, CableState, Scenario, TesterReadout } from "../model";
import { VERDICT_LABEL, eventsMessage, rejectionMessage } from "./messages";

/**
 * The bench's one piece of physical state: the P1 model's CableState.
 *
 * Every physical change goes through the model's apply(). A refusal leaves the
 * cable exactly as it was and only sets the feedback line. TEST and HAND IN
 * change nothing physical — they take a reading from the model (a tester
 * readout, a cable/1 record) and hold on to it, together with the cable it was
 * taken from, so the panels can say when the cable has changed since.
 *
 * apply() does not throw for a mistake; it refuses. So nothing here catches:
 * if apply() does throw, that is a bug, and it should surface as one.
 */

export interface Feedback {
  tone: "done" | "refused" | "info";
  text: string;
  /** Bumps on every message, so a repeated sentence is still announced. */
  seq: number;
}

export interface Reading<T> {
  value: T;
  /** The cable the reading was taken from. */
  cable: CableState;
}

export interface BenchState {
  cable: CableState;
  feedback: Feedback | null;
  test: Reading<TesterReadout> | null;
  handIn: Reading<CableRecord> | null;
}

export type BenchCommand =
  | { kind: "act"; action: Action }
  | { kind: "test" }
  | { kind: "handIn" }
  | { kind: "reset" };

export function initialBench(scenario: Scenario): BenchState {
  return { cable: createInitialState(scenario), feedback: null, test: null, handIn: null };
}

export function benchReducer(bench: BenchState, command: BenchCommand, scenario: Scenario): BenchState {
  const seq = (bench.feedback?.seq ?? 0) + 1;

  switch (command.kind) {
    case "act": {
      const result = apply(bench.cable, command.action, scenario);

      if ("rejected" in result) {
        return {
          ...bench,
          feedback: { tone: "refused", text: rejectionMessage(command.action, result.rejected, bench.cable), seq },
        };
      }

      return {
        ...bench,
        cable: result.state,
        feedback: {
          tone: "done",
          text: `${eventsMessage(result.events, scenario)}${lengthNote(command.action, bench.cable, result.state, scenario)}`,
          seq,
        },
      };
    }

    case "test": {
      const readout = testerReadout(bench.cable, scenario);

      return {
        ...bench,
        test: { value: readout, cable: bench.cable },
        feedback: { tone: "info", text: testerSentence(readout), seq },
      };
    }

    case "handIn":
      return {
        ...bench,
        handIn: { value: toRecord(bench.cable), cable: bench.cable },
        // What becomes of the record is the caller's business, so the sentence
        // stops at what the model did: it made one. The panel says where it goes.
        feedback: { tone: "info", text: "Hand-in record prepared.", seq },
      };

    case "reset":
      return { ...initialBench(scenario), feedback: { tone: "info", text: "Bench reset to the scenario's starting cable.", seq } };
  }
}

/**
 * What an action did to the graded, jacket-to-jacket length — the model's
 * number before and after. A trim is called out even though it changes
 * nothing, because "does trimming shorten my cable?" is exactly the question.
 */
function lengthNote(action: Action, before: CableState, after: CableState, scenario: Scenario): string {
  const was = jacketedLengthMm(before, scenario);
  const now = jacketedLengthMm(after, scenario);

  if (now !== was) return ` Cable now ${now} mm, ${was - now} mm shorter.`;
  if (action.type === "trim") return ` Cable still ${now} mm — trimming shortens only the exposed conductors.`;

  return "";
}

function testerSentence(readout: TesterReadout): string {
  switch (readout.status) {
    case "idle":
      return "The tester has nothing in its MAIN jack.";
    case "no-remote":
      return "The tester found no REMOTE unit on the far end.";
    case "report":
      return `Tester reads: ${VERDICT_LABEL[readout.report.verdict]}.`;
  }
}

export function useCableBench(scenario: Scenario) {
  const reducer = useMemo(
    () => (bench: BenchState, command: BenchCommand) => benchReducer(bench, command, scenario),
    [scenario],
  );
  const [bench, send] = useReducer(reducer, scenario, initialBench);

  return {
    ...bench,
    act: useCallback((action: Action) => send({ kind: "act", action }), []),
    runTest: useCallback(() => send({ kind: "test" }), []),
    prepareHandIn: useCallback(() => send({ kind: "handIn" }), []),
    reset: useCallback(() => send({ kind: "reset" }), []),
  };
}
