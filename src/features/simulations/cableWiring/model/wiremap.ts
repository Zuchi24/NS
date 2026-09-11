import { PARTNER, PATTERNS, PIN_PAIRS, T568A, T568B } from "./constants";
import { hasContact, otherEnd, terminated } from "./geometry";
import type {
  CableEnd,
  CableState,
  Conductor,
  ElectricalReport,
  EndId,
  Pattern,
  Scenario,
  SplitPairFinding,
  Standard,
  TesterReadout,
} from "./types";

/**
 * What the wires actually do, computed from the physical state.
 *
 * A wiremap ignores `connections` entirely: whether the cable is sitting in a
 * tester has nothing to do with how it is wired. Only the tester readout and
 * the link state look at where the ends are plugged in.
 */

/**
 * The conductor on each pin, pin 1 first. Needs a plug: without one there are
 * no pins, only a fan.
 */
export function pinsAt(end: CableEnd): Conductor[] | null {
  if (end.plug === null || end.fan === null) return null;

  return end.plug.orientation === "contacts-up" ? [...end.fan] : [...end.fan].reverse();
}

/** A standard only if the pins match it exactly. Anything else — reversed-B included — is null. */
export function standardOf(pins: readonly Conductor[] | null): Standard | null {
  if (pins === null) return null;
  if (sameOrder(pins, T568A)) return "T568A";
  if (sameOrder(pins, T568B)) return "T568B";

  return null;
}

/** Pierced at both ends. V1 has no severed conductors, so that is all continuity takes. */
export function continuity(state: CableState, conductor: Conductor): boolean {
  return hasContact(state.ends.A, conductor) && hasContact(state.ends.B, conductor);
}

/**
 * Pin pairs at this end holding conductors that are not twisted partners.
 * Physical: it looks at colours, not signals, so it holds with or without
 * continuity. Empty when the end has no plug.
 */
export function structuralSplitPairs(state: CableState, endId: EndId): SplitPairFinding[] {
  const pins = pinsAt(state.ends[endId]);
  if (pins === null) return [];

  return PIN_PAIRS.filter(([p, q]) => PARTNER[pins[p - 1]] !== pins[q - 1]).map(([p, q]) => ({
    end: endId,
    pins: [p, q],
    conductors: [pins[p - 1], pins[q - 1]],
  }));
}

/** The end-to-end electrical picture, seen from end A. */
export function wiremap(state: CableState): ElectricalReport {
  return wiremapFrom(state, "A");
}

/**
 * The same picture seen from either end. Pins, the map and the opens are
 * numbered at `near`; split-pair findings are listed end A first, then B.
 *
 * Precedence, frozen: INCOMPLETE > SHORT > OPEN > MISWIRED > SPLIT-PAIR >
 * the pattern itself. An open never reads as a miswire — with any open there is
 * no complete map to name, so the pattern is null.
 */
export function wiremapFrom(state: CableState, near: EndId): ElectricalReport {
  const far = otherEnd(near);

  if (!terminated(state.ends.A) || !terminated(state.ends.B)) {
    return {
      verdict: "incomplete",
      pattern: null,
      map: Array<number | null>(8).fill(null),
      opens: [],
      openDetail: [],
      shorts: [],
      splitPairs: [],
    };
  }

  // A terminated end has a plug, and a plug has a fan, so both have pins.
  const nearPins = pinsAt(state.ends[near])!;
  const farPins = pinsAt(state.ends[far])!;

  const map = nearPins.map((conductor) =>
    continuity(state, conductor) ? farPins.indexOf(conductor) + 1 : null,
  );

  const opens = map.flatMap((reached, index) => (reached === null ? [index + 1] : []));
  const openDetail = opens.map((pin) => {
    const conductor = nearPins[pin - 1];

    return {
      aPin: pin,
      conductor,
      noContactAt: (["A", "B"] as const).filter((id) => !hasContact(state.ends[id], conductor)),
    };
  });

  // V1 models no shorts (B4). Kept in the report so the precedence is whole.
  const shorts: [number, number][] = [];

  const pattern: Pattern | null = opens.length ? null : matchPattern(map as number[]);

  const splitPairs = [
    ...structuralSplitPairs(state, "A"),
    ...structuralSplitPairs(state, "B"),
  ].filter(({ conductors }) => conductors.every((c) => continuity(state, c)));

  const verdict: ElectricalReport["verdict"] = shorts.length
    ? "short"
    : opens.length
      ? "open"
      : pattern === "miswired"
        ? "miswired"
        : splitPairs.length
          ? "split-pair"
          : pattern!;

  return { verdict, pattern, map, opens, openDetail, shorts, splitPairs };
}

/**
 * What a physical tester would show. It needs one end in the MAIN unit and the
 * other in the REMOTE; it reports from the MAIN end, so the pins it numbers
 * are that end's.
 */
export function testerReadout(state: CableState, scenario: Scenario): TesterReadout {
  const kindAt = (id: EndId) => {
    const endpoint = state.connections[id];

    return scenario.endpoints.find((candidate) => candidate.id === endpoint)?.kind;
  };

  const mainEnd = (["A", "B"] as const).find((id) => kindAt(id) === "tester-main");
  if (mainEnd === undefined) return { status: "idle" };
  if (kindAt(otherEnd(mainEnd)) !== "tester-remote") return { status: "no-remote", mainEnd };

  return { status: "report", mainEnd, report: wiremapFrom(state, mainEnd) };
}

function matchPattern(map: readonly number[]): Pattern {
  for (const [name, expected] of Object.entries(PATTERNS)) {
    if (sameOrder(map, expected)) return name as Pattern;
  }

  return "miswired";
}

function sameOrder<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
