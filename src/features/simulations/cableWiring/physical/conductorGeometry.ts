import { END_IDS, clamp, exposed, maxExposed } from "../model";
import type { CableEnd, CableState, Conductor, EndId } from "../model";
import { CY, LAYOUT } from "./benchGeometry";

/**
 * The row a fanned end's eight conductors lie in, and what taking one out of
 * it and offering it to a lane means.
 *
 * The same arithmetic the bench draws the row with is the arithmetic that says
 * which conductor a hand has hold of and which lane it is being offered to, so
 * the wire under the hand and the wire named in the gesture can never be two
 * different wires.
 *
 * Pure picture, like the rest of the geometry layer. Nothing here decides
 * whether a move is allowed, and nothing here knows what order the row is
 * supposed to end up in: a conductor can be taken out of the row, offered to a
 * lane, and still be refused by the model, which is the only place that
 * judgment lives (see dryRun).
 */

/** How far apart the eight lanes of a fanned end lie. */
export const LANE_GAP = 8.5;

export const LANE_COUNT = 8;

/** How far past the outer lanes the row still takes a conductor, so the first
 *  and last lanes are no harder to reach than the ones in the middle. */
export const ROW_MARGIN = LANE_GAP / 2;

/** Slack along a conductor, so taking hold of one need not be pixel-perfect. */
export const GRAB_MARGIN = 6;

/** The centre line of lane `index`, across the cable. */
export function laneY(index: number, cy: number = CY): number {
  return cy + (index - (LANE_COUNT - 1) / 2) * LANE_GAP;
}

/** One conductor, as it can be taken hold of: which one, and the box it fills. */
export interface ConductorRegion {
  end: EndId;
  conductor: Conductor;
  /** The lane it lies in, 0 to 7 from the top. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The stretch of bench an end's row of conductors is drawn over. */
function rowSpan(id: EndId, reachMm: number, scale: number): { x: number; width: number } {
  const { x0, dir } = LAYOUT[id];
  const tip = x0 + dir * reachMm * scale;

  return {
    x: Math.min(x0, tip) - GRAB_MARGIN,
    width: Math.abs(tip - x0) + 2 * GRAB_MARGIN,
  };
}

/**
 * The conductors on one end there is something to take hold of.
 *
 * One per lane of the fan, each reaching as far out as that conductor itself
 * does. Listed whenever the fan is drawn — under a plug included, because a
 * plug is something the model knows about and refuses for, not something this
 * file may decide by leaving the wire out of the list.
 */
export function conductorRegions(
  id: EndId,
  end: CableEnd,
  scale: number,
  cy: number = CY,
): ConductorRegion[] {
  if (end.fan === null) return [];

  return end.fan.flatMap((conductor, index) => {
    const reachMm = exposed(end, conductor);
    if (reachMm <= 0) return [];

    const { x, width } = rowSpan(id, reachMm, scale);

    return [{ end: id, conductor, index, x, y: laneY(index, cy) - LANE_GAP / 2, width, height: LANE_GAP }];
  });
}

/**
 * The conductor under a point, or null where the bench has nothing to take
 * hold of.
 *
 * Which end is asked of the drawing, never of what happens to be selected.
 * Everywhere else — the jacket, the out-of-scale middle, the shelf, past the
 * tips, above and below the row — is neutral and claims nothing.
 */
export function conductorUnder(
  x: number,
  y: number,
  cable: CableState,
  scale: number,
  cy: number = CY,
): ConductorRegion | null {
  for (const id of END_IDS) {
    for (const region of conductorRegions(id, cable.ends[id], scale, cy)) {
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        return region;
      }
    }
  }

  return null;
}

/** The whole row as one band: every lane, out to the longest conductor. */
export function rowBounds(
  id: EndId,
  end: CableEnd,
  scale: number,
  cy: number = CY,
): { x: number; y: number; width: number; height: number } | null {
  if (end.fan === null) return null;

  const reachMm = maxExposed(end);
  if (reachMm <= 0) return null;

  return {
    ...rowSpan(id, reachMm, scale),
    y: laneY(0, cy) - LANE_GAP / 2 - ROW_MARGIN,
    height: LANE_COUNT * LANE_GAP + 2 * ROW_MARGIN,
  };
}

/**
 * The lane a hand over this end's row is offering a conductor to, or null when
 * the hand is not over the row at all.
 *
 * The lane nearest the hand, which is also the lane the row is drawn holding
 * open — so what is offered is what is shown. Always one of the eight, so
 * there is no such thing as an ambiguous or out-of-range offer; whether that
 * lane is a move the model will make is the model's own question.
 */
export function insertionAt(
  x: number,
  y: number,
  id: EndId,
  end: CableEnd,
  scale: number,
  cy: number = CY,
): number | null {
  const bounds = rowBounds(id, end, scale, cy);
  if (bounds === null) return null;
  if (x < bounds.x || x > bounds.x + bounds.width) return null;
  if (y < bounds.y || y > bounds.y + bounds.height) return null;

  return clamp(Math.round((y - laneY(0, cy)) / LANE_GAP), 0, LANE_COUNT - 1);
}

/**
 * Where the seven conductors still in the row lie while one of them is out of
 * it, and which lane is being held open for the one in hand.
 *
 * With a lane offered, this is the row the model's own move would leave
 * behind: lift the conductor out, drop it in at that index, and everything
 * between slides over one place. With no lane offered nothing has been
 * decided, so the rest stay exactly where they were and the hole is simply
 * where the conductor came from.
 */
export function liftedRow(
  fan: readonly Conductor[],
  grabbed: Conductor,
  toIndex: number | null,
): { lanes: Map<Conductor, number>; slot: number | null } {
  const remaining = fan.filter((conductor) => conductor !== grabbed);
  const lanes = new Map<Conductor, number>();

  if (toIndex === null) {
    for (const conductor of remaining) lanes.set(conductor, fan.indexOf(conductor));

    return { lanes, slot: null };
  }

  remaining.forEach((conductor, place) => lanes.set(conductor, place < toIndex ? place : place + 1));

  return { lanes, slot: toIndex };
}
