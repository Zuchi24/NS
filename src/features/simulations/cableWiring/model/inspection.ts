import { MAX_UNTWIST } from "./constants";
import { conductorsAtFront, jacketClamped, maxExposed, nickActive } from "./geometry";
import type { CableEnd, CableState, EndId, EndInspection } from "./types";

/**
 * What a close look at a termination shows — the things a continuity test
 * cannot see. Every check fails on an end with no plug: there is no
 * termination to inspect.
 */
export function inspectEnd(end: CableEnd): EndInspection {
  if (end.plug === null) {
    return {
      jacketClamped: false,
      untwistOk: false,
      conductorsAtFront: false,
      insulationIntact: false,
    };
  }

  return {
    jacketClamped: jacketClamped(end),
    // A plugged end is fully untwisted, so its untwist is its longest exposed conductor.
    untwistOk: maxExposed(end) <= MAX_UNTWIST,
    conductorsAtFront: conductorsAtFront(end),
    insulationIntact: !end.nicksAtMm.some((n) => nickActive(end, n)),
  };
}

export function inspect(state: CableState): Record<EndId, EndInspection> {
  return { A: inspectEnd(state.ends.A), B: inspectEnd(state.ends.B) };
}
