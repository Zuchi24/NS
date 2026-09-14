import { CONTACT_LINE } from "../model";
import type { CableEnd, EndId } from "../model";
import { CY, LAYOUT } from "./benchGeometry";
import { plugRearXAt, plugTarget } from "./plugGeometry";

/**
 * Where the crimper can stand, and where it is drawn standing.
 *
 * A crimper closes on a plug, and a plug is held over an end in one place: that
 * end's panel (see plugField). So the crimper stands on whichever end's panel
 * it is put down over — the very stretch a plug held there would be over, read
 * by the very same function, so a crimper and the plug it closes on can never
 * disagree about which end they are on.
 *
 * It does not depend on what the end is doing. Over an end with no plug, a
 * plug already crimped, or a plug plugged into a port, the crimper stands there
 * all the same, and squeezing it asks the model — which is the only place that
 * knows whether there is anything to crimp.
 *
 * Pure arithmetic, like the rest of the geometry layer.
 */

/** The end a crimper put down here stands on. */
export interface CrimperStand {
  end: EndId;
}

/** The end a crimper at this point stands on, or null where it stands on none. Never the selected end. */
export function crimperTarget(x: number, y: number, scale: number, cy: number = CY): CrimperStand | null {
  const stand = plugTarget(x, y, scale, cy);

  return stand === null ? null : { end: stand.end };
}

/**
 * Where the crimper's die is drawn while it stands on an end: across the blade
 * line of the plug on that end, where a real crimper's teeth close, or where it
 * was put down when there is no plug to close on. Picture only — which end it
 * crimps is `crimperTarget`, and whether it can is the model's.
 */
export function crimpDieXAt(id: EndId, end: CableEnd, scale: number, atX: number): number {
  if (end.plug === null) return atX;

  return plugRearXAt(end.plug.jacketInMm, id, scale) + LAYOUT[id].dir * CONTACT_LINE * scale;
}
