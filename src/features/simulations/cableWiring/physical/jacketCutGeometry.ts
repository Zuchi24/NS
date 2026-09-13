import { END_IDS } from "../model";
import type { CableEnd, CableState, EndId } from "../model";
import { CY, JACKET_HALF, LAYOUT, jacketRun, offsetMmAt, overBench } from "./benchGeometry";

/**
 * Where a pair of cable cutters is standing on the jacketed cable, and where
 * along the cable a cut there would fall.
 *
 * The cable cutters close on the cable itself — jacket, conductors and any
 * plug in one bite — so the only place they can be standing is an end's
 * jacketed run: the stretch the bench draws from that end's jacket edge inward
 * to where the out-of-scale body begins. Outward of the jacket edge there is
 * bare conductor (the flush cutters' business, see cutterGeometry), between
 * the ends the cable is not to scale, and below is the shelf. Over any of
 * those this file says the cutters are standing on nothing rather than
 * inventing a cut.
 *
 * The run and the band come from the same numbers the jacket is drawn with
 * (jacketRun, JACKET_HALF), so the jacket a hand can cut and the jacket a
 * student can see are one thing. The millimetres come from the bench's one
 * shared scale (see benchGeometry), so the same position means the same
 * distance at either end.
 *
 * Nothing here decides whether a cut is allowed, whether it goes through a
 * plug, whether anything would come off, or whether enough cable would be
 * left. A position can be perfectly standable here and still be refused by the
 * model, which is the only place that judgment lives (see dryRun).
 */

/** Slack above and below the drawn jacket, so the cutters need no pixel precision. */
export const JACKET_MARGIN = 8;

/** The stretch of bench an end's jacketed cable is drawn over. */
export interface JacketField {
  end: EndId;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One end's jacket, as something the cable cutters can close on.
 *
 * Always there: an end always has jacket drawn behind its edge, whether its
 * conductors are bunched or fanned and whether a plug is over them. Whether
 * there is anything worth cutting off is the model's answer, not this file's,
 * so no state is consulted here.
 */
export function jacketField(id: EndId, cy: number = CY): JacketField {
  const [from, to] = jacketRun(id);

  return {
    end: id,
    x: from,
    width: to - from,
    y: cy - JACKET_HALF - JACKET_MARGIN,
    height: 2 * (JACKET_HALF + JACKET_MARGIN),
  };
}

/**
 * Where along the cable a cut at this point would fall, in the model's own
 * end-frame millimetres — its `atMm`, counted inward from the end of the
 * cable.
 *
 * The jacket edge is the end's own `jacketEdgeMm`, and a point further inward
 * is that much further in again. Not clamped and not floored: the arithmetic
 * says where the cutters are, and the model says what that means.
 */
export function atMmAt(userX: number, id: EndId, end: CableEnd, scale: number): number {
  return end.jacketEdgeMm + Math.round(-offsetMmAt(userX, id, scale));
}

/** The cutters' position on the cable: which end, and where along it. */
export interface JacketCut {
  end: EndId;
  /** The candidate action's `atMm`, inward from the end of the cable. */
  atMm: number;
  /** The same position as the drawing's offset from the jacket edge — zero at the edge, negative inward. */
  offsetMm: number;
}

/**
 * The end the cable cutters are standing on and where along it they would cut,
 * or null where they are standing on no jacket.
 *
 * Which end is asked of the drawing, never of what happens to be selected:
 * cutters held over end B's jacket are cutting end B.
 */
export function jacketCutTarget(
  x: number,
  y: number,
  cable: CableState,
  scale: number,
  cy: number = CY,
): JacketCut | null {
  if (!overBench(y)) return null;

  for (const id of END_IDS) {
    const field = jacketField(id, cy);
    if (x < field.x || x > field.x + field.width) continue;
    if (y < field.y || y > field.y + field.height) continue;

    const atMm = atMmAt(x, id, cable.ends[id], scale);

    return { end: id, atMm, offsetMm: cable.ends[id].jacketEdgeMm - atMm };
  }

  return null;
}

/** Where a cut at this position is drawn, in the bench's units. */
export function cutXAt(atMm: number, id: EndId, end: CableEnd, scale: number): number {
  const { x0, dir } = LAYOUT[id];

  return x0 + dir * (end.jacketEdgeMm - atMm) * scale;
}
