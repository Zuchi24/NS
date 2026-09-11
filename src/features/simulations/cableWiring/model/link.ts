import { wiremap } from "./wiremap";
import type { CableState, EndpointKind, LinkState, Scenario, Verdict } from "./types";

/**
 * Whether two devices joined by this cable bring a link up.
 *
 * Only device ports count — a tester is not a link partner. V1 has auto-MDIX
 * off everywhere, so the cable has to suit the ports:
 *
 *   MDI  ↔ MDIX            straight-through
 *   MDI  ↔ MDI, MDIX ↔ MDIX crossover or gigabit crossover
 *
 * Anything else — including a split pair, whose verdict is not one of those —
 * leaves the link down.
 */
export function linkState(state: CableState, scenario: Scenario): LinkState {
  const portAt = (id: "A" | "B") => {
    const endpoint = scenario.endpoints.find((e) => e.id === state.connections[id]);

    return endpoint && isDevicePort(endpoint.kind) ? endpoint : undefined;
  };

  const a = portAt("A");
  const b = portAt("B");
  if (!a || !b) return { connected: false };

  const verdict = wiremap(state).verdict;
  const up = a.kind === b.kind ? CROSSED.includes(verdict) : verdict === "straight";

  return { connected: true, endpoints: [a.id, b.id], up };
}

const CROSSED: readonly Verdict[] = ["crossover", "gigabit-crossover"];

function isDevicePort(kind: EndpointKind): boolean {
  return kind === "mdi" || kind === "mdix";
}
