import { describe, expect, it } from "vitest";

import contractText from "../contract/cable-contract.v1.json?raw";
import { S1_PRACTICE, createInitialState, rawEnd, toRecord } from "../model";
import type { CableRecord } from "../model";
import { PRIVATE_CONFIG_KEYS, isPhysicalConfig, parseCableRecord, parsePhysicalChallengeConfig } from "./publicConfig";
import type { ParseResult, PhysicalChallengeConfig } from "./publicConfig";

/**
 * P3.4: the public config of a physical challenge, read into what the bench
 * runs on. Every config here is the frozen contract's own `public_config`
 * (cable-contract.v1.json) or a copy of one with a single thing broken.
 */

interface Contract {
  scenarios: Record<string, { rule: string; public_config: Record<string, unknown> }>;
  rules: Record<string, { type: string; initial_ends?: unknown }>;
  record_fixtures: { id: string; rule: string; record: CableRecord; expected: { canonical_record?: CableRecord } }[];
}

const contract = JSON.parse(contractText) as Contract;

/** Loose on purpose: these tests break configs in ways their types would forbid. */
type Json = Record<string, any>;

/** A fresh, deep copy of a scenario's public config, safe to break. */
function config(key: string): Json {
  return JSON.parse(JSON.stringify(contract.scenarios[key].public_config));
}

function parsed(key: string): PhysicalChallengeConfig {
  const result = parsePhysicalChallengeConfig(config(key));
  if (!result.ok) throw new Error(`${key} did not parse: ${JSON.stringify(result.errors)}`);

  return result.value;
}

function errorPaths(result: ParseResult<unknown>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.path);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
}

/** The same JSON with every object's keys in reverse order, as a reordering database might return it. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversedKeys);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reversedKeys(child)]));
}

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
}

describe("the frozen scenarios", () => {
  it("S1: 1000 mm, four plugs, raw A and factory B, the tester, no extra objectives, the T568B card", () => {
    const { scenario, objectives, assist } = parsed("S1");

    expect(scenario.id).toBe("s1-straight-through");
    expect(scenario.startLengthMm).toBe(1000);
    expect(scenario.plugs).toBe(4);
    expect(scenario.endpoints).toEqual([
      { id: "tester-main", kind: "tester-main" },
      { id: "tester-remote", kind: "tester-remote" },
    ]);
    expect(objectives).toEqual({ minLengthMm: null, inspection: [], link: null });
    expect(assist).toEqual({ reference: { A: "T568B", B: "T568B" } });
  });

  it("S1 runs on exactly the bench's practice S1 — same length, plugs, ends and endpoints", () => {
    const { scenario } = parsed("S1");
    const { id, startLengthMm, plugs, initialEnds, endpoints } = S1_PRACTICE;

    expect(scenario).toEqual({ id, startLengthMm, plugs, initialEnds, endpoints });
    expect(createInitialState(scenario)).toEqual(createInitialState(S1_PRACTICE));
  });

  it("S2: 400 mm, three plugs, both ends raw, a 290 mm minimum and two inspections, no assist", () => {
    const { scenario, objectives, assist } = parsed("S2");

    expect(scenario.startLengthMm).toBe(400);
    expect(scenario.plugs).toBe(3);
    expect(scenario.initialEnds).toEqual({ A: rawEnd(0), B: rawEnd(0) });
    expect(objectives).toEqual({ minLengthMm: 290, inspection: ["strain_relief", "untwist"], link: null });
    expect(assist).toBeNull();
  });

  it("S5: 2000 mm, three plugs, both ends raw, the tester and two labelled PCs, a link between them, no assist", () => {
    const { scenario, objectives, assist } = parsed("S5");

    expect(scenario.startLengthMm).toBe(2000);
    expect(scenario.plugs).toBe(3);
    expect(scenario.initialEnds).toEqual({ A: rawEnd(0), B: rawEnd(0) });
    expect(scenario.endpoints).toEqual([
      { id: "tester-main", kind: "tester-main" },
      { id: "tester-remote", kind: "tester-remote" },
      { id: "pc-1:eth0", kind: "mdi", label: "PC-1" },
      { id: "pc-2:eth0", kind: "mdi", label: "PC-2" },
    ]);
    expect(objectives).toEqual({
      minLengthMm: null,
      inspection: ["strain_relief", "untwist", "front", "insulation"],
      link: ["pc-1:eth0", "pc-2:eth0"],
    });
    expect(assist).toBeNull();
  });

  it("S4, defined but not seeded, parses too", () => {
    expect(parsed("S4").scenario.id).toBe("s4-repair-miswired");
  });

  it.each(Object.keys(contract.scenarios))("%s keeps its starting ends exactly: they serialise back to the config's", (key) => {
    const { scenario } = parsed(key);
    const initialEnds = config(key).scenario.initial_ends;

    expect(toRecord(createInitialState(scenario)).ends).toEqual(initialEnds);
  });
});

describe("what the adapter hands on", () => {
  it.each(Object.keys(contract.scenarios))("%s: scenario facts, objectives and help only — no grading result", (key) => {
    const keys = new Set(keysDeep(parsed(key)));
    const allowed = new Set([
      "scenario", "id", "startLengthMm", "plugs", "initialEnds", "endpoints", "kind", "label",
      "A", "B", "jacketEdgeMm", "tipMm", "fan", "plug", "nicksAtMm", "untwisted", "orientation", "jacketInMm", "crimp",
      "white-orange", "orange", "white-green", "green", "blue", "white-blue", "white-brown", "brown",
      "objectives", "minLengthMm", "inspection", "link", "assist", "reference",
    ]);

    expect([...keys].filter((name) => !allowed.has(name))).toEqual([]);
    for (const word of ["verdict", "pattern", "passed", "standard", "map", "opens", "splitPairs", "requirements", "require"]) {
      expect(keys.has(word), word).toBe(false);
    }
  });

  it("needs none of the private grading keys: the frozen configs carry none, and parse", () => {
    for (const key of Object.keys(contract.scenarios)) {
      const keys = keysDeep(config(key));

      for (const privateKey of PRIVATE_CONFIG_KEYS) expect(keys, `${key} ${privateKey}`).not.toContain(privateKey);
      expect(parsePhysicalChallengeConfig(config(key)).ok, key).toBe(true);
    }
  });

  it("is deterministic, and does not touch its input", () => {
    const input = deepFreeze(config("S5"));
    const before = JSON.stringify(input);

    const first = parsePhysicalChallengeConfig(input);
    const second = parsePhysicalChallengeConfig(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("shares nothing with its input, so changing the result cannot change the config", () => {
    const input = config("S1");
    const result = parsePhysicalChallengeConfig(input);

    if (!result.ok) throw new Error("S1 did not parse");
    result.value.scenario.initialEnds.B.fan!.reverse();
    result.value.scenario.initialEnds.B.tipMm.brown = 5;
    result.value.scenario.endpoints.pop();

    expect(input).toEqual(config("S1"));
    expect(parsePhysicalChallengeConfig(input)).toEqual({ ok: true, value: parsed("S1") });
  });

  it("does not depend on key order anywhere", () => {
    for (const key of Object.keys(contract.scenarios)) {
      expect(parsePhysicalChallengeConfig(reversedKeys(config(key)))).toEqual(parsePhysicalChallengeConfig(config(key)));
    }
  });

  it("tells a physical config from a legacy one by its model", () => {
    expect(isPhysicalConfig(config("S1"))).toBe(true);
    expect(isPhysicalConfig({ standard: "T568B", cable: "straight" })).toBe(false);
    expect(isPhysicalConfig(null)).toBe(false);
    expect(isPhysicalConfig("physical")).toBe(false);
  });
});

describe("assist and endpoint labels", () => {
  it("keeps assist null as null, and refuses a config that leaves assist out", () => {
    expect(parsed("S2").assist).toBeNull();

    const missing = config("S2");
    delete missing.assist;

    expect(errorPaths(parsePhysicalChallengeConfig(missing))).toContain("assist");
  });

  it("keeps a one-sided reference as given, without filling in the other end", () => {
    const input = config("S1");
    input.assist = { reference: { A: "T568A" } };

    const result = parsePhysicalChallengeConfig(input);

    expect(result.ok && result.value.assist).toEqual({ reference: { A: "T568A" } });
  });

  it("keeps an endpoint without a label unlabelled, rather than inventing one", () => {
    const [main] = parsed("S5").scenario.endpoints;

    expect(main).toEqual({ id: "tester-main", kind: "tester-main" });
    expect("label" in main).toBe(false);
  });
});

describe("refusing a malformed config", () => {
  const cases: [string, string, (c: Json) => unknown, string][] = [
    ["not an object", "S1", () => null, ""],
    ["a list", "S1", () => [], ""],
    ["the wrong model", "S1", (c) => ({ ...c, model: "legacy" }), "model"],
    ["no model", "S1", (c) => (delete c.model, c), "model"],
    ["the legacy config", "S1", () => ({ standard: "T568B", cable: "straight" }), "model"],
    ["no scenario", "S1", (c) => (delete c.scenario, c), "scenario"],
    ["an empty scenario id", "S1", (c) => ((c.scenario.id = ""), c), "scenario.id"],
    ["a string start length", "S1", (c) => ((c.scenario.start_length_mm = "1000"), c), "scenario.start_length_mm"],
    ["a fractional start length", "S1", (c) => ((c.scenario.start_length_mm = 1000.5), c), "scenario.start_length_mm"],
    ["negative plugs", "S1", (c) => ((c.scenario.plugs = -1), c), "scenario.plugs"],
    ["no end B", "S1", (c) => (delete c.scenario.initial_ends.B, c), "scenario.initial_ends.B"],
    ["a third end", "S1", (c) => ((c.scenario.initial_ends.C = c.scenario.initial_ends.A), c), "scenario.initial_ends.C"],
    ["a tip as a string", "S1", (c) => ((c.scenario.initial_ends.A.tip_mm.brown = "0"), c), "scenario.initial_ends.A.tip_mm.brown"],
    ["tips as a list", "S1", (c) => ((c.scenario.initial_ends.A.tip_mm = [0, 0, 0, 0, 0, 0, 0, 0]), c), "scenario.initial_ends.A.tip_mm"],
    ["an unknown orientation", "S1", (c) => ((c.scenario.initial_ends.B.plug.orientation = "up"), c), "scenario.initial_ends.B.plug.orientation"],
    ["a crimp in the wrong case", "S1", (c) => ((c.scenario.initial_ends.B.plug.crimp = "FULL"), c), "scenario.initial_ends.B.plug.crimp"],
    ["a fan with an unknown conductor", "S1", (c) => ((c.scenario.initial_ends.B.fan[0] = "red"), c), "scenario.initial_ends.B.fan"],
    ["a fan of seven", "S1", (c) => (c.scenario.initial_ends.B.fan.pop(), c), "scenario.initial_ends"],
    ["a plug past the jacket stop", "S1", (c) => ((c.scenario.initial_ends.B.plug.jacket_in_mm = 11), c), "scenario.initial_ends"],
    ["a tip beyond the jacket edge", "S1", (c) => ((c.scenario.initial_ends.B.tip_mm.brown = 13), c), "scenario.initial_ends"],
    ["nicks that are not a list", "S1", (c) => ((c.scenario.initial_ends.A.nicks_at_mm = 3), c), "scenario.initial_ends.A.nicks_at_mm"],
    ["an unknown key in an end", "S1", (c) => ((c.scenario.initial_ends.A.untwisted = {}), c), "scenario.initial_ends.A.untwisted"],
    ["no endpoints", "S1", (c) => ((c.scenario.endpoints = []), c), "scenario.endpoints"],
    ["an unknown endpoint kind", "S5", (c) => ((c.scenario.endpoints[2].kind = "switch"), c), "scenario.endpoints.2.kind"],
    ["a repeated endpoint id", "S5", (c) => ((c.scenario.endpoints[3].id = "pc-1:eth0"), c), "scenario.endpoints.3.id"],
    ["an empty label", "S5", (c) => ((c.scenario.endpoints[2].label = ""), c), "scenario.endpoints.2.label"],
    ["a numeric label", "S5", (c) => ((c.scenario.endpoints[2].label = 1), c), "scenario.endpoints.2.label"],
    ["no objectives", "S1", (c) => (delete c.scenario.objectives, c), "scenario.objectives"],
    ["an unknown inspection", "S2", (c) => ((c.scenario.objectives.inspection = ["smell"]), c), "scenario.objectives.inspection"],
    ["a repeated inspection", "S2", (c) => ((c.scenario.objectives.inspection = ["untwist", "untwist"]), c), "scenario.objectives.inspection"],
    ["a zero minimum length", "S2", (c) => ((c.scenario.objectives.min_length_mm = 0), c), "scenario.objectives.min_length_mm"],
    ["a one-ended link", "S5", (c) => ((c.scenario.objectives.link = ["pc-1:eth0"]), c), "scenario.objectives.link"],
    ["a link to an unknown port", "S5", (c) => ((c.scenario.objectives.link = ["pc-1:eth0", "pc-9:eth0"]), c), "scenario.objectives.link"],
    ["a missing objective", "S1", (c) => (delete c.scenario.objectives.link, c), "scenario.objectives.link"],
    ["an unknown standard in the reference", "S1", (c) => ((c.assist.reference.A = "T568C"), c), "assist.reference.A"],
    ["a reference for a third end", "S1", (c) => ((c.assist.reference.C = "T568B"), c), "assist.reference.C"],
    ["assist as a string", "S1", (c) => ((c.assist = "yes"), c), "assist"],
    ["an unknown key in the scenario", "S1", (c) => ((c.scenario.difficulty = "beginner"), c), "scenario.difficulty"],
  ];

  it.each(cases)("refuses %s", (_what, key, breakIt, path) => {
    const result = parsePhysicalChallengeConfig(breakIt(config(key)));

    expect(result.ok).toBe(false);
    expect(errorPaths(result)).toContain(path);
  });

  const privateCases: [string, (c: Json) => void, string][] = [
    ["require on the scenario", (c) => (c.scenario.require = { ends: { A: "T568B", B: "T568B" } }), "scenario.require"],
    ["the expected cable", (c) => (c.scenario.objectives.cable = "crossover"), "scenario.objectives.cable"],
    ["the expected ends", (c) => (c.scenario.ends = "each-standard"), "scenario.ends"],
    ["validation_rules at the top", (c) => (c.validation_rules = []), "validation_rules"],
    ["a requirement list", (c) => (c.requirements = []), "requirements"],
    ["an expected result on an endpoint", (c) => (c.scenario.endpoints[0].expected = true), "scenario.endpoints.0.expected"],
    ["a description inside assist", (c) => (c.assist = { reference: { A: "T568B" }, describe: "wire it B" }), "assist.describe"],
    ["require hidden inside the reference", (c) => (c.assist = { reference: { require: "T568B" } }), "assist.reference.require"],
  ];

  it.each(privateCases)("refuses private grading configuration: %s", (_what, addIt, path) => {
    const input = config("S5");
    addIt(input);

    const result = parsePhysicalChallengeConfig(input);

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.filter((error) => error.path === path).map((error) => error.message).join(" ")).toMatch(/private grading/);
  });

  it("reports every problem, not just the first", () => {
    const input = config("S1");
    input.model = "legacy";
    input.scenario.plugs = "4";
    input.assist = "yes";

    expect(errorPaths(parsePhysicalChallengeConfig(input))).toEqual(expect.arrayContaining(["model", "scenario.plugs", "assist"]));
  });
});

describe("reading back a stored cable/1 record", () => {
  const seeded = contract.record_fixtures.filter((fixture) => fixture.rule in contract.scenarios);

  it.each(seeded.map((fixture) => [fixture.id, fixture] as const))("%s reads back as its canonical record", (_id, fixture) => {
    const { scenario } = parsed(fixture.rule);
    const result = parseCableRecord(JSON.parse(JSON.stringify(fixture.record)), scenario);

    expect(result).toEqual({
      ok: true,
      value: fixture.expected.canonical_record ?? { ...fixture.record, connections: fixture.record.connections ?? {} },
    });
  });

  it("reads empty connections as {}, [] or left out alike", () => {
    const { scenario } = parsed("S1");
    const record = seeded.find((fixture) => fixture.id === "F40")!.record;
    const withConnections = (connections: unknown) => {
      const copy = JSON.parse(JSON.stringify(record)) as Json;
      if (connections === undefined) delete copy.connections;
      else copy.connections = connections;

      return parseCableRecord(copy, scenario);
    };

    const empty = { ok: true, value: { ...record, connections: {} } };

    expect(withConnections({})).toEqual(empty);
    expect(withConnections([])).toEqual(empty);
    expect(withConnections(undefined)).toEqual(empty);
  });

  it("keeps real connections, whatever order the keys come back in", () => {
    const { scenario } = parsed("S5");
    const record = seeded.find((fixture) => fixture.id === "F38")!.record;

    const result = parseCableRecord(reversedKeys(JSON.parse(JSON.stringify(record))), scenario);

    expect(result.ok && result.value.connections).toEqual({ A: "pc-2:eth0", B: "pc-1:eth0" });
    expect(result.ok && JSON.stringify(Object.keys(result.value))).toBe('["schema","ends","connections"]');
  });

  it("refuses a record that is not the frozen shape", () => {
    const { scenario } = parsed("S5");
    const record = () => JSON.parse(JSON.stringify(seeded.find((fixture) => fixture.id === "F27")!.record)) as Json;

    const cases: [(r: Json) => unknown, string][] = [
      [(r) => ((r.schema = "cable/2"), r), "schema"],
      [(r) => ((r.connections = [["A", "pc-1:eth0"]]), r), "connections"],
      [(r) => ((r.connections = { A: "pc-9:eth0" }), r), "connections.A"],
      [(r) => ((r.connections = { C: "pc-1:eth0" }), r), "connections.C"],
      [(r) => ((r.connections = { A: "pc-1:eth0", B: "pc-1:eth0" }), r), "ends"],
      [(r) => ((r.verdict = "crossover"), r), "verdict"],
      [(r) => ((r.ends.A.tip_mm.brown = 1.5), r), "ends.A.tip_mm.brown"],
      [() => "cable/1", ""],
    ];

    for (const [breakIt, path] of cases) {
      expect(errorPaths(parseCableRecord(breakIt(record()), scenario)), path).toContain(path);
    }
  });
});
