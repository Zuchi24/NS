import { describe, expect, it } from "vitest";

import { S1_PRACTICE, apply, createInitialState } from "../model";
import type { Action, RejectReason, SimEvent, Verdict } from "../model";
import { VERDICT_LABEL, eventsMessage, rejectionMessage } from "./messages";

/**
 * The words adapter: every model outcome has a sentence, and no sentence
 * leaks the model's internal codes.
 */

const REASONS: RejectReason[] = [
  "invalid-input", "plug-present", "no-plug", "plug-locked", "plug-connected", "no-fan", "tray-empty",
  "too-short-to-grip", "already-untwisted", "position-not-on-jacket", "cut-through-plug", "nothing-to-cut",
  "insufficient-cable", "no-change", "already-crimped", "already-connected", "not-connected",
  "unknown-endpoint", "endpoint-busy",
];

const ACTIONS: Action[] = [
  { type: "cut", end: "A", atMm: 5 },
  { type: "strip", end: "A", amountMm: 5, slot: "correct" },
  { type: "untwist", end: "A", pair: "blue" },
  { type: "moveConductor", end: "A", conductor: "blue", toIndex: 0 },
  { type: "trim", end: "A", leaveMm: 5 },
  { type: "insert", end: "A", orientation: "contacts-up", pushMm: 9 },
  { type: "push", end: "A", pushMm: 9 },
  { type: "withdraw", end: "A" },
  { type: "crimp", end: "A", squeeze: "partial" },
  { type: "connect", end: "A", endpoint: "tester-main" },
  { type: "disconnect", end: "A" },
];

describe("rejectionMessage", () => {
  it.each(REASONS)("has a plain sentence for %s, for every action", (reason) => {
    for (const action of ACTIONS) {
      const text = rejectionMessage(action, reason);

      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain(reason);
      expect(text).not.toMatch(/undefined|\[object/);
    }
  });

  it("puts a real refusal from the model into words", () => {
    const result = apply(createInitialState(S1_PRACTICE), ACTIONS[2], S1_PRACTICE);

    expect(result).toEqual({ rejected: "too-short-to-grip" });
    expect(rejectionMessage(ACTIONS[2], "too-short-to-grip")).toMatch(/at least 20 mm/);
  });
});

describe("eventsMessage", () => {
  const EVENTS: SimEvent[] = [
    { type: "cut", end: "A", fromJ: 10, toJ: 25 },
    { type: "plugReleased", end: "A" },
    { type: "plugDestroyed", end: "A" },
    { type: "stripped", end: "B", amountMm: 30, nicked: true },
    { type: "untwisted", end: "A", pair: "green" },
    { type: "fanned", end: "A" },
    { type: "conductorMoved", end: "A", conductor: "white-blue", fromIndex: 5, toIndex: 4 },
    { type: "trimmed", end: "A", leaveMm: 12, uneven: true },
    { type: "inserted", end: "A", orientation: "contacts-down", jacketInMm: -3 },
    { type: "pushed", end: "A", jacketInMm: 9 },
    { type: "withdrawn", end: "A" },
    { type: "crimped", end: "A", squeeze: "full" },
    { type: "connected", end: "A", endpoint: "tester-remote" },
    { type: "disconnected", end: "A" },
  ];

  it.each(EVENTS)("says what happened: $type", (event) => {
    const text = eventsMessage([event], S1_PRACTICE);

    expect(text.length).toBeGreaterThan(10);
    expect(text).not.toMatch(/undefined|\[object/);
  });

  it("uses the model's numbers and the ports' names", () => {
    expect(eventsMessage([EVENTS[0]], S1_PRACTICE)).toContain("15 mm");
    expect(eventsMessage([EVENTS[6]], S1_PRACTICE)).toContain("from position 6 to position 5");
    expect(eventsMessage([EVENTS[8]], S1_PRACTICE)).toContain("jacket 3 mm short of the plug");
    expect(eventsMessage([EVENTS[12]], S1_PRACTICE)).toContain("Tester REMOTE");
  });

  it("joins a multi-event result in the model's order", () => {
    expect(eventsMessage([EVENTS[0], EVENTS[2]], S1_PRACTICE)).toMatch(/^Cut end A .* The crimped plug went with the offcut\.$/);
  });
});

describe("VERDICT_LABEL", () => {
  it("names every verdict the model can return", () => {
    const verdicts: Verdict[] = [
      "incomplete", "short", "open", "miswired", "split-pair", "straight", "crossover", "gigabit-crossover", "rollover",
    ];

    expect(Object.keys(VERDICT_LABEL).sort()).toEqual([...verdicts].sort());
  });
});
