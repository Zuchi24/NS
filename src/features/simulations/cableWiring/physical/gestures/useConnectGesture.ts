import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { leadUnder, portUnder } from "../portGeometry";
import type { CableState, EndId, EndpointId } from "../../model";

/**
 * Carrying a plug's lead to a port, holding it there, and pressing it in.
 *
 * On R6's pattern, because plugging a cable in is the same kind of act as
 * fitting a plug: something is carried to where it goes, held there, and then
 * deliberately pushed home. Letting go of the lead is not plugging it in. It
 * stays at the port it was let go at, showing which port and what the model
 * says about it, and goes in only when it is pressed — so a lead resting at a
 * port can never plug itself in.
 *
 * The press is read off the pointer itself: the hand that came down on the
 * waiting lead lifts again without travelling. Never off a click — the bench
 * captures the pointer on the drawing, so in a real browser the click is
 * delivered to the drawing and never to the lead.
 *
 * Which end is read off the drawing, from the lead handle the hand took hold
 * of, and fixed from then on. Which port is read off the drawing too, from
 * where the lead was let go, and fixed while it waits there — a press lands
 * wherever on the waiting lead the hand comes down, and still plugs into the
 * port it was shown at. The selected end has no say in either.
 *
 * What a press produces is a candidate — an end and an endpoint, which is the
 * whole of a connect in the model. Whether there is a plug, whether the end is
 * already plugged in, whether the port is free, and what plugging in there
 * would mean for a link or a test, are never decided here: the bench asks
 * while the lead waits, and the model decides for real when it is pressed.
 */

export interface LeadHold {
  /** The end whose plug's lead this is. Fixed when the hand took hold of it. */
  end: EndId;
  /** Where the hand is, or where the lead was left, in the drawing's units. */
  at: { x: number; y: number };
  /** True while a hand is on it. */
  held: boolean;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /**
   * True while the hand is closed on the lead where it waits at a port, rather
   * than on a plug's lead handle. Lifted again without travelling, that is
   * pressing it in.
   */
  onTool: boolean;
  /** The port it is being offered to, or null while it is offered to none. */
  endpoint: EndpointId | null;
}

interface Options {
  cable: CableState;
  /** The scenario's endpoints: the ports there are. */
  endpoints: readonly { id: EndpointId }[];
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  /** True while another gesture has the bench, so two are never live at once. */
  blocked?: boolean;
  /** Without it the bench offers no lead to carry, and none is taken hold of. */
  onCommit?: (end: EndId, endpoint: EndpointId) => void;
}

export function useConnectGesture({ cable, endpoints, scale, surface, blocked = false, onCommit }: Options) {
  const [lead, setLead] = useState<LeadHold | null>(null);
  // The lead is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const standing = useRef<LeadHold | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of it. A second finger elsewhere on the bench
  // is not this hand, and must not move, drop, press or let go of what it holds.
  const owner = useRef<number | null>(null);
  const offered = onCommit !== undefined;

  const put = useCallback((next: LeadHold | null) => {
    standing.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setLead(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the lead. */
  const mine = useCallback((event: { pointerId?: number }) => {
    const holder = owner.current;

    return holder === null || typeof event.pointerId !== "number" || event.pointerId === holder;
  }, []);

  const pointIn = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = surface.current?.getBoundingClientRect();

      return rect ? toUserSpace(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    },
    [surface],
  );

  const claim = useCallback(
    (event: ReactPointerEvent) => {
      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }
    },
    [surface],
  );

  /**
   * Close a hand on the bench. On a plug's lead handle it takes hold of that
   * plug's lead; anywhere else nothing is claimed here. A lead left waiting at
   * a port is put back when another lead is taken up.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // A hand is already on a lead: another pointer coming down is not this
      // hand, and changes nothing about the lead it holds.
      if (!offered || blocked || standing.current?.held) return;

      const at = pointIn(event);
      const hit = leadUnder(at.x, at.y, cable, scale);
      if (hit === null) return;

      claim(event);
      put({ end: hit.end, at, held: true, active: false, onTool: false, endpoint: null });
    },
    [blocked, cable, claim, offered, pointIn, put, scale],
  );

  /**
   * Close a hand on the lead where it waits at a port: the start of pressing
   * it in, or of carrying it somewhere else. Goes on the lead itself, and stops
   * there: it is not also a hand on whatever is under it.
   */
  const pressLead = useCallback(
    (event: ReactPointerEvent) => {
      event.stopPropagation();
      const current = standing.current;

      // Nothing waiting, or another hand already has it.
      if (current === null || current.held) return;

      claim(event);
      // The lead stays exactly where it waits until the hand actually travels,
      // so pressing it in plugs into the port it was shown at.
      put({ ...current, held: true, active: false, onTool: true });
    },
    [claim, put],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;
      if (current === null || !current.held || !mine(event)) return;

      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));
      if (!active) return;

      // The port is read from where the lead is now, and only while it is
      // being carried: a lead waiting at a port keeps that port.
      const at = pointIn(event);

      put({ ...current, at, active, endpoint: portUnder(at.x, at.y, endpoints)?.endpoint ?? null });
    },
    [endpoints, mine, pointIn, put],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;
      if (current !== null && !mine(event)) return;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      if (current === null || !current.held) return;

      if (!current.active) {
        // A hand that came down on the waiting lead and lifted without
        // travelling pressed it in. The one act that reaches the model. The
        // lead is let go before the action is sent, so nothing is left
        // waiting for a second press to plug in.
        if (current.onTool && current.endpoint !== null) {
          const { end, endpoint } = current;

          put(null);
          onCommit?.(end, endpoint);

          return;
        }

        // A hand that closed on a plug's lead and lifted without carrying it
        // anywhere simply lets it go back.
        put(null);

        return;
      }

      // Letting go after carrying it is not plugging it in. The lead waits at
      // the port it was let go at, and otherwise goes back to its plug.
      put(current.endpoint === null ? null : { ...current, held: false, active: false, onTool: false });
    },
    [mine, onCommit, put, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (standing.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

  // Escape lets the lead go back to its plug with nothing sent, whether it is
  // in hand or waiting at a port.
  useEffect(() => {
    if (lead === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lead, put]);

  return {
    lead,
    /** Whether the bench offers a way to plug a cable in at all. */
    offered,
    pressLead,
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
