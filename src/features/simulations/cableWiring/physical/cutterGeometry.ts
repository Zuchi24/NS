import { END_IDS, maxExposed } from "../model";
import type { CableEnd, CableState, EndId } from "../model";
import { CY, LAYOUT, offsetMmAt } from "./benchGeometry";
import { LANE_COUNT, LANE_GAP, laneY } from "./conductorGeometry";
import { PAIR_HALF, pairRowY } from "./pairGeometry";

/**
 * Where a pair of cutters is standing, and how much conductor a cut there
 * would leave.
 *
 * The cutters close on bare conductor: the stretch of an end from its jacket
 * edge out past the tips, as tall as its conductors happen to be drawn —
 * eight lanes once the end is fanned, four pair rows while it is still
 * bunched. Over the jacket, the out-of-scale middle, the shelf, or above and
 * below the conductors there is nothing for them to close on, and this file
 * says so rather than inventing a cut.
 *
 * The millimetres come from the bench's one shared scale (see benchGeometry),
 * so the same position means the same length at either end. Nothing here
 * decides whether a cut is allowed or whether it is the right length: a
 * position can be perfectly cuttable here and still be refused by the model,
 * which is the only place that judgment lives (see dryRun).
 */

/** How far past the tips the cutters still find the conductors. */
export const FIELD_REACH_MM = 4;

/** Slack above and below the drawn conductors, so the cutters need no pixel precision. */
export const FIELD_MARGIN = 8;

/** The stretch of bench an end's bare conductor is drawn over. */
export interface ConductorField {
  end: EndId;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The longest conductor on that end, in millimetres beyond the jacket edge. */
  reachMm: number;
}

/**
 * The bare conductor on one end, as something the cutters can close on, or
 * null when there is none out of the jacket to cut.
 *
 * Listed whether or not a plug is over it: a plug is something the model knows
 * about and refuses for, not something this file may decide by leaving the end
 * out of the list.
 */
export function conductorField(
  id: EndId,
  end: CableEnd,
  scale: number,
  cy: number = CY,
): ConductorField | null {
  const reachMm = maxExposed(end);
  if (reachMm <= 0) return null;

  const { x0, dir } = LAYOUT[id];
  const outer = x0 + dir * (reachMm + FIELD_REACH_MM) * scale;
  // As tall as the conductors are drawn: lanes once fanned, pair rows before.
  const band =
    end.fan !== null
      ? { top: laneY(0, cy) - LANE_GAP / 2, bottom: laneY(LANE_COUNT - 1, cy) + LANE_GAP / 2 }
      : { top: pairRowY(0, cy) - PAIR_HALF, bottom: pairRowY(3, cy) + PAIR_HALF };

  return {
    end: id,
    x: Math.min(x0, outer),
    width: Math.abs(outer - x0),
    y: band.top - FIELD_MARGIN,
    height: band.bottom - band.top + 2 * FIELD_MARGIN,
    reachMm,
  };
}

/**
 * How much conductor a cut at this point would leave beyond the jacket edge,
 * in whole millimetres — the model's own `leaveMm`, read off the shared bench
 * scale. Never negative; how little is too little is the model's call.
 */
export function leaveMmAt(userX: number, end: EndId, scale: number): number {
  return Math.max(0, Math.round(offsetMmAt(userX, end, scale)));
}

/**
 * The end the cutters are standing on and what they would leave, or null where
 * they are standing on nothing.
 *
 * Which end is asked of the drawing, never of what happens to be selected:
 * cutters held over end B's conductors are cutting end B's conductors.
 */
export function cutterTarget(
  x: number,
  y: number,
  cable: CableState,
  scale: number,
  cy: number = CY,
): { end: EndId; leaveMm: number } | null {
  for (const id of END_IDS) {
    const field = conductorField(id, cable.ends[id], scale, cy);
    if (field === null) continue;
    if (x < field.x || x > field.x + field.width) continue;
    if (y < field.y || y > field.y + field.height) continue;

    return { end: id, leaveMm: leaveMmAt(x, id, scale) };
  }

  return null;
}

/** Where a cut that leaves this much conductor is drawn, in the bench's units. */
export function bladeXAt(leaveMm: number, end: EndId, scale: number): number {
  const { x0, dir } = LAYOUT[end];

  return x0 + dir * leaveMm * scale;
}
