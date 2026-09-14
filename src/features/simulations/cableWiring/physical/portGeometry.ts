import { END_IDS } from "../model";
import type { CableEnd, CableState, EndId, EndpointId } from "../model";
import { CY, LAYOUT, WIDTH } from "./benchGeometry";
import { plugFrontXAt } from "./plugGeometry";

/**
 * The ports a cable can be plugged into, and the lead a plug is carried to one
 * by.
 *
 * The ports are the scenario's endpoints — a tester's MAIN and REMOTE jacks, a
 * PC's network port — laid out in one row along the top of the mat, their
 * mouths facing down toward the cable. Where each one is drawn, where a hand
 * offering a plug to it is, and where a plug sits once it is in, are all read
 * from here, so the port a student sees and the port a gesture names can never
 * be two different ports.
 *
 * A plug on an end is carried to a port by its lead: a handle just past the
 * plug's front face, clear of the conductors inside the plug and of the grip
 * that pushes the plug on or pulls it off. A plug already in a port is pulled
 * out of it by the plug itself, where it sits in the port's mouth.
 *
 * Pure arithmetic, like the rest of the geometry layer. Nothing here knows
 * whether a plug can go into a port, whether a port is free, or which port a
 * challenge wants — which ports exist is the scenario's, which end is in which
 * port is the model's, and whether a connection can be made is the model's
 * answer alone (see dryRun).
 */

/** How far down from the top of the mat the row of ports starts. */
export const PORT_TOP = 6;

/** One port, as drawn. Wide enough for its name. */
export const PORT_WIDTH = 72;

export const PORT_HEIGHT = 30;

/** Space between neighbouring ports. */
export const PORT_GAP = 14;

/** How far below a port's mouth a plug held there is still being offered to that port. */
export const PORT_REACH = 26;

/** A plug seated in a port's mouth, as drawn. */
export const SEATED_WIDTH = 30;

export const SEATED_HEIGHT = 20;

/** Slack round a seated plug, so taking hold of one need not be pixel-perfect. */
export const SEATED_MARGIN = 4;

/**
 * How far a seated plug has to be drawn down out of its port, in the drawing's
 * units, before letting go unplugs it. A deliberate pull, well past the drag
 * threshold, so a hand that merely closed on the plug or wobbled leaves it in.
 * Whether it can come out is the model's answer, not this number's.
 */
export const UNPLUG_PULL = 20;

/** How far past a plug's front face its lead handle starts: clear of the conductor row's own slack. */
export const LEAD_GAP = 24;

/** How long the lead handle is, along the cable. */
export const LEAD_LENGTH = 26;

/** Half the lead handle's height, either side of the cable's centre line. */
export const LEAD_HALF = 12;

/** One port, where it is drawn and where its mouth is. */
export interface PortSlot {
  endpoint: EndpointId;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The middle of the port's mouth, on its bottom edge, where a plug goes in. */
  mouthX: number;
  mouthY: number;
}

/** Every port on the bench, in the scenario's own order, centred along the top of the mat. */
export function portSlots(endpoints: readonly { id: EndpointId }[]): PortSlot[] {
  const total = endpoints.length * PORT_WIDTH + Math.max(0, endpoints.length - 1) * PORT_GAP;
  const left = WIDTH / 2 - total / 2;

  return endpoints.map((endpoint, index) => {
    const x = left + index * (PORT_WIDTH + PORT_GAP);

    return {
      endpoint: endpoint.id,
      x,
      y: PORT_TOP,
      width: PORT_WIDTH,
      height: PORT_HEIGHT,
      mouthX: x + PORT_WIDTH / 2,
      mouthY: PORT_TOP + PORT_HEIGHT,
    };
  });
}

/**
 * The port a plug held at this point is being offered to, or null where it is
 * offered to none: over the port itself, or in the stretch just below its
 * mouth. Whether the plug can go in is never asked here.
 */
export function portUnder(x: number, y: number, endpoints: readonly { id: EndpointId }[]): PortSlot | null {
  for (const slot of portSlots(endpoints)) {
    if (x < slot.x || x > slot.x + slot.width) continue;
    if (y < slot.y || y > slot.mouthY + PORT_REACH) continue;

    return slot;
  }

  return null;
}

/** Where a plug sits once it is in a port: centred in the mouth, hanging below it. */
export function seatedPlugBox(slot: PortSlot): { x: number; y: number; width: number; height: number } {
  return { x: slot.mouthX - SEATED_WIDTH / 2, y: slot.mouthY, width: SEATED_WIDTH, height: SEATED_HEIGHT };
}

/** A plug sitting in a port: which end it is, and which port. */
export interface SeatedPlug {
  end: EndId;
  endpoint: EndpointId;
}

/**
 * The plug sitting in a port under this point, or null. Which end is in which
 * port is the model's `connections`, read and never kept here; the port's
 * position is the scenario's endpoint, laid out above.
 */
export function seatedPlugUnder(
  x: number,
  y: number,
  connections: Partial<Record<EndId, EndpointId>>,
  endpoints: readonly { id: EndpointId }[],
): SeatedPlug | null {
  const slots = portSlots(endpoints);

  for (const id of END_IDS) {
    const endpoint = connections[id];
    if (endpoint === undefined) continue;

    const slot = slots.find((candidate) => candidate.endpoint === endpoint);
    if (slot === undefined) continue;

    const box = seatedPlugBox(slot);
    if (x < box.x - SEATED_MARGIN || x > box.x + box.width + SEATED_MARGIN) continue;
    if (y < box.y - SEATED_MARGIN || y > box.y + box.height + SEATED_MARGIN) continue;

    return { end: id, endpoint };
  }

  return null;
}

/** Whether a seated plug drawn this far down, away from its port, has been pulled out far enough to unplug. */
export function unplugPulled(dy: number, pull: number = UNPLUG_PULL): boolean {
  return dy >= pull;
}

/** A plug's lead, as something a hand can take hold of. */
export interface LeadHandle {
  end: EndId;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Its middle, where a lead drawn to a port starts. */
  cx: number;
  cy: number;
}

/**
 * The lead handle of the plug on one end, or null when there is no plug there.
 * Listed whatever the plug's state — crimped or not, plugged in or not: those
 * are the model's to refuse for, not this file's to leave out.
 */
export function leadHandle(id: EndId, end: CableEnd, scale: number, cy: number = CY): LeadHandle | null {
  if (end.plug === null) return null;

  const { dir } = LAYOUT[id];
  const near = plugFrontXAt(end.plug.jacketInMm, id, scale) + dir * LEAD_GAP;
  const far = near + dir * LEAD_LENGTH;

  return {
    end: id,
    x: Math.min(near, far),
    y: cy - LEAD_HALF,
    width: LEAD_LENGTH,
    height: 2 * LEAD_HALF,
    cx: (near + far) / 2,
    cy,
  };
}

/** The end whose plug's lead handle is under this point, or null. Never the selected end. */
export function leadUnder(x: number, y: number, cable: CableState, scale: number, cy: number = CY): { end: EndId } | null {
  for (const id of END_IDS) {
    const handle = leadHandle(id, cable.ends[id], scale, cy);
    if (handle === null) continue;
    if (x < handle.x || x > handle.x + handle.width) continue;
    if (y < handle.y || y > handle.y + handle.height) continue;

    return { end: id };
  }

  return null;
}
