import { END_IDS, PAIR_IDS, PAIRS, clamp, exposed } from "../model";
import type { CableEnd, CableState, Conductor, EndId, PairId } from "../model";
import { CY, LAYOUT } from "./benchGeometry";

/**
 * Where the twisted pairs are drawn, and what taking hold of one and pulling
 * it means.
 *
 * The same arithmetic the bench draws a pair with is the arithmetic that says
 * which pair a pointer has hold of, so the conductor under the hand and the
 * pair named in the gesture can never be two different pairs.
 *
 * Pure picture, like the rest of the geometry layer. Nothing here decides
 * whether an untwist is allowed: a pair can be taken hold of here and still be
 * refused by the model, which is the only place that judgment lives (see
 * dryRun). The one thing this file does decide is what counts as *taking hold*
 * and *pulling out* — the shape of the gesture, not the physics of the cable.
 */

/** How far apart the four pair rows lie across the cable. */
export const PAIR_GAP = 19;

/** A pair's own share of the bundle, either side of its row. */
export const PAIR_HALF = PAIR_GAP / 2;

/**
 * How far across the cable a pair must be pulled before it is clear of the
 * bundle and the gesture is a pull rather than a nudge. Its own row's width:
 * far enough out and the pair is no longer lying among the others.
 *
 * Gesture, not rule. Whether a pair that has been pulled out can actually be
 * untwisted is the model's answer, asked separately and every time.
 */
export const PAIR_RELEASE = PAIR_HALF;

/** How far off the bundle a pulled pair is drawn, however far the hand goes. */
export const PAIR_REACH = 32;

/** Slack around the drawn conductors, so taking hold need not be pixel-perfect. */
export const GRAB_MARGIN = 7;

/** The least a grab region spans along the cable, so a short stub is still catchable. */
export const MIN_GRAB = 18;

/** The centre line of pair row `index`, across the cable. */
export function pairRowY(index: number, cy: number = CY): number {
  return cy + (index - 1.5) * PAIR_GAP;
}

/**
 * Which pair lies in which row, top to bottom: the order the pairs first
 * appear in the row the conductors will fan into. One source of truth for the
 * attempt's starting arrangement — the bundle leaves the jacket in the same
 * order its conductors fan out in. With no row to read, the pairs lie as
 * PAIR_IDS lists them.
 */
export function pairOrderOf(fanOrder?: readonly Conductor[]): PairId[] {
  if (!fanOrder) return [...PAIR_IDS];

  const pairOf = (conductor: Conductor) =>
    PAIR_IDS.find((pair) => (PAIRS[pair] as readonly Conductor[]).includes(conductor))!;
  const order = [...new Set(fanOrder.map(pairOf))];

  return order.length === PAIR_IDS.length ? order : [...PAIR_IDS];
}

/** One pair, as it can be taken hold of: which pair, and the box it fills. */
export interface PairRegion {
  end: EndId;
  pair: PairId;
  /** The row it lies in, 0 to 3 from the top. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The pairs on one end there is something to take hold of.
 *
 * A pair is in the list when it is drawn as a twisted pair with conductor
 * outside the jacket: not once the end is fanned, not once that pair is open,
 * and not while it is still flush with the jacket edge. All three are
 * questions about what is on screen — a pair that is listed here may still be
 * refused by the model, and one that is too short to grip in the model's sense
 * is listed all the same, so the refusal comes from the model and is seen.
 */
export function pairRegions(
  id: EndId,
  end: CableEnd,
  scale: number,
  cy: number = CY,
  order: readonly PairId[] = PAIR_IDS,
): PairRegion[] {
  if (end.fan !== null) return [];

  const { x0, dir } = LAYOUT[id];

  // The rows are fixed; `order` only says which pair lies in each.
  return order.flatMap((pair, index) => {
    if (end.untwisted[pair]) return [];

    const reachMm = Math.max(...PAIRS[pair].map((conductor) => exposed(end, conductor)));
    if (reachMm <= 0) return [];

    const tip = x0 + dir * reachMm * scale;
    const from = Math.min(x0, tip) - GRAB_MARGIN;
    const to = Math.max(x0, tip) + GRAB_MARGIN;
    const width = Math.max(MIN_GRAB, to - from);

    return [
      {
        end: id,
        pair,
        index,
        // A stub too small to catch is widened outward, away from the jacket.
        x: dir === 1 ? from : to - width,
        y: pairRowY(index, cy) - PAIR_HALF,
        width,
        height: PAIR_GAP,
      },
    ];
  });
}

/**
 * The pair under a point, or null where the bench has nothing to take hold of.
 *
 * Which end is asked of the drawing, never of what happens to be selected: a
 * hand on end B's orange pair has hold of end B's orange pair. Everywhere else
 * — the jacket, the out-of-scale middle, the shelf, the gaps between the rows
 * — is neutral, and claims nothing.
 */
export function pairUnder(
  x: number,
  y: number,
  cable: CableState,
  scale: number,
  cy: number = CY,
  orders: Partial<Record<EndId, readonly PairId[]>> = {},
): PairRegion | null {
  for (const id of END_IDS) {
    // Each end's pairs lie in that end's own order.
    for (const region of pairRegions(id, cable.ends[id], scale, cy, orders[id])) {
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        return region;
      }
    }
  }

  return null;
}

/**
 * The cable lies along the bench's x axis, so a pull away from it is the
 * hand's travel across that axis and travel along the cable is the rest.
 * Splitting the movement is what makes sliding a hand along the cable worth
 * nothing at all to an untwist.
 */
export function pullAcross(_dx: number, dy: number): number {
  return dy;
}

export function travelAlong(dx: number, _dy: number): number {
  return dx;
}

/**
 * Whether the pair has been pulled out of the bundle: taken away from the
 * cable rather than along it, and far enough to be clear of its own row.
 *
 * The gesture's own question. It says the hand is pulling a pair apart rather
 * than resting on it or sliding along it; it does not say the pair may be
 * untwisted, which is asked of the model and answered by the model.
 */
export function pulledClear(dx: number, dy: number, release: number = PAIR_RELEASE): boolean {
  const across = Math.abs(pullAcross(dx, dy));

  return across >= release && across > Math.abs(travelAlong(dx, dy));
}

/**
 * How far the pair is drawn off the bundle. It follows the hand across the
 * cable from the moment it is taken hold of, and stops at the reach of the
 * conductor still rooted in the jacket.
 */
export function pairLift(dx: number, dy: number): number {
  return clamp(pullAcross(dx, dy), -PAIR_REACH, PAIR_REACH);
}

/**
 * How far open the pair is drawn, 0 to 1. Nothing while it is still lying in
 * the bundle; wound right down by the time it has been pulled twice as far as
 * it took to come clear.
 */
export function openness(dx: number, dy: number): number {
  if (!pulledClear(dx, dy)) return 0;

  return clamp(Math.abs(pullAcross(dx, dy)) / (2 * PAIR_RELEASE), 0, 1);
}
