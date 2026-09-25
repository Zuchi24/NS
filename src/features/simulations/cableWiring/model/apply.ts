import { END_IDS, MAX_STRIP_PASS, MIN_BODY, MIN_WORK, NATURAL_ORDER, PAIR_IDS, PAIRS, UNEVEN_OFFSETS } from "./constants";
import {
  clamp,
  exposed,
  insertionBounds,
  normalizeNicks,
  otherEnd,
  plugRearMm,
  startingFan,
  uniformTips,
  untwistedAll,
} from "./geometry";
import type {
  Action,
  ApplyResult,
  CableEnd,
  CableState,
  RejectReason,
  Scenario,
  SimEvent,
} from "./types";

/**
 * The action engine: one pure transition from a state and an action to the
 * next state and what happened, or a refusal.
 *
 * A refusal changes nothing and says nothing — no events, and the state handed
 * in is never touched. Refusals are for what is physically impossible; a
 * mistake always goes through and becomes part of the cable.
 *
 * Checks run in a fixed order so the same bad action always gets the same
 * reason. First the action's shape (a known end, known enum values, integer
 * measurements), refused as invalid-input; then each action's own preconditions
 * and limits, in the order the P0 contract lists them.
 */

export function createInitialState(scenario: Scenario): CableState {
  return {
    ends: { A: cloneEnd(scenario.initialEnds.A), B: cloneEnd(scenario.initialEnds.B) },
    tray: { plugs: scenario.plugs },
    connections: {},
  };
}

export function apply(state: CableState, action: Action, scenario: Scenario): ApplyResult {
  if (!wellFormed(action)) return refuse("invalid-input");

  switch (action.type) {
    case "cut":
      return cut(state, action, scenario);
    case "strip":
      return strip(state, action, scenario);
    case "untwist":
      return untwist(state, action, scenario);
    case "moveConductor":
      return moveConductor(state, action);
    case "trim":
      return trim(state, action);
    case "insert":
      return insert(state, action);
    case "push":
      return push(state, action);
    case "withdraw":
      return withdraw(state, action);
    case "crimp":
      return crimp(state, action);
    case "connect":
      return connect(state, action, scenario);
    case "disconnect":
      return disconnect(state, action);
  }
}

/* ============================================================
   THE ACTIONS
   ============================================================ */

type Of<T extends Action["type"]> = Extract<Action, { type: T }>;

function cut(state: CableState, action: Of<"cut">, scenario: Scenario): ApplyResult {
  const end = state.ends[action.end];
  const J = end.jacketEdgeMm;
  const P = action.atMm;
  const rear = plugRearMm(end);

  if (P < J) return refuse("position-not-on-jacket");
  if (rear !== null && P < rear) return refuse("cut-through-plug");

  const removesSomething =
    P > J || end.plug !== null || NATURAL_ORDER.some((c) => end.tipMm[c] < J);
  if (!removesSomething) return refuse("nothing-to-cut");

  if (P + state.ends[otherEnd(action.end)].jacketEdgeMm > scenario.startLengthMm - MIN_BODY) {
    return refuse("insufficient-cable");
  }

  const next = cloneState(state);
  const target = next.ends[action.end];
  const events: SimEvent[] = [{ type: "cut", end: action.end, fromJ: J, toJ: P }];

  target.jacketEdgeMm = P;
  target.tipMm = uniformTips(P);
  target.fan = null;
  target.untwisted = untwistedAll(false);
  target.nicksAtMm = target.nicksAtMm.filter((n) => n >= P);

  if (end.plug !== null) {
    // An uncrimped plug slides off the offcut and can be fitted again; once
    // crimped at all, it goes with the offcut.
    if (end.plug.crimp === "none") {
      next.tray.plugs += 1;
      events.push({ type: "plugReleased", end: action.end });
    } else {
      events.push({ type: "plugDestroyed", end: action.end });
    }

    target.plug = null;
  }

  if (next.connections[action.end] !== undefined) {
    delete next.connections[action.end];
    events.push({ type: "disconnected", end: action.end });
  }

  return accept(next, events);
}

function strip(state: CableState, action: Of<"strip">, scenario: Scenario): ApplyResult {
  const end = state.ends[action.end];
  const S = action.amountMm;

  if (end.plug !== null) return refuse("plug-present");
  if (S < 1 || S > MAX_STRIP_PASS) return refuse("invalid-input");

  const newJ = end.jacketEdgeMm + S;
  if (newJ + state.ends[otherEnd(action.end)].jacketEdgeMm > scenario.startLengthMm - MIN_BODY) {
    return refuse("insufficient-cable");
  }

  const next = cloneState(state);
  const target = next.ends[action.end];
  const nicked = action.slot === "too-deep";

  // The slug comes off; the conductors stay where they are. A blade set too
  // deep scores all eight where it cut — at the new jacket edge.
  target.jacketEdgeMm = newJ;
  if (nicked) target.nicksAtMm = [...target.nicksAtMm, newJ];

  return accept(next, [{ type: "stripped", end: action.end, amountMm: S, nicked }]);
}

function untwist(state: CableState, action: Of<"untwist">, scenario: Scenario): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug !== null) return refuse("plug-present");
  if (end.untwisted[action.pair]) return refuse("already-untwisted");

  const [first, second] = PAIRS[action.pair];
  if (Math.min(exposed(end, first), exposed(end, second)) < MIN_WORK) {
    return refuse("too-short-to-grip");
  }

  const next = cloneState(state);
  const target = next.ends[action.end];
  const events: SimEvent[] = [{ type: "untwisted", end: action.end, pair: action.pair }];

  target.untwisted[action.pair] = true;

  if (PAIR_IDS.every((pair) => target.untwisted[pair])) {
    target.fan = [...startingFan(scenario, action.end)];
    events.push({ type: "fanned", end: action.end });
  }

  return accept(next, events);
}

function moveConductor(state: CableState, action: Of<"moveConductor">): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug !== null) return refuse("plug-present");
  if (end.fan === null) return refuse("no-fan");
  if (action.toIndex < 0 || action.toIndex > 7) return refuse("invalid-input");

  const fromIndex = end.fan.indexOf(action.conductor);
  if (fromIndex === action.toIndex) return refuse("no-change");

  // Reorder, not swap: lift it out, then drop it in at an index of the
  // resulting row. Everything between shifts over by one.
  const fan = end.fan.filter((c) => c !== action.conductor);
  fan.splice(action.toIndex, 0, action.conductor);

  const next = cloneState(state);
  next.ends[action.end].fan = fan;

  return accept(next, [
    {
      type: "conductorMoved",
      end: action.end,
      conductor: action.conductor,
      fromIndex,
      toIndex: action.toIndex,
    },
  ]);
}

function trim(state: CableState, action: Of<"trim">): ApplyResult {
  const end = state.ends[action.end];
  const t = action.leaveMm;

  if (end.plug !== null) return refuse("plug-present");
  if (t < 1) return refuse("invalid-input");

  const J = end.jacketEdgeMm;
  const bunched = end.fan === null;

  // Cutting a fanned row leaves every conductor at most t long. Cutting the
  // pairs while still bunched catches some of them short.
  const tipMm = Object.fromEntries(
    NATURAL_ORDER.map((c, index) => {
      const leave = bunched ? Math.max(0, t - UNEVEN_OFFSETS[index]) : t;

      return [c, Math.max(end.tipMm[c], J - leave)];
    }),
  ) as CableEnd["tipMm"];

  if (NATURAL_ORDER.every((c) => tipMm[c] === end.tipMm[c])) return refuse("no-change");

  const next = cloneState(state);
  next.ends[action.end].tipMm = tipMm;

  return accept(next, [{ type: "trimmed", end: action.end, leaveMm: t, uneven: bunched }]);
}

function insert(state: CableState, action: Of<"insert">): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug !== null) return refuse("plug-present");
  if (end.fan === null) return refuse("no-fan");
  if (state.tray.plugs < 1) return refuse("tray-empty");

  const { lo, hi } = insertionBounds(end);
  const jacketInMm = clamp(action.pushMm, lo, hi);

  const next = cloneState(state);
  next.ends[action.end].plug = { orientation: action.orientation, jacketInMm, crimp: "none" };
  next.tray.plugs -= 1;

  return accept(next, [
    { type: "inserted", end: action.end, orientation: action.orientation, jacketInMm },
  ]);
}

function push(state: CableState, action: Of<"push">): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug === null) return refuse("no-plug");
  if (end.plug.crimp !== "none") return refuse("plug-locked");
  if (state.connections[action.end] !== undefined) return refuse("plug-connected");

  const { lo, hi } = insertionBounds(end);
  const jacketInMm = clamp(action.pushMm, lo, hi);
  if (jacketInMm <= end.plug.jacketInMm) return refuse("no-change");

  const next = cloneState(state);
  next.ends[action.end].plug!.jacketInMm = jacketInMm;

  return accept(next, [{ type: "pushed", end: action.end, jacketInMm }]);
}

function withdraw(state: CableState, action: Of<"withdraw">): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug === null) return refuse("no-plug");
  if (end.plug.crimp !== "none") return refuse("plug-locked");
  if (state.connections[action.end] !== undefined) return refuse("plug-connected");

  const next = cloneState(state);
  next.ends[action.end].plug = null;
  next.tray.plugs += 1;

  return accept(next, [{ type: "withdrawn", end: action.end }]);
}

function crimp(state: CableState, action: Of<"crimp">): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug === null) return refuse("no-plug");
  if (state.connections[action.end] !== undefined) return refuse("plug-connected");
  if (end.plug.crimp === "full") return refuse("already-crimped");
  if (action.squeeze === "partial" && end.plug.crimp === "partial") return refuse("no-change");

  const next = cloneState(state);
  next.ends[action.end].plug!.crimp = action.squeeze;

  return accept(next, [{ type: "crimped", end: action.end, squeeze: action.squeeze }]);
}

function connect(state: CableState, action: Of<"connect">, scenario: Scenario): ApplyResult {
  const end = state.ends[action.end];

  if (end.plug === null) return refuse("no-plug");
  if (state.connections[action.end] !== undefined) return refuse("already-connected");
  if (!scenario.endpoints.some((endpoint) => endpoint.id === action.endpoint)) {
    return refuse("unknown-endpoint");
  }
  if (state.connections[otherEnd(action.end)] === action.endpoint) return refuse("endpoint-busy");

  const next = cloneState(state);
  next.connections[action.end] = action.endpoint;

  return accept(next, [{ type: "connected", end: action.end, endpoint: action.endpoint }]);
}

function disconnect(state: CableState, action: Of<"disconnect">): ApplyResult {
  if (state.connections[action.end] === undefined) return refuse("not-connected");

  const next = cloneState(state);
  delete next.connections[action.end];

  return accept(next, [{ type: "disconnected", end: action.end }]);
}

/* ============================================================
   PLUMBING
   ============================================================ */

function refuse(reason: RejectReason): ApplyResult {
  return { rejected: reason };
}

/** Every accepted state leaves with its nicks normalised. */
function accept(next: CableState, events: SimEvent[]): ApplyResult {
  for (const id of END_IDS) {
    next.ends[id].nicksAtMm = normalizeNicks(next.ends[id]);
  }

  return { state: next, events };
}

function cloneEnd(end: CableEnd): CableEnd {
  return {
    jacketEdgeMm: end.jacketEdgeMm,
    tipMm: { ...end.tipMm },
    fan: end.fan ? [...end.fan] : null,
    plug: end.plug ? { ...end.plug } : null,
    nicksAtMm: [...end.nicksAtMm],
    untwisted: { ...end.untwisted },
  };
}

function cloneState(state: CableState): CableState {
  return {
    ends: { A: cloneEnd(state.ends.A), B: cloneEnd(state.ends.B) },
    tray: { plugs: state.tray.plugs },
    connections: { ...state.connections },
  };
}

const oneOf = (options: readonly unknown[], value: unknown) => options.includes(value);

/** The action's shape: a known end, known enum values, integer measurements. */
function wellFormed(action: Action): boolean {
  if (typeof action !== "object" || action === null) return false;
  if (!oneOf(END_IDS, action.end)) return false;

  switch (action.type) {
    case "cut":
      return Number.isInteger(action.atMm);
    case "strip":
      return Number.isInteger(action.amountMm) && oneOf(["correct", "too-deep"], action.slot);
    case "untwist":
      return oneOf(PAIR_IDS, action.pair);
    case "moveConductor":
      return oneOf(NATURAL_ORDER, action.conductor) && Number.isInteger(action.toIndex);
    case "trim":
      return Number.isInteger(action.leaveMm);
    case "insert":
      return (
        oneOf(["contacts-up", "contacts-down"], action.orientation) &&
        Number.isInteger(action.pushMm)
      );
    case "push":
      return Number.isInteger(action.pushMm);
    case "crimp":
      return oneOf(["partial", "full"], action.squeeze);
    case "connect":
      return typeof action.endpoint === "string";
    case "withdraw":
    case "disconnect":
      return true;
    default:
      return false;
  }
}
