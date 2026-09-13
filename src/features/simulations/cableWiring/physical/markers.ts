import { END_IDS } from "../model";
import type { EndId } from "../model";
import type { Marker } from "./components/EndDetail";

/**
 * Which preview line an end shows when more than one thing could draw on it.
 *
 * An end has room for one marker, and by R5 there are four things that may
 * want it: the tool panel's slider, a stripper in hand, the flush cutters
 * standing on the conductors, and the cable cutters standing on the jacket.
 * Before this, each of those simply assigned over whatever was there, so which
 * line a student saw came down to the order of a few statements.
 *
 * So the claims are collected and ranked instead, by two questions in order:
 *
 *   1. How near the student's hand is. A tool in hand outranks a tool standing
 *      where it was put down, and both outrank the tool panel's slider, which
 *      is a number typed at the bench rather than something on it.
 *   2. How much of the end the line takes, when two claims are equally near
 *      the hand. A cut takes the whole end outward of it, a strip takes
 *      jacket, a trim only shapes the conductor tips — so a cut's line is the
 *      one to show over a trim's.
 *
 * On an exact tie the claim made first stays: a later claim never silently
 * displaces an equal one. Nothing here decides whether any of these actions is
 * allowed or wise — a marker's `tone` is the model's own answer, carried along.
 */

/** How near the student's hand the thing making the claim is. */
export type MarkerSource = "tool-panel" | "standing" | "in-hand";

export const SOURCE_RANK: Record<MarkerSource, number> = {
  "tool-panel": 0,
  standing: 1,
  "in-hand": 2,
};

/** How much of the end the line takes with it. */
export const KIND_RANK: Record<NonNullable<Marker>["kind"], number> = {
  trim: 0,
  strip: 1,
  cut: 2,
};

export interface MarkerClaim {
  end: EndId;
  marker: NonNullable<Marker>;
  source: MarkerSource;
}

export function claimRank(claim: MarkerClaim): number {
  return SOURCE_RANK[claim.source] * 10 + KIND_RANK[claim.marker.kind];
}

/**
 * The one marker each end shows: the highest-ranked claim on it, and the
 * earliest of those where two rank the same.
 */
export function resolveMarkers(claims: MarkerClaim[]): Record<EndId, Marker> {
  const shown: Record<EndId, Marker> = { A: null, B: null };
  const best: Partial<Record<EndId, number>> = {};

  for (const claim of claims) {
    const rank = claimRank(claim);
    const standing = best[claim.end];

    if (standing !== undefined && rank <= standing) continue;

    best[claim.end] = rank;
    shown[claim.end] = claim.marker;
  }

  return shown;
}

/** The claims a tool panel's markers make, one per end that has one. */
export function panelClaims(markers: Record<EndId, Marker>): MarkerClaim[] {
  return END_IDS.flatMap((end) => {
    const marker = markers[end];

    return marker === null ? [] : [{ end, marker, source: "tool-panel" as const }];
  });
}
