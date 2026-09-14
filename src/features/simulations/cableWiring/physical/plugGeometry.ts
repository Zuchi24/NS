import { END_IDS, FRONT_STOP } from "../model";
import type { CableEnd, CableState, EndId, Orientation } from "../model";
import { CY, INWARD_PX, LAYOUT, OUTWARD_PX, offsetMmAt, overBench } from "./benchGeometry";
import { LANE_COUNT, LANE_GAP, laneY } from "./conductorGeometry";

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

    return { end: id, pushMm: pushMmAt(x, id, scale) };
  }

  return null;
}

/**
 * The push a plug's rear opening at this x means on this end: how far inward
 * of the jacket edge it is, in whole millimetres, negative outward of it.
 * Never clamped. The one reading of a plug's position, shared by a plug held
 * over an end and a plug already on one.
 */
export function pushMmAt(x: number, id: EndId, scale: number): number {
  const pushMm = Math.round(-offsetMmAt(x, id, scale));

  // Rounding a small outward distance gives −0; the model's number is 0.
  return pushMm === 0 ? 0 : pushMm;
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

/* ------------------------------------------------------------
   A plug already on an end
   ------------------------------------------------------------ */

/**
 * How far above and below the drawn plug body its grip reaches.
 *
 * A fitted plug encloses the conductor row, and those conductors stay
 * something a hand can take hold of (see conductorRegions): the model is what
 * says they cannot move under a plug. So the plug is taken by its top and
 * bottom edges — the strip of plug above the first lane and below the last,
 * widened by this much — and never by a point that is also over a conductor.
 */
export const PLUG_GRIP = 14;

/**
 * How far a fitted plug has to be drawn back off its seat, in millimetres,
 * before letting go takes it off the cable.
 *
 * A deliberate pull, not a wobble: the drag threshold is under a millimetre at
 * the scales the bench is drawn at, so a hand that merely closed on the plug,
 * or slid it across the cable, is nowhere near. And well short of the plug's
 * own length, so pulling a plug off never means carrying it across the panel.
 * Short of this, a plug let go simply stays where it was. Whether a plug can
 * come off at all is the model's answer, not this number's.
 */
export const WITHDRAW_PULL_MM = 5;

/** A fitted plug as something a hand can take hold of: the plug's length, in two bands. */
export interface PlugGrip {
  end: EndId;
  x: number;
  width: number;
  /** Above the conductor row, then below it. The row itself is never part of the grip. */
  bands: [{ y: number; height: number }, { y: number; height: number }];
}

/**
 * The grip of the plug on one end, or null when there is no plug there to take
 * hold of. Listed whatever the plug's state — crimped, or plugged into a port:
 * those are things the model knows about and refuses for, not something this
 * file may decide by leaving the plug out.
 */
export function plugGrip(id: EndId, end: CableEnd, scale: number, cy: number = CY): PlugGrip | null {
  if (end.plug === null) return null;

  const rear = plugRearXAt(end.plug.jacketInMm, id, scale);
  const front = plugFrontXAt(end.plug.jacketInMm, id, scale);
  const rowTop = laneY(0, cy) - LANE_GAP / 2;
  const rowBottom = laneY(LANE_COUNT - 1, cy) + LANE_GAP / 2;
  const top = cy - PLUG_HALF - PLUG_GRIP;
  const bottom = cy + PLUG_HALF + PLUG_GRIP;

  return {
    end: id,
    x: Math.min(rear, front),
    width: Math.abs(front - rear),
    bands: [
      { y: top, height: rowTop - top },
      { y: rowBottom, height: bottom - rowBottom },
    ],
  };
}

/** A fitted plug a hand has closed on: which end it is on, and how it sits there now. */
export interface FittedPlug {
  end: EndId;
  /** The model's jacketInMm, as the plug sat when the hand closed on it. */
  jacketInMm: number;
  orientation: Orientation;
}

/**
 * The fitted plug whose grip is under a point, or null.
 *
 * Which end is asked of the drawing, never of what happens to be selected. The
 * edges nearest the conductor row belong to the row: a point on the row's own
 * edge is a conductor, not the plug.
 */
export function fittedPlugUnder(x: number, y: number, cable: CableState, scale: number, cy: number = CY): FittedPlug | null {
  for (const id of END_IDS) {
    const end = cable.ends[id];
    const grip = plugGrip(id, end, scale, cy);
    if (grip === null || end.plug === null) continue;
    if (x < grip.x || x > grip.x + grip.width) continue;

    const [above, below] = grip.bands;
    const onAbove = y >= above.y && y < above.y + above.height;
    const onBelow = y > below.y && y <= below.y + below.height;

    if (onAbove || onBelow) return { end: id, jacketInMm: end.plug.jacketInMm, orientation: end.plug.orientation };
  }

  return null;
}

/** What a hand moving a fitted plug is doing with it: pushing it to a position, pulling it off, or neither yet. */
export type PlugMove = { kind: "push"; pushMm: number } | { kind: "withdraw" } | null;

/**
 * What moving a fitted plug this far along its end means.
 *
 * `dx` is the hand's travel across the drawing since it closed on the plug.
 * Only travel along the cable counts, and which way is "on" depends on the
 * end: inward is toward the cable body, whichever side of the bench that is.
 *
 * Any travel inward is a push to where the rear opening now is — the same
 * reading as a plug held over an end (pushMmAt), whether or not it is further
 * than the plug already is; that is the model's call. Travel outward is a pull,
 * and becomes taking the plug off only once it reaches `release`. Nothing here
 * knows whether the plug can move.
 */
export function fittedPlugMove(
  fromMm: number,
  dx: number,
  id: EndId,
  scale: number,
  release: number = WITHDRAW_PULL_MM,
): PlugMove {
  const inwardMm = -dx / (LAYOUT[id].dir * scale);

  if (inwardMm > 0) return { kind: "push", pushMm: pushMmAt(plugRearXAt(fromMm, id, scale) + dx, id, scale) };
  if (-inwardMm >= release) return { kind: "withdraw" };

  return null;
}
