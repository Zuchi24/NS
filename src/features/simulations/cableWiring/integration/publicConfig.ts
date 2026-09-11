import {
  END_IDS,
  NATURAL_ORDER,
  invariantViolations,
  makeEnd,
  toRecord,
} from "../model";
import type {
  CableEnd,
  CableRecord,
  CableState,
  Conductor,
  Crimp,
  EndId,
  Endpoint,
  EndpointId,
  EndpointKind,
  InspectionCheck,
  Orientation,
  Scenario,
  Standard,
} from "../model";

/**
 * Reads a physical cable challenge's public configuration — the challenge's
 * `config` when its rule is `rj45_cable` — into what the bench runs on.
 *
 * The shape is the frozen contract's (cable-contract.v1.json, version 1.0.0,
 * §8): the physical facts of the bench, the objectives a student is told, and
 * optional beginner help. Nothing here grades, and nothing here needs the
 * private rule: the standards and cable a challenge is marked on never reach
 * the browser, and a config that carries them is refused rather than used.
 *
 * Parsing is strict. Every key must be one the contract names, every value
 * must have the right type, and the starting ends must be physically possible
 * under the model's own invariants. A config that fails any of that is
 * reported, path by path, instead of being patched into something runnable.
 *
 * Pure: no network, no storage, no React, no mutation of the input.
 */

/** An endpoint as the public config names it. `label` is display text only. */
export interface PhysicalEndpoint extends Endpoint {
  label?: string;
}

/** The scenario the model and bench run on — the P1 `Scenario`, with endpoint labels kept. */
export interface PhysicalScenario extends Scenario {
  endpoints: PhysicalEndpoint[];
}

/** What the student is told the task involves. Configuration for the page; the server grades. */
export interface PhysicalObjectives {
  minLengthMm: number | null;
  inspection: InspectionCheck[];
  link: [EndpointId, EndpointId] | null;
}

/** Beginner help: the colour-order card to show beside each end. Never a grading input. */
export interface PhysicalAssist {
  reference: Partial<Record<EndId, Standard>>;
}

export interface PhysicalChallengeConfig {
  scenario: PhysicalScenario;
  objectives: PhysicalObjectives;
  assist: PhysicalAssist | null;
}

export interface ParseError {
  /** Where in the input, dot-separated from its root: `scenario.initial_ends.A.tip_mm.brown`. */
  path: string;
  message: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ParseError[] };

/**
 * Keys that belong to the private grading rule. They must never appear in a
 * public config (contract §8); one that does is refused, never read.
 */
export const PRIVATE_CONFIG_KEYS = ["require", "ends", "cable", "requirements", "validation_rules", "describe", "expected"] as const;

const ORIENTATIONS: readonly Orientation[] = ["contacts-up", "contacts-down"];
const CRIMPS: readonly Crimp[] = ["none", "partial", "full"];
const ENDPOINT_KINDS: readonly EndpointKind[] = ["tester-main", "tester-remote", "mdi", "mdix"];
const INSPECTION_CHECKS: readonly InspectionCheck[] = ["strain_relief", "untwist", "front", "insulation"];
const STANDARDS: readonly Standard[] = ["T568A", "T568B"];

/**
 * Whether a challenge config is for the physical bench. The contract's
 * discriminator: a config without `"model": "physical"` is the legacy
 * `{ standard, cable }` one. Says nothing about whether it is well formed.
 */
export function isPhysicalConfig(config: unknown): boolean {
  return isObject(config) && config.model === "physical";
}

/** Parse a physical challenge's public config. */
export function parsePhysicalChallengeConfig(input: unknown): ParseResult<PhysicalChallengeConfig> {
  const errors = new Errors();

  if (!isObject(input)) {
    errors.add("", "The config must be an object.");

    return errors.result();
  }

  // Refused by name first, wherever they are, so the message says why.
  for (const path of privateKeyPaths(input)) {
    errors.add(path, "This is private grading configuration and must never be sent to the browser.");
  }

  onlyKeys(input, ["model", "scenario", "assist"], "", errors);

  if (input.model !== "physical") errors.add("model", 'Must be "physical".');

  const scenario = parseScenario(input.scenario, errors);
  const objectives = isObject(input.scenario) ? parseObjectives(input.scenario.objectives, scenario?.endpoints ?? null, errors) : null;
  const assist = parseAssist(input, errors);

  if (errors.any() || scenario === null || objectives === null || assist === undefined) return errors.result();

  return { ok: true, value: { scenario, objectives, assist } };
}

/**
 * Parse a stored cable/1 record — a submission as the server hands it back —
 * against the scenario it was made in.
 *
 * Key order is not relied on anywhere (a MySQL JSON column reorders keys), and
 * empty connections may arrive as `{}` or `[]` (PHP encodes an empty array
 * either way); both read as no connections. The result is the record in the
 * model's own canonical form.
 */
export function parseCableRecord(input: unknown, scenario: Scenario): ParseResult<CableRecord> {
  const errors = new Errors();

  if (!isObject(input)) {
    errors.add("", "The record must be an object.");

    return errors.result();
  }

  onlyKeys(input, ["schema", "ends", "connections"], "", errors);
  if (input.schema !== "cable/1") errors.add("schema", 'Must be "cable/1".');

  const ends = parseEnds(input.ends, "ends", errors);
  const connections: CableState["connections"] = {};
  const given = input.connections;

  if (given !== undefined && !(Array.isArray(given) && given.length === 0)) {
    if (!isObject(given)) {
      errors.add("connections", "Must be an object giving where each end is plugged in.");
    } else {
      onlyKeys(given, END_IDS, "connections", errors);

      for (const id of END_IDS) {
        const endpoint = given[id];
        if (endpoint === undefined) continue;

        if (typeof endpoint !== "string" || !scenario.endpoints.some((candidate) => candidate.id === endpoint)) {
          errors.add(`connections.${id}`, "Not a port in this scenario.");
        } else {
          connections[id] = endpoint;
        }
      }
    }
  }

  if (errors.any() || ends === null) return errors.result();

  const state: CableState = { ends, tray: { plugs: 0 }, connections };
  for (const problem of invariantViolations(state, scenario)) errors.add("ends", problem);

  return errors.any() ? errors.result() : { ok: true, value: toRecord(state) };
}

/* ------------------------------------------------------------
   The scenario
   ------------------------------------------------------------ */

function parseScenario(input: unknown, errors: Errors): PhysicalScenario | null {
  if (!isObject(input)) {
    errors.add("scenario", "Must be an object.");

    return null;
  }

  const at = "scenario";
  onlyKeys(input, ["id", "start_length_mm", "plugs", "initial_ends", "endpoints", "objectives"], at, errors);

  const before = errors.count();

  if (typeof input.id !== "string" || input.id === "") errors.add(`${at}.id`, "Must be a non-empty string.");
  if (!isInt(input.start_length_mm) || input.start_length_mm <= 0) {
    errors.add(`${at}.start_length_mm`, "Must be a whole number of millimetres, more than 0.");
  }
  if (!isInt(input.plugs) || input.plugs < 0) errors.add(`${at}.plugs`, "Must be a whole number, 0 or more.");

  const initialEnds = parseEnds(input.initial_ends, `${at}.initial_ends`, errors);
  const endpoints = parseEndpoints(input.endpoints, errors);

  if (errors.count() !== before || initialEnds === null || endpoints === null) return null;

  const scenario: PhysicalScenario = {
    id: input.id as string,
    startLengthMm: input.start_length_mm as number,
    plugs: input.plugs as number,
    initialEnds,
    endpoints,
  };

  // The starting ends must be a state the model could be in.
  const start: CableState = { ends: initialEnds, tray: { plugs: scenario.plugs }, connections: {} };
  for (const problem of invariantViolations(start, scenario)) errors.add(`${at}.initial_ends`, problem);

  return errors.count() === before ? scenario : null;
}

function parseEndpoints(input: unknown, errors: Errors): PhysicalEndpoint[] | null {
  const at = "scenario.endpoints";

  if (!Array.isArray(input) || input.length === 0) {
    errors.add(at, "Must be a non-empty list of endpoints.");

    return null;
  }

  const before = errors.count();
  const endpoints: PhysicalEndpoint[] = [];

  input.forEach((endpoint: unknown, index) => {
    const here = `${at}.${index}`;

    if (!isObject(endpoint)) {
      errors.add(here, "Must be an object.");

      return;
    }

    onlyKeys(endpoint, ["id", "kind", "label"], here, errors);

    const { id, kind, label } = endpoint;
    const valid =
      typeof id === "string" &&
      id !== "" &&
      ENDPOINT_KINDS.includes(kind as EndpointKind) &&
      (label === undefined || (typeof label === "string" && label !== ""));

    if (typeof id !== "string" || id === "") errors.add(`${here}.id`, "Must be a non-empty string.");
    if (!ENDPOINT_KINDS.includes(kind as EndpointKind)) errors.add(`${here}.kind`, `Must be one of ${ENDPOINT_KINDS.join(", ")}.`);
    if (label !== undefined && (typeof label !== "string" || label === "")) errors.add(`${here}.label`, "Must be a non-empty string.");

    if (!valid) return;
    if (endpoints.some((seen) => seen.id === id)) {
      errors.add(`${here}.id`, "Another endpoint already has this id.");

      return;
    }

    endpoints.push(label === undefined ? { id: id as string, kind: kind as EndpointKind } : { id: id as string, kind: kind as EndpointKind, label: label as string });
  });

  return errors.count() === before ? endpoints : null;
}

function parseObjectives(input: unknown, endpoints: PhysicalEndpoint[] | null, errors: Errors): PhysicalObjectives | null {
  const at = "scenario.objectives";

  if (!isObject(input)) {
    errors.add(at, "Must be an object.");

    return null;
  }

  onlyKeys(input, ["min_length_mm", "inspection", "link"], at, errors);

  const before = errors.count();
  const { min_length_mm: minLength, inspection, link } = input;

  if (minLength !== null && (!isInt(minLength) || minLength <= 0)) {
    errors.add(`${at}.min_length_mm`, "Must be null or a whole number of millimetres, more than 0.");
  }

  if (
    !Array.isArray(inspection) ||
    !inspection.every((check) => INSPECTION_CHECKS.includes(check as InspectionCheck)) ||
    new Set(inspection).size !== inspection.length
  ) {
    errors.add(`${at}.inspection`, `Must be a list of distinct checks from ${INSPECTION_CHECKS.join(", ")}.`);
  }

  if (link !== null) {
    const ids = endpoints?.map((endpoint) => endpoint.id) ?? [];

    if (
      !Array.isArray(link) ||
      link.length !== 2 ||
      link[0] === link[1] ||
      !link.every((id) => typeof id === "string" && (endpoints === null || ids.includes(id)))
    ) {
      errors.add(`${at}.link`, "Must be null or two different endpoints of this scenario.");
    }
  }

  if (errors.count() !== before) return null;

  return {
    minLengthMm: minLength as number | null,
    inspection: [...(inspection as InspectionCheck[])],
    link: link === null ? null : [(link as string[])[0], (link as string[])[1]],
  };
}

/** The config's `assist`: null, or a reference card per end. Undefined when malformed. */
function parseAssist(config: Record<string, unknown>, errors: Errors): PhysicalAssist | null | undefined {
  if (!("assist" in config)) {
    errors.add("assist", "Required: null, or beginner help.");

    return undefined;
  }

  const assist = config.assist;
  if (assist === null) return null;

  if (!isObject(assist)) {
    errors.add("assist", "Must be null or an object.");

    return undefined;
  }

  onlyKeys(assist, ["reference"], "assist", errors);

  const reference = assist.reference;
  if (!isObject(reference)) {
    errors.add("assist.reference", "Must be an object naming a standard per end.");

    return undefined;
  }

  const before = errors.count();
  onlyKeys(reference, END_IDS, "assist.reference", errors);

  const parsed: Partial<Record<EndId, Standard>> = {};
  for (const id of END_IDS) {
    const standard = reference[id];
    if (standard === undefined) continue;

    if (!STANDARDS.includes(standard as Standard)) errors.add(`assist.reference.${id}`, `Must be one of ${STANDARDS.join(", ")}.`);
    else parsed[id] = standard as Standard;
  }

  return errors.count() === before ? { reference: parsed } : undefined;
}

/* ------------------------------------------------------------
   Ends, in the record's shape
   ------------------------------------------------------------ */

function parseEnds(input: unknown, at: string, errors: Errors): Record<EndId, CableEnd> | null {
  if (!isObject(input)) {
    errors.add(at, "Must be an object with ends A and B.");

    return null;
  }

  onlyKeys(input, END_IDS, at, errors);

  const a = parseEnd(input.A, `${at}.A`, errors);
  const b = parseEnd(input.B, `${at}.B`, errors);

  return a && b ? { A: a, B: b } : null;
}

/**
 * One end in the record's shape, checked for type and made into a model end.
 * Physical bounds are the model's `invariantViolations`, run on the whole state.
 */
function parseEnd(input: unknown, at: string, errors: Errors): CableEnd | null {
  if (!isObject(input)) {
    errors.add(at, "Must be an object.");

    return null;
  }

  const before = errors.count();
  onlyKeys(input, ["jacket_edge_mm", "tip_mm", "fan", "plug", "nicks_at_mm"], at, errors);

  const { jacket_edge_mm: jacket, tip_mm: tips, fan, plug, nicks_at_mm: nicks } = input;

  if (!isInt(jacket) || jacket < 0) errors.add(`${at}.jacket_edge_mm`, "Must be a whole number of millimetres, 0 or more.");

  if (!isObject(tips)) {
    errors.add(`${at}.tip_mm`, "Must be an object giving each of the eight conductors.");
  } else {
    onlyKeys(tips, NATURAL_ORDER, `${at}.tip_mm`, errors);
    for (const conductor of NATURAL_ORDER) {
      if (!isInt(tips[conductor])) errors.add(`${at}.tip_mm.${conductor}`, "Must be a whole number of millimetres.");
    }
  }

  if (fan !== null && (!Array.isArray(fan) || !fan.every((c) => NATURAL_ORDER.includes(c as Conductor)))) {
    errors.add(`${at}.fan`, "Must be null or a list of the eight conductors.");
  }

  if (plug !== null) {
    if (!isObject(plug)) {
      errors.add(`${at}.plug`, "Must be null or a plug.");
    } else {
      onlyKeys(plug, ["orientation", "jacket_in_mm", "crimp"], `${at}.plug`, errors);
      if (!ORIENTATIONS.includes(plug.orientation as Orientation)) errors.add(`${at}.plug.orientation`, `Must be one of ${ORIENTATIONS.join(", ")}.`);
      if (!isInt(plug.jacket_in_mm)) errors.add(`${at}.plug.jacket_in_mm`, "Must be a whole number of millimetres.");
      if (!CRIMPS.includes(plug.crimp as Crimp)) errors.add(`${at}.plug.crimp`, `Must be one of ${CRIMPS.join(", ")}.`);
    }
  }

  if (!Array.isArray(nicks) || !nicks.every(isInt)) errors.add(`${at}.nicks_at_mm`, "Must be a list of whole numbers of millimetres.");

  if (errors.count() !== before) return null;

  const record = input as {
    jacket_edge_mm: number;
    tip_mm: Record<Conductor, number>;
    fan: Conductor[] | null;
    plug: { orientation: Orientation; jacket_in_mm: number; crimp: Crimp } | null;
    nicks_at_mm: number[];
  };

  // makeEnd copies every array and object, so the input is never shared or
  // changed. It also sets the model-only `untwisted`: a fan means every pair
  // has been untwisted, which is the model's own rule, not a default.
  return makeEnd({
    jacketEdgeMm: record.jacket_edge_mm,
    tipMm: Object.fromEntries(NATURAL_ORDER.map((c) => [c, record.tip_mm[c]])) as Record<Conductor, number>,
    fan: record.fan,
    plug: record.plug && { orientation: record.plug.orientation, jacketInMm: record.plug.jacket_in_mm, crimp: record.plug.crimp },
    nicksAtMm: record.nicks_at_mm,
  });
}

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */

class Errors {
  private readonly list: ParseError[] = [];

  add(path: string, message: string) {
    if (!this.list.some((error) => error.path === path && error.message === message)) this.list.push({ path, message });
  }

  count() {
    return this.list.length;
  }

  any() {
    return this.list.length > 0;
  }

  result(): { ok: false; errors: ParseError[] } {
    return { ok: false, errors: [...this.list] };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** Report every key the contract does not name at this level. */
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], at: string, errors: Errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.add(join(at, key), "Not a field the contract names here.");
  }
}

/** Every path, at any depth, where a private grading key appears. */
function privateKeyPaths(value: unknown, at = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => privateKeyPaths(item, join(at, String(index))));
  if (!isObject(value)) return [];

  return Object.entries(value).flatMap(([key, child]) => [
    ...((PRIVATE_CONFIG_KEYS as readonly string[]).includes(key) ? [join(at, key)] : []),
    ...privateKeyPaths(child, join(at, key)),
  ]);
}

function join(at: string, key: string): string {
  return at === "" ? key : `${at}.${key}`;
}
