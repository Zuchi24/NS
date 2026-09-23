import { describe, expect, it } from "vitest";

import {
  AT_FRONT_TOLERANCE,
  CONTACT_LINE,
  FRONT_STOP,
  JACKET_STOP,
  MAX_STRIP_PASS,
  MAX_UNTWIST,
  MIN_BODY,
  MIN_ENGAGE,
  MIN_WORK,
  NATURAL_ORDER,
  PAIR_IDS,
  RELIEF_CLAMP,
  S1_PRACTICE,
  T568A,
  T568B,
  apply,
  createInitialState,
  inspect,
  jacketedLengthMm,
  linkState,
  makeEnd,
  pinsAt,
  standardOf,
  structuralSplitPairs,
  toRecord,
  wiremap,
} from "../model";
import type { Action, CableEnd, CableState, Conductor, EndId, EndInspection, Scenario } from "../model";
import contractText from "./cable-contract.v1.json?raw";
import docText from "./CABLE_CONTRACT.md?raw";

/**
 * The P3.1 contract, checked from the frontend side.
 *
 * cable-contract.v1.json is shared, byte for byte, with the backend's
 * tests/Fixtures/cable/. Its expectations were written by hand from the frozen
 * P0 specification; these tests hold them against the P1 model, so a wrong
 * fixture fails here rather than becoming the thing the PHP evaluator copies.
 *
 * Three small functions below — the record check, the requirement oracle and
 * the public projection — are an executable statement of the contract for
 * P3.2/P3.3 to match in PHP. They are test code, not a grader: the backend is
 * the only authority on grading, and nothing in the app imports them.
 */

/* ============================================================
   Pinned copies
   ============================================================ */

/** SHA-256 of each file with line endings normalised to LF. Update both repos together. */
const CONTRACT_SHA256 = "1833a029743fa3e3bbf01cdd9eef11f11b4eb5a00ddab4ac283cd241867af9b6";
const DOC_SHA256 = "7c7dc55bcd3239a9e2e8deee61a96103e1a11774d40d8894b860cd038113fccb";

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, "\n"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ============================================================
   Contract types (as much as these tests need)
   ============================================================ */

interface PlugRec {
  orientation: "contacts-up" | "contacts-down";
  jacket_in_mm: number;
  crimp: "none" | "partial" | "full";
}
interface EndRec {
  jacket_edge_mm: number;
  tip_mm: Record<Conductor, number>;
  fan: Conductor[] | null;
  plug: PlugRec | null;
  nicks_at_mm: number[];
}
interface Rec {
  schema: "cable/1";
  ends: Record<EndId, EndRec>;
  connections?: Partial<Record<EndId, string>> | [];
}
interface EndpointRule {
  id: string;
  kind: "tester-main" | "tester-remote" | "mdi" | "mdix";
  label?: string;
}
interface CableRule {
  type: "rj45_cable";
  scenario_id: string;
  start_length_mm: number;
  plugs: number;
  initial_ends: Record<EndId, EndRec>;
  endpoints: EndpointRule[];
  require: {
    ends: Record<EndId, "T568A" | "T568B"> | "each-standard" | null;
    cable: "straight" | "crossover" | null;
    min_length_mm: number | null;
    inspection: ("strain_relief" | "untwist" | "front" | "insulation")[];
    link: [string, string] | null;
  };
  assist?: { reference: Partial<Record<EndId, "T568A" | "T568B">> } | null;
}
type AnyRule = CableRule | { type: "rj45_order"; standard: string; cable: string };
interface RequirementEntry {
  id: string;
  requirement: string;
}
interface Expected {
  verdict: string;
  pattern: string | null;
  map: (number | null)[];
  opens: number[];
  split_pairs: [EndId, number, number][];
  inspection: Record<EndId, EndInspection>;
  jacketed_length_mm: number;
  requirements: { id: string; passed: boolean }[];
  canonical_record?: Rec;
}
interface Contract {
  version: string;
  schema: string;
  constants: Record<string, number>;
  conductors: Conductor[];
  standards: Record<"T568A" | "T568B", Conductor[]>;
  enums: Record<string, string[]>;
  requirement_order: string[];
  public_config_forbidden_keys: string[];
  rules: Record<string, AnyRule>;
  scenarios: Record<
    string,
    { seed: boolean; title: string; difficulty: string; title_frozen: boolean; rule: string; requirement_list: RequirementEntry[]; public_config: unknown }
  >;
  test_rules: Record<string, { requirement_list: RequirementEntry[] }>;
  record_fixtures: { id: string; title: string; rule: string; record: Rec; expected: Expected }[];
  evaluator_fixtures: {
    id: string;
    rule: string;
    rule_patch?: Partial<CableRule>;
    submission: Rec | Record<string, never>;
    expected: { requirements?: { id: string; passed: boolean }[]; same_as?: string };
  }[];
  request_fixtures: {
    id: string;
    rule: string;
    sides?: ("backend" | "frontend")[];
    body: Record<string, unknown>;
    expected: { status: 200 | 422; error_path?: string; canonical_record?: Rec };
  }[];
}

const contract = JSON.parse(contractText) as Contract;
const cableRule = (key: string) => contract.rules[key] as CableRule;
const requirementList = (key: string) => (contract.scenarios[key] ?? contract.test_rules[key]).requirement_list;

/* ============================================================
   Record ↔ model
   ============================================================ */

function toEnd(end: EndRec): CableEnd {
  return makeEnd({
    jacketEdgeMm: end.jacket_edge_mm,
    tipMm: { ...end.tip_mm },
    fan: end.fan,
    plug: end.plug ? { orientation: end.plug.orientation, jacketInMm: end.plug.jacket_in_mm, crimp: end.plug.crimp } : null,
    nicksAtMm: end.nicks_at_mm,
  });
}

function toState(record: Rec): CableState {
  const connections = Array.isArray(record.connections) ? {} : { ...(record.connections ?? {}) };

  return { ends: { A: toEnd(record.ends.A), B: toEnd(record.ends.B) }, tray: { plugs: 0 }, connections };
}

function toScenario(rule: CableRule): Scenario {
  return {
    id: rule.scenario_id,
    startLengthMm: rule.start_length_mm,
    plugs: rule.plugs,
    initialEnds: { A: toEnd(rule.initial_ends.A), B: toEnd(rule.initial_ends.B) },
    endpoints: rule.endpoints.map(({ id, kind }) => ({ id, kind })),
  };
}

/* ============================================================
   Reference: the requirement catalogue (P0 §5)
   ============================================================ */

function referenceRequirements(ruleKey: string, rule: CableRule, submission: Rec | Record<string, never>) {
  const list = requirementList(ruleKey);

  if (!("ends" in submission)) return list.map(({ id }) => ({ id, passed: false }));

  const state = toState(submission as Rec);
  const scenario = toScenario(rule);
  const report = wiremap(state);
  const inspection = inspect(state);
  const both = (key: keyof EndInspection) => inspection.A[key] && inspection.B[key];
  const plugged = state.ends.A.plug !== null && state.ends.B.plug !== null;
  const standards = { A: standardOf(pinsAt(state.ends.A)), B: standardOf(pinsAt(state.ends.B)) };
  const required = rule.require;

  const link = () => {
    if (!required.link) return false;
    const connected = [state.connections.A, state.connections.B].sort();
    const wanted = [...required.link].sort();
    const status = linkState(state, scenario);

    return connected[0] === wanted[0] && connected[1] === wanted[1] && status.connected && status.up;
  };

  const passed: Record<string, () => boolean> = {
    TERM: () => state.ends.A.plug?.crimp === "full" && state.ends.B.plug?.crimp === "full",
    CONT: () => report.verdict !== "incomplete" && report.opens.length === 0,
    PAIRS: () => plugged && structuralSplitPairs(state, "A").length === 0 && structuralSplitPairs(state, "B").length === 0,
    END_A: () => typeof required.ends === "object" && required.ends !== null && standards.A === required.ends.A,
    END_B: () => typeof required.ends === "object" && required.ends !== null && standards.B === required.ends.B,
    EACH_STD: () => standards.A !== null && standards.B !== null,
    CABLE: () => report.pattern === required.cable,
    RELIEF: () => both("jacketClamped"),
    UNTWIST: () => both("untwistOk"),
    FRONT: () => both("conductorsAtFront"),
    INSULATION: () => both("insulationIntact"),
    LENGTH: () => required.min_length_mm !== null && jacketedLengthMm(state, scenario) >= required.min_length_mm,
    LINK: link,
  };

  return list.map(({ id }) => ({ id, passed: passed[id]() }));
}

/* ============================================================
   Reference: the record check (I1–I13, P0 §6 as frozen)
   ============================================================ */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Every error path a record produces under an rj45_cable rule; empty means valid. */
function checkBody(rule: CableRule, body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const sub = body.submission;

  if (sub === undefined || (Array.isArray(sub) && sub.length === 0)) return ["submission"];
  if (!isObject(sub)) return ["submission"];

  for (const key of Object.keys(sub)) {
    if (!["schema", "ends", "connections"].includes(key)) errors.push(`submission.${key}`);
  }
  if (sub.schema !== "cable/1") errors.push("submission.schema");

  const ends = sub.ends;
  const validEnds: Partial<Record<EndId, EndRec>> = {};

  if (!isObject(ends)) {
    errors.push("submission.ends");
  } else {
    for (const key of Object.keys(ends)) if (key !== "A" && key !== "B") errors.push(`submission.ends.${key}`);
    for (const id of ["A", "B"] as const) {
      const at = `submission.ends.${id}`;
      const end = ends[id];
      if (!isObject(end)) {
        errors.push(at);
        continue;
      }
      const before = errors.length;
      checkEnd(end, at, errors);
      if (errors.length === before) validEnds[id] = end as unknown as EndRec;
    }
    if (validEnds.A && validEnds.B && validEnds.A.jacket_edge_mm + validEnds.B.jacket_edge_mm > rule.start_length_mm - MIN_BODY) {
      errors.push("submission.ends");
    }
  }

  const connections = sub.connections;
  if (connections === undefined) {
    if (rule.require.link) errors.push("submission.connections");
  } else if (Array.isArray(connections) && connections.length === 0) {
    // An empty JSON array reads as "no connections": PHP decodes [] and {} alike.
  } else if (!isObject(connections)) {
    errors.push("submission.connections");
  } else {
    const used: string[] = [];
    for (const [key, value] of Object.entries(connections)) {
      const at = `submission.connections.${key}`;
      if (key !== "A" && key !== "B") {
        errors.push(at);
        continue;
      }
      if (typeof value !== "string" || !rule.endpoints.some((e) => e.id === value)) {
        errors.push(at);
        continue;
      }
      if (isObject(ends) && isObject(ends[key]) && (ends[key] as Record<string, unknown>).plug === null) errors.push(at);
      used.push(value);
    }
    if (new Set(used).size !== used.length) errors.push("submission.connections");
  }

  return errors;
}

function checkEnd(end: Record<string, unknown>, at: string, errors: string[]) {
  const keys = ["jacket_edge_mm", "tip_mm", "fan", "plug", "nicks_at_mm"];
  for (const key of Object.keys(end)) if (!keys.includes(key)) errors.push(`${at}.${key}`);
  for (const key of keys) if (!(key in end)) errors.push(`${at}.${key}`);

  const J = end.jacket_edge_mm;
  if (!isInt(J) || J < 0) errors.push(`${at}.jacket_edge_mm`);

  const tips = end.tip_mm;
  let tipsValid = false;
  if (!isObject(tips)) {
    errors.push(`${at}.tip_mm`);
  } else {
    const before = errors.length;
    for (const key of Object.keys(tips)) if (!NATURAL_ORDER.includes(key as Conductor)) errors.push(`${at}.tip_mm.${key}`);
    for (const c of NATURAL_ORDER) {
      const T = tips[c];
      if (!isInt(T) || T < 0 || (isInt(J) && T > J)) errors.push(`${at}.tip_mm.${c}`);
    }
    tipsValid = errors.length === before && isInt(J);
  }

  const fan = end.fan;
  if (fan !== null) {
    if (!Array.isArray(fan) || fan.length !== 8 || new Set(fan).size !== 8 || !fan.every((c) => NATURAL_ORDER.includes(c))) {
      errors.push(`${at}.fan`);
    }
  }

  const plug = end.plug;
  if (plug !== null && plug !== undefined) {
    if (!isObject(plug)) {
      errors.push(`${at}.plug`);
    } else {
      for (const key of Object.keys(plug)) if (!["orientation", "jacket_in_mm", "crimp"].includes(key)) errors.push(`${at}.plug.${key}`);
      if (!contract.enums.orientation.includes(plug.orientation as string)) errors.push(`${at}.plug.orientation`);
      if (!contract.enums.crimp.includes(plug.crimp as string)) errors.push(`${at}.plug.crimp`);
      if (!isInt(plug.jacket_in_mm)) {
        errors.push(`${at}.plug.jacket_in_mm`);
      } else if (tipsValid) {
        const maxX = Math.max(...NATURAL_ORDER.map((c) => (J as number) - (tips as Record<string, number>)[c]));
        const lo = MIN_ENGAGE - maxX;
        const hi = Math.min(JACKET_STOP, FRONT_STOP - maxX);
        if (plug.jacket_in_mm < lo || plug.jacket_in_mm > hi) errors.push(`${at}.plug.jacket_in_mm`);
      }
      if (fan === null) errors.push(`${at}.plug`);
    }
  }

  const nicks = end.nicks_at_mm;
  if (!Array.isArray(nicks)) {
    errors.push(`${at}.nicks_at_mm`);
  } else if (isInt(J) && nicks.length > J + 1) {
    errors.push(`${at}.nicks_at_mm`); // size guard, before any per-item work
  } else {
    nicks.forEach((n, index) => {
      if (!isInt(n) || n < 0 || (isInt(J) && n > J)) errors.push(`${at}.nicks_at_mm.${index}`);
    });
    if (new Set(nicks).size !== nicks.length) errors.push(`${at}.nicks_at_mm`);
  }
}

/* ============================================================
   Reference: the public projection
   ============================================================ */

function project(rule: CableRule) {
  return {
    model: "physical",
    scenario: {
      id: rule.scenario_id,
      start_length_mm: rule.start_length_mm,
      plugs: rule.plugs,
      initial_ends: rule.initial_ends,
      endpoints: rule.endpoints,
      objectives: {
        min_length_mm: rule.require.min_length_mm,
        inspection: rule.require.inspection,
        link: rule.require.link,
      },
    },
    assist: rule.assist ?? null,
  };
}

function keysDeep(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, into));
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) (into.push(k), keysDeep(v, into));

  return into;
}

/* ============================================================
   TESTS
   ============================================================ */

describe("the pinned contract", () => {
  it("is the agreed version, and the backend holds the same bytes", async () => {
    expect(contract.version).toBe("1.1.0");
    expect(contract.schema).toBe("cable/1");
    expect(await sha256(contractText)).toBe(CONTRACT_SHA256);
    expect(await sha256(docText)).toBe(DOC_SHA256);
  });

  it("the document names the version and every requirement", () => {
    expect(docText).toContain("Contract version: **1.1.0**");
    for (const id of contract.requirement_order) expect(docText).toContain(`\`${id}\``);
  });

  it("matches the P1 model's constants, conductors and standards", () => {
    expect(contract.constants).toEqual({
      FRONT_STOP, CONTACT_LINE, JACKET_STOP, RELIEF_CLAMP, MAX_UNTWIST, MIN_WORK, MIN_BODY, MAX_STRIP_PASS, AT_FRONT_TOLERANCE, MIN_ENGAGE,
    });
    expect(contract.conductors).toEqual([...NATURAL_ORDER]);
    expect(contract.standards).toEqual({ T568A: [...T568A], T568B: [...T568B] });
  });
});

describe("scenarios", () => {
  it("seeds every scenario from 1.1.0, S4 included; has no S3", () => {
    const seeded = Object.entries(contract.scenarios).filter(([, s]) => s.seed).map(([key]) => key);

    expect(seeded).toEqual(["S1", "S2", "S5", "S4", "S6", "S7", "S8", "S9"]);
    expect(contract.scenarios.S3).toBeUndefined();
    expect(contract.rules.S3).toBeUndefined();
  });

  it("keeps S1's existing title and difficulty", () => {
    expect(contract.scenarios.S1).toMatchObject({ title: "Terminate a straight-through cable", difficulty: "beginner", title_frozen: true });
    expect(contract.scenarios.S2.difficulty).toBe("intermediate");
    expect(contract.scenarios.S5.difficulty).toBe("advanced");
    expect(contract.scenarios.S4.difficulty).toBe("intermediate");
    expect(contract.scenarios.S6.difficulty).toBe("intermediate");
    expect(contract.scenarios.S7.difficulty).toBe("intermediate");
    expect(contract.scenarios.S8.difficulty).toBe("advanced");
    expect(contract.scenarios.S9.difficulty).toBe("advanced");
    for (const key of ["S2", "S4", "S5", "S6", "S7", "S8", "S9"]) expect(contract.scenarios[key].title_frozen).toBe(false);
  });

  it("describes S1 exactly as the frontend's practice S1", () => {
    const rule = cableRule("S1");
    const scenario = toScenario(rule);

    expect(scenario.startLengthMm).toBe(S1_PRACTICE.startLengthMm);
    expect(scenario.plugs).toBe(S1_PRACTICE.plugs);
    expect(scenario.endpoints).toEqual(S1_PRACTICE.endpoints);
    expect(scenario.initialEnds).toEqual(S1_PRACTICE.initialEnds);
    expect(rule.require.ends).toEqual(S1_PRACTICE.require.ends);
    expect(contract.scenarios.S1.title).toBe(S1_PRACTICE.title);
  });

  it("gives S2 and S5 their frozen requirements, in the frozen order", () => {
    const ids = (key: string) => requirementList(key).map((r) => r.id);

    expect(ids("S1")).toEqual(["TERM", "CONT", "PAIRS", "END_A", "END_B"]);
    expect(ids("S2")).toEqual(["TERM", "CONT", "PAIRS", "END_A", "END_B", "RELIEF", "UNTWIST", "LENGTH"]);
    expect(ids("S5")).toEqual(["TERM", "CONT", "PAIRS", "EACH_STD", "CABLE", "RELIEF", "UNTWIST", "FRONT", "INSULATION", "LINK"]);
    expect(cableRule("S5").require.cable).toBe("crossover");
    expect(ids("S6")).toEqual(["TERM", "CONT", "PAIRS", "EACH_STD", "CABLE", "RELIEF", "UNTWIST"]);
    expect(ids("S7")).toEqual(["TERM", "CONT", "PAIRS", "EACH_STD", "CABLE", "RELIEF", "UNTWIST"]);
    expect(ids("S8")).toEqual(["TERM", "CONT", "PAIRS", "EACH_STD", "CABLE", "RELIEF", "UNTWIST", "FRONT", "INSULATION", "LINK"]);
    expect(ids("S9")).toEqual(["TERM", "CONT", "PAIRS", "EACH_STD", "RELIEF", "UNTWIST", "FRONT", "INSULATION", "LINK"]);
    expect(cableRule("S6").require.cable).toBe("straight");
    expect(cableRule("S7").require.cable).toBe("crossover");
    expect(cableRule("S8").require.cable).toBe("straight");
    // S7 grades the pattern, never which end holds which standard: the mirror crossover passes too.
    expect(cableRule("S7").require.ends).toBe("each-standard");

    for (const key of [...Object.keys(contract.scenarios), ...Object.keys(contract.test_rules)]) {
      const order = requirementList(key).map((r) => contract.requirement_order.indexOf(r.id));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });

  it("builds every scenario's starting ends as valid model states", () => {
    for (const key of Object.keys(contract.scenarios)) {
      const rule = cableRule(key);
      const body = { submission: { schema: "cable/1", ends: rule.initial_ends, connections: {} } };

      expect(checkBody({ ...rule, require: { ...rule.require, link: null } }, body), key).toEqual([]);
    }
  });
});

describe("public configuration", () => {
  const scenarioKeys = Object.keys(contract.scenarios);

  it.each(scenarioKeys)("%s projects to exactly the frozen public config", (key) => {
    expect(project(cableRule(key))).toEqual(contract.scenarios[key].public_config);
  });

  it.each(scenarioKeys)("%s's public config carries no grading configuration", (key) => {
    const keys = keysDeep(contract.scenarios[key].public_config);

    for (const forbidden of contract.public_config_forbidden_keys) expect(keys, forbidden).not.toContain(forbidden);
  });

  it("exposes assist.reference for S1 only, as a map of end to standard", () => {
    expect((contract.scenarios.S1.public_config as { assist: unknown }).assist).toEqual({ reference: { A: "T568B", B: "T568B" } });
    for (const key of scenarioKeys.filter((key) => key !== "S1")) {
      expect((contract.scenarios[key].public_config as { assist: unknown }).assist).toBeNull();
    }
  });

  // S7 is left out on purpose: its objective is to build a crossover, so saying so hides nothing.
  it.each(["S5", "S6", "S8", "S9"])("hides %s's required cable: nothing public says crossover or straight", (key) => {
    expect(JSON.stringify(contract.scenarios[key].public_config)).not.toMatch(/crossover|straight/);
  });

  it("gives S8 and S9 a PC on an MDI port and a switch on an MDIX port, by label", () => {
    for (const key of ["S8", "S9"]) {
      expect(cableRule(key).endpoints.filter((e) => e.kind === "mdi" || e.kind === "mdix")).toEqual([
        { id: "pc-1:eth0", kind: "mdi", label: "PC-1" },
        { id: "sw-1:port1", kind: "mdix", label: "Switch-1" },
      ]);
    }
  });
});

describe("record fixtures", () => {
  it("keeps every frozen fixture, adds only new ids, and leaves F22 and F29 out", () => {
    const ids = contract.record_fixtures.map((f) => f.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10", "F11", "F12", "F13", "F14", "F15", "F16", "F17",
      "F18", "F19", "F20", "F21", "F23", "F24", "F25", "F27", "F28", "F30", "F31", "F31b", "F32", "F32b", "F33", "F33b", "F34", "F35",
      "F36", "F37", "F38", "F39", "F40",
      // 1.1.0: S4 and S6–S9.
      "F41", "F42", "F43", "F44", "F45", "F46", "F47", "F48", "F49", "F50", "F51",
      "F52", "F53", "F54", "F55", "F56", "F57", "F58", "F59", "F60", "F61", "F62",
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain("F22"); // SHORT: deferred (B4)
    expect(ids).not.toContain("F29"); // legacy rj45_order: covered by the existing backend tests
    expect(contract.evaluator_fixtures.map((f) => f.id)).toContain("F26");
  });

  describe.each(contract.record_fixtures.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const rule = cableRule(fixture.rule);
    const state = toState(fixture.record);
    const report = wiremap(state);

    it("is a valid cable/1 record under its rule", () => {
      expect(checkBody(rule, { submission: fixture.record })).toEqual([]);
    });

    it("has the electrical result the model derives", () => {
      expect({
        verdict: report.verdict,
        pattern: report.pattern,
        map: report.map,
        opens: report.opens,
        split_pairs: report.splitPairs.map((s) => [s.end, s.pins[0], s.pins[1]]),
      }).toEqual({
        verdict: fixture.expected.verdict,
        pattern: fixture.expected.pattern,
        map: fixture.expected.map,
        opens: fixture.expected.opens,
        split_pairs: fixture.expected.split_pairs,
      });
    });

    it("has the inspection and graded length the model derives", () => {
      expect(inspect(state)).toEqual(fixture.expected.inspection);
      expect(jacketedLengthMm(state, toScenario(rule))).toBe(fixture.expected.jacketed_length_mm);
    });

    it("has the requirement results the catalogue gives", () => {
      expect(referenceRequirements(fixture.rule, rule, fixture.record)).toEqual(fixture.expected.requirements);
    });

    it("stores as the canonical record", () => {
      expect(toRecord(state)).toEqual(fixture.expected.canonical_record ?? { ...fixture.record, connections: fixture.record.connections ?? {} });
    });
  });
});

describe("evaluator fixtures", () => {
  it.each(contract.evaluator_fixtures.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const rule = { ...cableRule(fixture.rule), ...(fixture.rule_patch ?? {}) } as CableRule;
    const got = referenceRequirements(fixture.rule, rule, fixture.submission);

    if (fixture.expected.same_as) {
      const reference = contract.record_fixtures.find((f) => f.id === fixture.expected.same_as)!;
      expect(got).toEqual(reference.expected.requirements);
    } else {
      expect(got).toEqual(fixture.expected.requirements);
      expect(got.every((r) => !r.passed)).toBe(true);
    }
  });

  it("assist.reference is never read when grading: requirement wording follows require, not assist", () => {
    const patched = contract.evaluator_fixtures.find((f) => f.id === "INV-1")!;

    expect(patched.rule_patch?.assist?.reference).toEqual({ A: "T568A", B: "T568A" });
    expect(requirementList("S1").find((r) => r.id === "END_A")!.requirement).toBe("End A is wired to T568B");
  });
});

describe("request fixtures", () => {
  const cable = contract.request_fixtures.filter((f) => contract.rules[f.rule].type === "rj45_cable" && (f.sides ?? ["backend", "frontend"]).includes("frontend"));

  it.each(cable.filter((f) => f.expected.status === 200).map((f) => [f.id, f] as const))("%s is accepted", (_id, fixture) => {
    expect(checkBody(cableRule(fixture.rule), fixture.body)).toEqual([]);

    if (fixture.expected.canonical_record) {
      const submission = fixture.body.submission as Rec;
      expect(toRecord(toState(submission))).toEqual(fixture.expected.canonical_record);
    }
  });

  it.each(cable.filter((f) => f.expected.status === 422).map((f) => [f.id, f] as const))("%s is rejected at its path", (_id, fixture) => {
    expect(checkBody(cableRule(fixture.rule), fixture.body)).toContain(fixture.expected.error_path);
  });

  it("marks backend-only fixtures (the legacy rule) as such", () => {
    const legacy = contract.request_fixtures.filter((f) => contract.rules[f.rule].type === "rj45_order");

    expect(legacy.map((f) => f.id)).toEqual(["R02b"]);
    expect(legacy[0].sides).toEqual(["backend"]);
  });

  it("covers every frozen invariant I1–I13 (I5 removed) with at least one rejection", () => {
    const ids = contract.request_fixtures.map((f) => f.id);

    for (const prefix of ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13"]) {
      expect(ids.some((id) => id.startsWith(prefix)), prefix).toBe(true);
    }
  });
});

describe("the bench produces contract records", () => {
  it("S1 played through on the model hands in exactly F40's record, and it is valid", () => {
    const actions: Action[] = [
      { type: "strip", end: "A", amountMm: 30, slot: "correct" },
      ...PAIR_IDS.map((pair): Action => ({ type: "untwist", end: "A", pair })),
      { type: "moveConductor", end: "A", conductor: "blue", toIndex: 3 },
      { type: "moveConductor", end: "A", conductor: "green", toIndex: 5 },
      { type: "trim", end: "A", leaveMm: 12 },
      { type: "insert", end: "A", orientation: "contacts-up", pushMm: 10 },
      { type: "crimp", end: "A", squeeze: "full" },
    ];
    const done = actions.reduce((state, action) => {
      const result = apply(state, action, S1_PRACTICE);
      if ("rejected" in result) throw new Error(result.rejected);

      return result.state;
    }, createInitialState(S1_PRACTICE));

    const record = toRecord(done);
    const f40 = contract.record_fixtures.find((f) => f.id === "F40")!;

    expect(record).toEqual(f40.record);
    expect(checkBody(cableRule("S1"), { submission: record })).toEqual([]);
  });

  it("the untouched S1 bench hands in F39's record", () => {
    const f39 = contract.record_fixtures.find((f) => f.id === "F39")!;

    expect(toRecord(createInitialState(S1_PRACTICE))).toEqual(f39.record);
  });
});

/*
 * 1.1.0's scenarios, played through on the model.
 *
 * Every pass fixture added in 1.1.0 has to be reachable by the bench, not merely
 * a record that happens to grade. So each is rebuilt here from the scenario's
 * starting state through apply() alone — the only way the bench changes a cable —
 * and has to come out as exactly the fixture's record.
 */
describe("1.1.0 scenarios are achievable on the model", () => {
  /** Strip, untwist all four pairs, arrange into the standard, trim, seat and crimp one end. */
  function terminate(end: EndId, standard: readonly Conductor[], opts: { cutAtMm?: number; stripMm?: number } = {}): Action[] {
    const actions: Action[] = [];
    if (opts.cutAtMm !== undefined) actions.push({ type: "cut", end, atMm: opts.cutAtMm });
    actions.push({ type: "strip", end, amountMm: opts.stripMm ?? 30, slot: "correct" });
    actions.push(...PAIR_IDS.map((pair): Action => ({ type: "untwist", end, pair })));

    let row: Conductor[] = [...NATURAL_ORDER];
    standard.forEach((conductor, index) => {
      if (row.indexOf(conductor) === index) return;
      actions.push({ type: "moveConductor", end, conductor, toIndex: index });
      row = row.filter((c) => c !== conductor);
      row.splice(index, 0, conductor);
    });

    actions.push({ type: "trim", end, leaveMm: 12 });
    actions.push({ type: "insert", end, orientation: "contacts-up", pushMm: 10 });
    actions.push({ type: "crimp", end, squeeze: "full" });

    return actions;
  }

  function play(key: string, actions: Action[]): CableState {
    const scenario = toScenario(cableRule(key));

    return actions.reduce((state, action) => {
      const result = apply(state, action, scenario);
      if ("rejected" in result) throw new Error(`${key}: ${action.type} refused (${result.rejected})`);

      return result.state;
    }, createInitialState(scenario));
  }

  const plugInto = (a: string, b: string): Action[] => [
    { type: "connect", end: "A", endpoint: a },
    { type: "connect", end: "B", endpoint: b },
  ];
  const fixture = (id: string) => contract.record_fixtures.find((f) => f.id === id)!;
  // Cutting behind a factory plug starts at its rear, J + jacket_in = 12 + 9.
  const repair = { cutAtMm: 21, stripMm: 20 };

  it.each([
    ["F41", "S6", () => terminate("A", T568A)],
    ["F44", "S7", () => [...terminate("A", T568A), ...terminate("B", T568B)]],
    ["F45", "S7", () => [...terminate("A", T568B), ...terminate("B", T568A)]],
    ["F48", "S8", () => [...terminate("A", T568B), ...terminate("B", T568B), ...plugInto("pc-1:eth0", "sw-1:port1")]],
    ["F54", "S4", () => terminate("B", T568B, repair)],
    ["F59", "S9", () => [...terminate("B", T568A, repair), ...plugInto("pc-1:eth0", "sw-1:port1")]],
    ["F60", "S9", () => [...terminate("A", T568B, repair), ...plugInto("pc-1:eth0", "sw-1:port1")]],
  ] as const)("%s (%s) is what the bench hands in, and it passes", (id, key, actions) => {
    const record = toRecord(play(key, actions()));

    expect(record).toEqual(fixture(id).record);
    expect(checkBody(cableRule(key), { submission: record })).toEqual([]);
    expect(fixture(id).expected.requirements.every((r) => r.passed)).toBe(true);
  });

  it("S4's budget allows re-making one end, but not both", () => {
    expect(() => play("S4", [...terminate("A", T568B, repair), ...terminate("B", T568B, repair)])).not.toThrow();
    expect(jacketedLengthMm(play("S4", terminate("B", T568B, repair)), toScenario(cableRule("S4")))).toBe(947);
    expect(
      jacketedLengthMm(play("S4", [...terminate("A", T568B, repair), ...terminate("B", T568B, repair)]), toScenario(cableRule("S4"))),
    ).toBeLessThan(cableRule("S4").require.min_length_mm!);
  });

  it("S9's single plug allows re-making one end only", () => {
    expect(() => play("S9", [...terminate("A", T568B, repair), ...terminate("B", T568A, repair)])).toThrow(/tray-empty/);
  });

  it("the untouched S4 and S9 benches are the failing fixtures F53 and F58", () => {
    expect(toRecord(play("S4", []))).toEqual(fixture("F53").record);
    expect(toRecord(play("S9", plugInto("pc-1:eth0", "sw-1:port1")))).toEqual(fixture("F58").record);
  });
});
