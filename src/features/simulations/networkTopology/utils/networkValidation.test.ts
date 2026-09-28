import { describe, expect, it } from "vitest";

import { isCableValid, isConsoleLink, isLinkUp } from "./networkValidation";
import type { Connection, Device } from "../types";

/**
 * Which cables may join which devices.
 *
 * Two questions, kept apart: whether a packet may cross a cable (isCableValid,
 * which the packet route is built from) and whether the cable brings a link up
 * (isLinkUp, which the ports light by). They differ only for a router, whose
 * uplink comes up although nothing routes across it yet.
 *
 * The copper rules are the cable bench's: auto-MDIX is off, so an end device
 * meets a switch or hub on a straight-through, and like meets like on a
 * cross-over. Fibre runs switch to switch and nowhere else.
 *
 * Every pair of kinds is tried with every cable, both ways round, so a rule
 * that is not listed as valid here is pinned as invalid: adding a pair by
 * accident fails as surely as losing one.
 */

const KINDS = {
  pc: "pc",
  server: "server",
  switch: "switch-2960",
  hub: "hub-generic",
  router: "router-1941",
} as const;

type Kind = keyof typeof KINDS;
type CableType = Connection["cableType"];

const device = (kind: Kind, id: string = kind): Device =>
  ({ id, type: KINDS[kind], family: kind, label: id, x: 0, y: 0 }) as Device;

const cable = (cableType: CableType, from: Device, to: Device): Connection => ({
  id: "c1",
  from: from.id,
  to: to.id,
  fromPort: `${from.id}-p`,
  toPort: `${to.id}-p`,
  cableType,
});

/** The pairs a packet may cross each cable between, either way round. */
const TRAVERSABLE: Record<CableType, [Kind, Kind][]> = {
  "copper-straight": [
    ["pc", "switch"],
    ["server", "switch"],
    ["pc", "hub"],
    ["server", "hub"],
  ],
  "copper-crossover": [
    ["pc", "pc"],
    ["pc", "server"],
    ["server", "server"],
    ["switch", "switch"],
    ["hub", "switch"],
    ["hub", "hub"],
  ],
  fiber: [["switch", "switch"]],
  console: [],
};

/** The pairs each cable brings a link up between: the above, and a router's uplink. */
const UP: Record<CableType, [Kind, Kind][]> = {
  ...TRAVERSABLE,
  "copper-straight": [...TRAVERSABLE["copper-straight"], ["router", "switch"]],
};

const cableTypes = Object.keys(TRAVERSABLE) as CableType[];
const kinds = Object.keys(KINDS) as Kind[];
const pairs = kinds.flatMap((a, i) => kinds.slice(i).map((b) => [a, b] as [Kind, Kind]));

const isListed = (table: Record<CableType, [Kind, Kind][]>, cableType: CableType, a: Kind, b: Kind) =>
  table[cableType].some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Both ways round, so the answer never depends on which end was wired first. */
const bothWays = (rule: typeof isCableValid, cableType: CableType, a: Kind, b: Kind) => {
  const from = device(a, "A");
  const to = device(b, "B");

  return [rule(cable(cableType, from, to), from, to), rule(cable(cableType, to, from), to, from)];
};

describe.each(cableTypes)("a packet over a %s cable", (cableType) => {
  it.each(pairs)("between a %s and a %s", (a, b) => {
    const expected = isListed(TRAVERSABLE, cableType, a, b);

    expect(bothWays(isCableValid, cableType, a, b)).toEqual([expected, expected]);
  });
});

describe.each(cableTypes)("the link of a %s cable", (cableType) => {
  it.each(pairs)("between a %s and a %s", (a, b) => {
    const expected = isListed(UP, cableType, a, b);

    expect(bothWays(isLinkUp, cableType, a, b)).toEqual([expected, expected]);
  });
});

describe("a switch to a switch", () => {
  it("takes a cross-over now, not a straight-through: like to like, with auto-MDIX off", () => {
    expect(bothWays(isCableValid, "copper-crossover", "switch", "switch")).toEqual([true, true]);
    expect(bothWays(isCableValid, "copper-straight", "switch", "switch")).toEqual([false, false]);
  });

  it("takes fibre, the one pair that does", () => {
    expect(bothWays(isCableValid, "fiber", "switch", "switch")).toEqual([true, true]);

    for (const [a, b] of pairs.filter(([a, b]) => !(a === "switch" && b === "switch"))) {
      expect(bothWays(isLinkUp, "fiber", a, b)).toEqual([false, false]);
    }
  });
});

describe("a hub", () => {
  it("takes a straight-through from an end device, as a switch does", () => {
    expect(bothWays(isCableValid, "copper-straight", "pc", "hub")).toEqual([true, true]);
    expect(bothWays(isCableValid, "copper-crossover", "pc", "hub")).toEqual([false, false]);
  });

  it("takes a cross-over to a switch or another hub, as a switch does", () => {
    expect(bothWays(isCableValid, "copper-crossover", "hub", "switch")).toEqual([true, true]);
    expect(bothWays(isCableValid, "copper-crossover", "hub", "hub")).toEqual([true, true]);
    expect(bothWays(isCableValid, "copper-straight", "hub", "switch")).toEqual([false, false]);
    expect(bothWays(isCableValid, "copper-straight", "hub", "hub")).toEqual([false, false]);
  });

  it("takes no fibre", () => {
    expect(bothWays(isLinkUp, "fiber", "hub", "switch")).toEqual([false, false]);
    expect(bothWays(isLinkUp, "fiber", "hub", "hub")).toEqual([false, false]);
  });

  it("has no console port: a console lead to it is not a console link", () => {
    const pc = device("pc");

    expect(isConsoleLink(cable("console", pc, device("hub")), pc, device("hub"))).toBe(false);
    expect(isConsoleLink(cable("console", pc, device("switch")), pc, device("switch"))).toBe(true);
  });
});

describe("a router", () => {
  it("brings its straight-through uplink to a switch up", () => {
    expect(bothWays(isLinkUp, "copper-straight", "router", "switch")).toEqual([true, true]);
  });

  it("carries no packet across that uplink: nothing routes yet", () => {
    expect(bothWays(isCableValid, "copper-straight", "router", "switch")).toEqual([false, false]);
  });

  it("brings no other link up, whatever the cable", () => {
    for (const cableType of cableTypes) {
      for (const other of kinds) {
        if (cableType === "copper-straight" && other === "switch") continue;

        expect(bothWays(isLinkUp, cableType, "router", other)).toEqual([false, false]);
      }
    }
  });
});

/**
 * Every cable in the seeded challenges' reference answers (the backend's
 * SeededContentTest), which the grader passes. The canvas must show each as a
 * working link, or a student would see a passing answer lying dead on the
 * canvas. The grader's own copy of the UP table (ChallengeValidatorTest)
 * holds it to the same rule.
 */
describe("the seeded challenges' reference answers", () => {
  it.each([
    ["Uplink a second switch", "switch", "switch", "copper-crossover"],
    ["Run fibre between buildings", "switch", "switch", "fiber"],
    ["Add a gateway router", "router", "switch", "copper-straight"],
    ["Put a server on the network", "server", "switch", "copper-straight"],
    ["Redundant Network Path", "switch", "router", "copper-straight"],
    ["Connect a PC to a switch", "pc", "switch", "copper-straight"],
  ] as [string, Kind, Kind, CableType][])("%s: a %s to a %s on %s is up", (_title, a, b, cableType) => {
    expect(bothWays(isLinkUp, cableType, a, b)).toEqual([true, true]);
  });

  it("carry no packet across a router's uplink, though it is up", () => {
    expect(bothWays(isCableValid, "copper-straight", "router", "switch")).toEqual([false, false]);
  });
});

describe("a console lead", () => {
  it("is never a data link, and never brings a link up", () => {
    for (const [a, b] of pairs) {
      expect(bothWays(isCableValid, "console", a, b)).toEqual([false, false]);
      expect(bothWays(isLinkUp, "console", a, b)).toEqual([false, false]);
    }
  });

  it("is still a console link between a host and a switch, and only there", () => {
    const pc = device("pc");
    const sw = device("switch");

    expect(isConsoleLink(cable("console", pc, sw), pc, sw)).toBe(true);
    expect(isConsoleLink(cable("console", sw, pc), sw, pc)).toBe(true);
    expect(isConsoleLink(cable("console", pc, device("router")), pc, device("router"))).toBe(false);
  });
});
