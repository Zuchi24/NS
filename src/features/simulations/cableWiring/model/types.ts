import type { Difficulty } from "@/features/content/types";

import type { END_IDS, NATURAL_ORDER, PAIR_IDS, PATTERNS } from "./constants";

/**
 * The physical cable model's types.
 *
 * Two coordinate frames are in use and they are never mixed:
 *
 *   End frame   one per end. Origin at that end's original face, as the
 *               scenario supplies it; millimetres, increasing inward toward
 *               the other end. `jacketEdgeMm`, `tipMm` and `nicksAtMm` are in
 *               this frame.
 *
 *   Plug frame  origin at the plug's rear opening, increasing toward its front
 *               face at FRONT_STOP. `Plug.jacketInMm` is in this frame. A
 *               plug-frame depth p sits at end-frame position R − p, where
 *               R = jacketEdgeMm + jacketInMm is the rear opening.
 */

export type Conductor = (typeof NATURAL_ORDER)[number];
export type PairId = (typeof PAIR_IDS)[number];
export type EndId = (typeof END_IDS)[number];

export type Orientation = "contacts-up" | "contacts-down";
export type Crimp = "none" | "partial" | "full";
export type StripSlot = "correct" | "too-deep";
export type Standard = "T568A" | "T568B";

export interface Plug {
  /** contacts-up: pin 1 is fan[0]. contacts-down: pin 1 is fan[7]. */
  orientation: Orientation;
  /** Where the jacket edge sits inside the plug; negative means outside it. Plug frame. */
  jacketInMm: number;
  crimp: Crimp;
}

export interface CableEnd {
  /** J — the jacket edge. End frame. */
  jacketEdgeMm: number;
  /** T[c] — each conductor's tip. End frame; always 0 ≤ T[c] ≤ J. */
  tipMm: Record<Conductor, number>;
  /** Lane order across the flat bundle's reading face; null until every pair is untwisted. */
  fan: Conductor[] | null;
  plug: Plug | null;
  /**
   * Stripper nicks. A nick at n damages all eight conductors over [n, n + 1).
   * End frame; kept sorted, unique, and only while active on some conductor.
   */
  nicksAtMm: number[];
  /** Model-only. Never submitted: a fan already implies every pair is untwisted. */
  untwisted: Record<PairId, boolean>;
}

export type EndpointId = string;
export type EndpointKind = "tester-main" | "tester-remote" | "mdi" | "mdix";

export interface Endpoint {
  id: EndpointId;
  kind: EndpointKind;
}

export interface CableState {
  ends: Record<EndId, CableEnd>;
  /** Model-only: plugs left to fit. Never submitted. */
  tray: { plugs: number };
  connections: Partial<Record<EndId, EndpointId>>;
}

/** The facts a scenario authors. On the server these are authoritative. */
export interface Scenario {
  id: string;
  /** L0 — the cable's length before any work. */
  startLengthMm: number;
  plugs: number;
  initialEnds: Record<EndId, CableEnd>;
  endpoints: Endpoint[];
  /**
   * The row the conductors fall into when an end's last pair is untwisted. Not
   * authored and not graded: the bench picks one for each end, afresh whenever
   * that end is a newly exposed section of cable, so the starting row is not
   * always the same. One row serves both ends; a record gives each end its
   * own. Absent, or not all eight each once, it is NATURAL_ORDER. Read through
   * startingFan().
   */
  fanOrder?: readonly Conductor[] | Partial<Record<EndId, readonly Conductor[]>>;
}

export type InspectionCheck = "strain_relief" | "untwist" | "front" | "insulation";

/**
 * What a scenario asks for — the `require` block of an `rj45_cable` rule.
 * Data only: evaluating it is the requirement evaluator's job, not the model's.
 */
export interface ScenarioRequire {
  ends: Record<EndId, Standard> | "each-standard" | null;
  cable: "straight" | "crossover" | null;
  minLengthMm: number | null;
  inspection: InspectionCheck[];
  link: [EndpointId, EndpointId] | null;
}

/** A scenario the frontend holds itself, for practice runs with no attempt. */
export interface PracticeScenario extends Scenario {
  title: string;
  difficulty: Difficulty;
  require: ScenarioRequire;
}

/* ============================================================
   ACTIONS
   ============================================================ */

export type Action =
  | { type: "cut"; end: EndId; atMm: number }
  | { type: "strip"; end: EndId; amountMm: number; slot: StripSlot }
  | { type: "untwist"; end: EndId; pair: PairId }
  | { type: "moveConductor"; end: EndId; conductor: Conductor; toIndex: number }
  | { type: "trim"; end: EndId; leaveMm: number }
  | { type: "insert"; end: EndId; orientation: Orientation; pushMm: number }
  | { type: "push"; end: EndId; pushMm: number }
  | { type: "withdraw"; end: EndId }
  | { type: "crimp"; end: EndId; squeeze: "partial" | "full" }
  | { type: "connect"; end: EndId; endpoint: EndpointId }
  | { type: "disconnect"; end: EndId };

export type RejectReason =
  | "invalid-input"
  | "plug-present"
  | "no-plug"
  | "plug-locked"
  | "plug-connected"
  | "no-fan"
  | "tray-empty"
  | "too-short-to-grip"
  | "already-untwisted"
  | "position-not-on-jacket"
  | "cut-through-plug"
  | "nothing-to-cut"
  | "insufficient-cable"
  | "no-change"
  | "already-crimped"
  | "already-connected"
  | "not-connected"
  | "unknown-endpoint"
  | "endpoint-busy";

export type SimEvent =
  | { type: "cut"; end: EndId; fromJ: number; toJ: number }
  | { type: "plugReleased"; end: EndId }
  | { type: "plugDestroyed"; end: EndId }
  | { type: "stripped"; end: EndId; amountMm: number; nicked: boolean }
  | { type: "untwisted"; end: EndId; pair: PairId }
  | { type: "fanned"; end: EndId }
  | { type: "conductorMoved"; end: EndId; conductor: Conductor; fromIndex: number; toIndex: number }
  | { type: "trimmed"; end: EndId; leaveMm: number; uneven: boolean }
  | { type: "inserted"; end: EndId; orientation: Orientation; jacketInMm: number }
  | { type: "pushed"; end: EndId; jacketInMm: number }
  | { type: "withdrawn"; end: EndId }
  | { type: "crimped"; end: EndId; squeeze: "partial" | "full" }
  | { type: "connected"; end: EndId; endpoint: EndpointId }
  | { type: "disconnected"; end: EndId };

export type ApplyResult =
  | { state: CableState; events: SimEvent[] }
  | { rejected: RejectReason };

/* ============================================================
   WIREMAP
   ============================================================ */

export type Pattern = keyof typeof PATTERNS | "miswired";

export type Verdict =
  | "incomplete"
  | "short"
  | "open"
  | "miswired"
  | "split-pair"
  | "straight"
  | "crossover"
  | "gigabit-crossover"
  | "rollover";

export interface SplitPairFinding {
  end: EndId;
  pins: [number, number];
  conductors: [Conductor, Conductor];
}

export interface OpenDetail {
  /** The pin at the near end — end A for wiremap(), the MAIN end for a tester readout. */
  aPin: number;
  conductor: Conductor;
  /** The ends where this conductor has no contact. */
  noContactAt: EndId[];
}

export interface ElectricalReport {
  verdict: Verdict;
  /** Null whenever the map is incomplete. */
  pattern: Pattern | null;
  /** Entry i is the far-end pin near-end pin i + 1 reaches, or null for an open. */
  map: (number | null)[];
  /** Near-end pins with no continuity, ascending. */
  opens: number[];
  openDetail: OpenDetail[];
  /** V1 models no shorts: always empty. */
  shorts: [number, number][];
  /** Split pairs a wiremap tester can detect: both conductors have continuity. */
  splitPairs: SplitPairFinding[];
}

export type TesterReadout =
  | { status: "idle" }
  | { status: "no-remote"; mainEnd: EndId }
  | { status: "report"; mainEnd: EndId; report: ElectricalReport };

export interface EndInspection {
  jacketClamped: boolean;
  untwistOk: boolean;
  conductorsAtFront: boolean;
  insulationIntact: boolean;
}

export type LinkState =
  | { connected: false }
  | { connected: true; endpoints: [EndpointId, EndpointId]; up: boolean };

/* ============================================================
   cable/1 RECORD
   ============================================================ */

export interface PlugRecord {
  orientation: Orientation;
  jacket_in_mm: number;
  crimp: Crimp;
}

export interface EndRecord {
  jacket_edge_mm: number;
  tip_mm: Record<Conductor, number>;
  fan: Conductor[] | null;
  plug: PlugRecord | null;
  nicks_at_mm: number[];
}

/** The whole of what is submitted: the physical termination, and nothing derived. */
export interface CableRecord {
  schema: "cable/1";
  ends: Record<EndId, EndRecord>;
  connections: Partial<Record<EndId, EndpointId>>;
}
