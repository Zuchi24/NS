import { END_IDS, maxExposed, plugFrontMm } from "../model";
import type { CableEnd, CableState, EndId } from "../model";

/**
 * Where things are on the bench, in the drawing's own units and in
 * millimetres.
 *
 * Pure arithmetic over the model's numbers: no React, no DOM, no rule. It
 * answers "how big is a millimetre here", "which end is this point near" and
 * "how much jacket would a stripper held here take" — questions about the
 * picture, not about whether an action is allowed. That judgment is apply()'s
 * alone (see dryRun).
 *
 * Both ends share one scale. A length at end A and the same length at end B
 * are therefore the same size on screen, which is the comparison a
 * straight-through cable asks a student to make.
 */

/** The drawing's user space. Every layout number here is in these units. */
export const WIDTH = 1000;

export const HEIGHT = 285;

/** The cable's centre line. */
export const CY = 120;

/** The shelf the tools lie on. Above it is the cable; below it, the tools. */
export const SHELF_TOP = 225;

/**
 * How far above and below the centre line the jacket is drawn.
 *
 * The drawing's own half-height, kept here rather than in the component so
 * that a tool hit-testing the jacket and the jacket the student sees are the
 * same band of bench. Nothing may hit-test a jacket of its own.
 */
export const JACKET_HALF = 22;

/** Where each end's jacket edge sits, which way its conductors point, and the half of the bench it owns. */
export const LAYOUT: Record<EndId, { x0: number; dir: 1 | -1; region: [number, number] }> = {
  A: { x0: 205, dir: -1, region: [0, 440] },
  B: { x0: 795, dir: 1, region: [560, WIDTH] },
};

/** Room outward of the jacket edge, before the panel's edge. The same at both ends. */
export const OUTWARD_PX = 171;

/** Room inward of the jacket edge, before the cable body. The same at both ends. */
export const INWARD_PX = 235;

/**
 * How far outward of its jacket edge an end reaches — its longest conductor,
 * or the plug over it, with a margin. The floor keeps a bare end from being
 * drawn at an absurd magnification.
 */
export function endReachMm(end: CableEnd): number {
  const front = plugFrontMm(end);
  const plugReach = front === null ? 0 : end.jacketEdgeMm - front;

  return Math.max(26, maxExposed(end) + 5, plugReach + 5);
}

/**
 * The one scale the whole bench is drawn at, in user units per millimetre,
 * and the reach it was chosen for. Taken from whichever end reaches further,
 * so both fit.
 */
export function benchScale(cable: CableState): { scale: number; reachMm: number } {
  const reachMm = Math.max(...END_IDS.map((id) => endReachMm(cable.ends[id])));

  return { reachMm, scale: Math.min(6, OUTWARD_PX / reachMm) };
}

/** A pointer's position on the page, in the drawing's units. */
export function toUserSpace(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

  return {
    x: ((clientX - rect.left) / rect.width) * WIDTH,
    y: ((clientY - rect.top) / rect.height) * HEIGHT,
  };
}

/**
 * Where a point sits in an end's drawing frame: millimetres outward from that
 * end's jacket edge, negative inward along the jacketed cable.
 */
export function offsetMmAt(userX: number, end: EndId, scale: number): number {
  const { x0, dir } = LAYOUT[end];

  return (userX - x0) / (dir * scale);
}

/**
 * How much jacket a stripper held at this point would take: its distance
 * inward from the jacket edge, in whole millimetres.
 *
 * Never negative — outward of the edge there is no jacket to take. Never
 * capped either: how much is too much is the model's call, not this file's.
 */
export function stripMmAt(userX: number, end: EndId, scale: number): number {
  return Math.max(0, Math.round(-offsetMmAt(userX, end, scale)));
}

/**
 * Whether a point is on the cable part of the bench rather than the shelf the
 * tools lie on, so picking a tool up is not also work on the cable.
 */
export function overBench(userY: number): boolean {
  return userY < SHELF_TOP;
}

/**
 * The stretch of an end's jacketed cable, as it is drawn: from that end's
 * jacket edge inward to where the not-to-scale body begins. Left to right.
 */
export function jacketRun(end: EndId): [number, number] {
  const { x0, dir } = LAYOUT[end];
  const inner = x0 - dir * INWARD_PX;

  return [Math.min(x0, inner), Math.max(x0, inner)];
}

/**
 * The end whose jacketed cable is under this point, or null when there is
 * none.
 *
 * Drawing geometry, not a rule, and not a guess at which half of the bench
 * belongs to whom: an end's jacket is drawn over a known run of the mat, and
 * that run is the only place a stripper can be standing on that end's jacket.
 * Outward of the jacket edge there is bare conductor, between the two ends the
 * cable is drawn out of scale, and below is the shelf — over any of those the
 * tool is on no end, and the bench says nothing rather than quoting a distance
 * from somewhere the tool is not.
 */
export function endUnder(userX: number, userY: number): EndId | null {
  if (!overBench(userY)) return null;

  return END_IDS.find((id) => {
    const [from, to] = jacketRun(id);

    return userX >= from && userX <= to;
  }) ?? null;
}

/** How far a pointer must travel before it is a drag rather than a click. */
export const DRAG_THRESHOLD_PX = 4;

export function passedThreshold(dx: number, dy: number, threshold: number = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) >= threshold;
}
