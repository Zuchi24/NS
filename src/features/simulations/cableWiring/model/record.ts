import { NATURAL_ORDER } from "./constants";
import { normalizeNicks } from "./geometry";
import type { CableEnd, CableRecord, CableState, Conductor, EndRecord } from "./types";

/**
 * The cable/1 record: the physical termination, whitelisted.
 *
 * This is the `submission` body the existing `submitSimulation()` wraps and
 * sends. It carries facts only. Everything the server needs to decide whether
 * the cable is right, it derives itself; nothing here states a verdict, a
 * standard, a pattern, or anything the UI kept for its own use — the tray,
 * untwist state, test history.
 *
 * Built field by field in a fixed order, so equal cables always serialise to
 * the same bytes whatever order their state happened to be assembled in.
 */
export function toRecord(state: CableState): CableRecord {
  const connections: CableRecord["connections"] = {};
  if (state.connections.A !== undefined) connections.A = state.connections.A;
  if (state.connections.B !== undefined) connections.B = state.connections.B;

  return {
    schema: "cable/1",
    ends: { A: endRecord(state.ends.A), B: endRecord(state.ends.B) },
    connections,
  };
}

function endRecord(end: CableEnd): EndRecord {
  return {
    jacket_edge_mm: end.jacketEdgeMm,
    tip_mm: Object.fromEntries(NATURAL_ORDER.map((c) => [c, end.tipMm[c]])) as Record<
      Conductor,
      number
    >,
    fan: end.fan ? [...end.fan] : null,
    plug: end.plug
      ? {
          orientation: end.plug.orientation,
          jacket_in_mm: end.plug.jacketInMm,
          crimp: end.plug.crimp,
        }
      : null,
    nicks_at_mm: normalizeNicks(end),
  };
}
