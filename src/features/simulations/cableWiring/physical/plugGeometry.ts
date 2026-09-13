import { END_IDS, FRONT_STOP } from "../model";
import type { EndId } from "../model";
import { CY, INWARD_PX, LAYOUT, OUTWARD_PX, offsetMmAt, overBench } from "./benchGeometry";

/**
 * Where a plug held over the bench is, and how far onto the cable it would go.
 *
 * A plug is carried by its rear opening — the end the cable goes into — so
 * wherever the hand is, that is where the rear opening is. Held over an end,
 * the plug lies along that end's axis with its front pointing the way the
 * conductors do, and the rear opening's distance from the jacket edge is how
 * far the jacket would be pushed into it: the model's `pushMm`. The plug's own
 * drawing (EndDetail) puts a seated plug's rear opening at −jacketInMm from the
 * jacket edge, so the same position reads back as the same number.
 *
 * The place a plug can be held over an end is that end's whole panel — the
 * stretch EndDetail draws, from where the jacket run begins out to the panel's
 * edge — as tall as a plug is drawn. It does not depend on what the end is
 * doing: whether a plug can go on (a fan, no plug already there, one left in
 * the tray) and where it would actually stop are the model's answers, asked
 * through dryRun, never this file's.
 *
 * Pure arithmetic, like the rest of the geometry layer, on the bench's one
 * shared scale (see benchGeometry). Orientation plays no part here: which way
 * up a plug is held does not change where it is.
 */

/** Half the height a plug is drawn at, above and below the cable's centre line (see EndDetail). */
export const PLUG_HALF = 38;

/** Slack above and below the drawn plug, so it needs no pixel precision to hold over an end. */
export const PLUG_MARGIN = 8;

/** The stretch of bench a plug can be held over on one end. */
export interface PlugField {
  end: EndId;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One end's panel, as somewhere a plug can be held. The same whatever state the end is in. */
export function plugField(id: EndId, cy: number = CY): PlugField {
  const { x0, dir } = LAYOUT[id];
  const inner = x0 - dir * INWARD_PX;
  const outer = x0 + dir * OUTWARD_PX;

  return {
    end: id,
    x: Math.min(inner, outer),
    width: Math.abs(outer - inner),
    y: cy - PLUG_HALF - PLUG_MARGIN,
    height: 2 * (PLUG_HALF + PLUG_MARGIN),
  };
}

/** A plug held over an end: which end, and how far the jacket would be pushed into it. */
export interface PlugStand {
  end: EndId;
  /**
   * The candidate action's `pushMm`: how far inward of the jacket edge the rear
   * opening is, in whole millimetres. Negative outward of it. Never clamped.
   */
  pushMm: number;
}

/**
 * The end a plug with its rear opening at this point is held over, and the
 * push that position means, or null where it is over no end.
 *
 * Which end is asked of the drawing, never of what happens to be selected.
 */
export function plugTarget(x: number, y: number, scale: number, cy: number = CY): PlugStand | null {
  if (!overBench(y)) return null;

  for (const id of END_IDS) {
    const field = plugField(id, cy);
    if (x < field.x || x > field.x + field.width) continue;
    if (y < field.y || y > field.y + field.height) continue;

    const pushMm = Math.round(-offsetMmAt(x, id, scale));

    // Rounding a small outward distance gives −0; the model's number is 0.
    return { end: id, pushMm: pushMm === 0 ? 0 : pushMm };
  }

  return null;
}

/** Where a plug pushed this far on has its rear opening, in the bench's units. */
export function plugRearXAt(pushMm: number, id: EndId, scale: number): number {
  const { x0, dir } = LAYOUT[id];

  return x0 - dir * pushMm * scale;
}

/** Where the same plug's front face is: a plug's length further out than its rear opening. */
export function plugFrontXAt(pushMm: number, id: EndId, scale: number): number {
  const { x0, dir } = LAYOUT[id];

  return x0 + dir * (FRONT_STOP - pushMm) * scale;
}
