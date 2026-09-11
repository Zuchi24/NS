import {
  AT_FRONT_TOLERANCE,
  CONTACT_LINE,
  END_IDS,
  FRONT_STOP,
  JACKET_STOP,
  MIN_BODY,
  MIN_ENGAGE,
  NATURAL_ORDER,
  PAIR_IDS,
  RELIEF_CLAMP,
} from "./constants";
import type { CableEnd, CableState, Conductor, EndId, PairId, Plug, Scenario } from "./types";

/**
 * Pure derivations over the physical state.
 *
 * Everything here is computed, never stored: exposed lengths, where the plug
 * sits, whether a conductor reaches its blade, whether a nick still exists.
 * Storing any of these would let them drift from the facts they come from.
 */

export function otherEnd(end: EndId): EndId {
  return end === "A" ? "B" : "A";
}

/* ------------------------------------------------------------
   Exposed conductor (end frame)
   ------------------------------------------------------------ */

/** X[c] = J − T[c]: conductor beyond the jacket edge. */
export function exposed(end: CableEnd, conductor: Conductor): number {
  return end.jacketEdgeMm - end.tipMm[conductor];
}

export function maxExposed(end: CableEnd): number {
  return Math.max(...NATURAL_ORDER.map((c) => exposed(end, c)));
}

export function minExposed(end: CableEnd): number {
  return Math.min(...NATURAL_ORDER.map((c) => exposed(end, c)));
}

/** Graded length: jacketed cable left between the two jacket edges. */
export function jacketedLengthMm(state: CableState, scenario: Scenario): number {
  return scenario.startLengthMm - state.ends.A.jacketEdgeMm - state.ends.B.jacketEdgeMm;
}

/* ------------------------------------------------------------
   The plug (plug frame, and where it sits in the end frame)
   ------------------------------------------------------------ */

/** R = J + jacketIn: the plug's rear opening, in the end frame. */
export function plugRearMm(end: CableEnd): number | null {
  return end.plug === null ? null : end.jacketEdgeMm + end.plug.jacketInMm;
}

/** F = R − FRONT_STOP: the plug's front face, in the end frame. */
export function plugFrontMm(end: CableEnd): number | null {
  const rear = plugRearMm(end);

  return rear === null ? null : rear - FRONT_STOP;
}

/** tip[c] = jacketIn + X[c]: how deep a conductor's tip is inside the plug. */
export function tipInPlug(end: CableEnd, conductor: Conductor): number | null {
  return end.plug === null ? null : end.plug.jacketInMm + exposed(end, conductor);
}

/**
 * The range the jacket edge can occupy inside a plug on this end.
 *
 * lo: the longest conductor is at least MIN_ENGAGE inside the plug.
 * hi: the jacket has reached JACKET_STOP, or the longest conductor has hit the
 *     front face — whichever comes first. lo ≤ hi always holds.
 */
export function insertionBounds(end: CableEnd): { lo: number; hi: number } {
  const longest = maxExposed(end);

  return {
    lo: MIN_ENGAGE - longest,
    hi: Math.min(JACKET_STOP, FRONT_STOP - longest),
  };
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** The tip is at or past the blade line. Inclusive. */
export function reachesContact(end: CableEnd, conductor: Conductor): boolean {
  const tip = tipInPlug(end, conductor);

  return tip !== null && tip >= CONTACT_LINE;
}

/** A blade has pierced this conductor: it reaches, and the plug is fully crimped. */
export function hasContact(end: CableEnd, conductor: Conductor): boolean {
  return end.plug?.crimp === "full" && reachesContact(end, conductor);
}

/** The strain relief grips jacket rather than bare conductor. Inclusive. */
export function jacketClamped(end: CableEnd): boolean {
  return end.plug !== null && end.plug.jacketInMm >= RELIEF_CLAMP;
}

/** Every tip within AT_FRONT_TOLERANCE of the front face. */
export function conductorsAtFront(end: CableEnd): boolean {
  return (
    end.plug !== null &&
    NATURAL_ORDER.every((c) => (tipInPlug(end, c) ?? -Infinity) >= FRONT_STOP - AT_FRONT_TOLERANCE)
  );
}

/** A plug fitted and crimped at all — the end counts as terminated. */
export function terminated(end: CableEnd): boolean {
  return end.plug !== null && end.plug.crimp !== "none";
}

/* ------------------------------------------------------------
   Nicks (end frame, interval [n, n + 1) on all eight conductors)
   ------------------------------------------------------------ */

/** Active on this conductor while some of [n, n + 1) lies inward of its tip. */
export function nickActiveOn(end: CableEnd, nickMm: number, conductor: Conductor): boolean {
  return nickMm + 1 > end.tipMm[conductor];
}

export function nickActive(end: CableEnd, nickMm: number): boolean {
  return NATURAL_ORDER.some((c) => nickActiveOn(end, nickMm, c));
}

/** Sorted, unique, and only nicks still active on some conductor. */
export function normalizeNicks(end: CableEnd, nicks: readonly number[] = end.nicksAtMm): number[] {
  return [...new Set(nicks)].filter((n) => nickActive(end, n)).sort((a, b) => a - b);
}

/* ------------------------------------------------------------
   Constructors
   ------------------------------------------------------------ */

export function uniformTips(tipMm: number): Record<Conductor, number> {
  return Object.fromEntries(NATURAL_ORDER.map((c) => [c, tipMm])) as Record<Conductor, number>;
}

export function untwistedAll(value: boolean): Record<PairId, boolean> {
  return Object.fromEntries(PAIR_IDS.map((pair) => [pair, value])) as Record<PairId, boolean>;
}

/** A freshly cut end: every tip at the jacket edge, nothing untwisted, no plug. */
export function rawEnd(jacketEdgeMm = 0): CableEnd {
  return {
    jacketEdgeMm,
    tipMm: uniformTips(jacketEdgeMm),
    fan: null,
    plug: null,
    nicksAtMm: [],
    untwisted: untwistedAll(false),
  };
}

/**
 * Any end, described physically. Tips default to the jacket edge; a fan
 * implies every pair is untwisted unless said otherwise.
 */
export function makeEnd(spec: {
  jacketEdgeMm: number;
  tipMm?: number | Record<Conductor, number>;
  fan?: readonly Conductor[] | null;
  plug?: Plug | null;
  nicksAtMm?: readonly number[];
  untwisted?: Record<PairId, boolean>;
}): CableEnd {
  const fan = spec.fan ? [...spec.fan] : null;
  const tips = spec.tipMm ?? spec.jacketEdgeMm;

  return {
    jacketEdgeMm: spec.jacketEdgeMm,
    tipMm: typeof tips === "number" ? uniformTips(tips) : { ...tips },
    fan,
    plug: spec.plug ? { ...spec.plug } : null,
    nicksAtMm: [...(spec.nicksAtMm ?? [])],
    untwisted: spec.untwisted ? { ...spec.untwisted } : untwistedAll(fan !== null),
  };
}

/* ------------------------------------------------------------
   Invariants (P0 §2.3)
   ------------------------------------------------------------ */

/**
 * Every frozen invariant this state breaks, as readable strings. Empty means
 * the state is physically possible. Used by tests; a renderer need never call it.
 */
export function invariantViolations(state: CableState, scenario: Scenario): string[] {
  const problems: string[] = [];

  for (const id of END_IDS) {
    const end = state.ends[id];
    const J = end.jacketEdgeMm;

    for (const c of NATURAL_ORDER) {
      const T = end.tipMm[c];
      if (!Number.isInteger(T) || T < 0 || T > J) problems.push(`${id}: tip ${c}=${T} outside 0..${J}`);
    }

    if (end.fan !== null) {
      const unique = new Set(end.fan);
      if (end.fan.length !== 8 || unique.size !== 8 || !NATURAL_ORDER.every((c) => unique.has(c))) {
        problems.push(`${id}: fan is not a permutation of the eight conductors`);
      }
      if (!PAIR_IDS.every((pair) => end.untwisted[pair])) {
        problems.push(`${id}: fan present with a pair still twisted`);
      }
    }

    if (end.plug !== null) {
      if (end.fan === null) problems.push(`${id}: plug without a fan`);
      const { lo, hi } = insertionBounds(end);
      if (end.plug.jacketInMm < lo || end.plug.jacketInMm > hi) {
        problems.push(`${id}: jacketIn ${end.plug.jacketInMm} outside ${lo}..${hi}`);
      }
    }

    const normal = normalizeNicks(end);
    if (
      normal.length !== end.nicksAtMm.length ||
      normal.some((n, i) => n !== end.nicksAtMm[i]) ||
      end.nicksAtMm.some((n) => n < 0 || n > J)
    ) {
      problems.push(`${id}: nicks not normalised`);
    }

    const endpoint = state.connections[id];
    if (endpoint !== undefined) {
      if (end.plug === null) problems.push(`${id}: connected without a plug`);
      if (!scenario.endpoints.some((e) => e.id === endpoint)) problems.push(`${id}: unknown endpoint ${endpoint}`);
    }
  }

  if (state.ends.A.jacketEdgeMm + state.ends.B.jacketEdgeMm > scenario.startLengthMm - MIN_BODY) {
    problems.push("jacketed body shorter than MIN_BODY");
  }
  if (
    state.connections.A !== undefined &&
    state.connections.A === state.connections.B
  ) {
    problems.push("both ends on one endpoint");
  }
  if (state.tray.plugs < 0) problems.push("negative tray");

  return problems;
}
