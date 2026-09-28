import { describe, expect, it } from "vitest";

import { isCableValid, isConsoleLink } from "./networkValidation";
import type { Connection, Device } from "../types";

/**
 * Which cables may join which devices. The rule the canvas lights ports by,
 * and the one a packet may only cross a cable under (packetPath).
 *
 * Every pair of kinds is tried with every cable, both ways round, so a rule
 * that is not listed as valid here is pinned as invalid: adding a pair by
 * accident fails as surely as losing one.
 *
 * A hub is cabled as a switch is. A router is not carried by any cable yet,
 * and neither is fibre — both are the existing rule, not new ones.
 */

const KINDS = {
  pc: "pc",
  server: "server",
  switch: "switch-2960",
  hub: "hub-generic",
  router: "router-1941",
} as const;

type Kind = keyof typeof KINDS;

const device = (kind: Kind, id: string = kind): Device =>
  ({ id, type: KINDS[kind], family: kind, label: id, x: 0, y: 0 }) as Device;

const cable = (cableType: Connection["cableType"], from: Device, to: Device): Connection => ({
  id: "c1",
  from: from.id,
  to: to.id,
  fromPort: `${from.id}-p`,
  toPort: `${to.id}-p`,
  cableType,
});

/** The pairs each cable may join, either way round. Anything else is invalid. */
const VALID: Record<Connection["cableType"], [Kind, Kind][]> = {
  "copper-straight": [
    ["pc", "switch"],
    ["server", "switch"],
    ["switch", "switch"],
    ["pc", "hub"],
    ["server", "hub"],
    ["hub", "switch"],
    ["hub", "hub"],
  ],
  "copper-crossover": [
    ["pc", "pc"],
    ["pc", "server"],
    ["server", "server"],
  ],
  fiber: [],
  console: [],
};

const kinds = Object.keys(KINDS) as Kind[];
const pairs = kinds.flatMap((a, i) => kinds.slice(i).map((b) => [a, b] as [Kind, Kind]));

const isListed = (cableType: Connection["cableType"], a: Kind, b: Kind) =>
  VALID[cableType].some(([x, y]) => (x === a && y === b) || (x === b && y === a));

describe.each(Object.keys(VALID) as Connection["cableType"][])("a %s cable", (cableType) => {
  it.each(pairs)(`between a %s and a %s`, (a, b) => {
    const from = device(a, "A");
    const to = device(b, "B");
    const expected = isListed(cableType, a, b);

    expect(isCableValid(cable(cableType, from, to), from, to)).toBe(expected);
    expect(isCableValid(cable(cableType, to, from), to, from)).toBe(expected);
  });
});

describe("a hub", () => {
  const pc = device("pc");
  const hub = device("hub");
  const sw = device("switch");
  const otherHub = device("hub", "hub2");

  it("takes a straight-through from an end device, a switch or another hub", () => {
    expect(isCableValid(cable("copper-straight", pc, hub), pc, hub)).toBe(true);
    expect(isCableValid(cable("copper-straight", hub, sw), hub, sw)).toBe(true);
    expect(isCableValid(cable("copper-straight", hub, otherHub), hub, otherHub)).toBe(true);
  });

  it("takes no cross-over, fibre or console lead", () => {
    for (const cableType of ["copper-crossover", "fiber", "console"] as const) {
      expect(isCableValid(cable(cableType, pc, hub), pc, hub)).toBe(false);
      expect(isCableValid(cable(cableType, hub, sw), hub, sw)).toBe(false);
      expect(isCableValid(cable(cableType, hub, otherHub), hub, otherHub)).toBe(false);
    }
  });

  it("is not joined to a router by anything", () => {
    const router = device("router");

    for (const cableType of Object.keys(VALID) as Connection["cableType"][]) {
      expect(isCableValid(cable(cableType, hub, router), hub, router)).toBe(false);
    }
  });

  it("has no console port: a console lead to it is not a console link", () => {
    expect(isConsoleLink(cable("console", pc, hub), pc, hub)).toBe(false);
    expect(isConsoleLink(cable("console", pc, sw), pc, sw)).toBe(true);
  });
});
