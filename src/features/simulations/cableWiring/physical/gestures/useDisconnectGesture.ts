import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { seatedPlugUnder, unplugPulled } from "../portGeometry";
import type { CableState, EndId, EndpointId } from "../../model";

/**
 * Taking hold of a plug that is in a port, and pulling it out.
 *
 * On the pattern of the plug already on an end (PUSH/WITHDRAW): the hand
 * closes on something drawn on the bench, moves it, and lets go, and letting
 * go is the one act that reaches the model. A plug comes out of a port by
 * being pulled away from it — down, away from the port's mouth, toward the
 * cable — and only once it has been pulled far enough (see unplugPulled).
 * Short of that, letting go leaves it in, and nothing is sent.
 *
 * The plug is whichever plug is sitting under the hand when it closes, read
 * off the drawing and the model's own connections — never off whatever end
 * happens to be selected. It then stays the plug in hand: carrying the hand
 * over another port never swaps which plug is being pulled. And it is held by
 * one hand: another finger on the bench cannot pull it, let it go, or cancel
 * it for the hand that holds it.
 *
 * What it produces is a candidate — an end, which is the whole of a disconnect
 * in the model. Whether that end can be unplugged is never decided here: the
 * bench asks while the hand is pulling, and the model decides for real on
 * release.
 */

export interface UnplugDrag {
  /** The end whose plug is in hand, and the port it is being pulled out of. Fixed when the hand closed. */
  end: EndId;
  endpoint: EndpointId;
  /** Where the hand closed, and where it is now, in the drawing's units. */
  origin: { x: number; y: number };
  at: { x: number; y: number };
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** Whether the plug has been pulled far enough out for letting go to unplug it. */
  pulled: boolean;
}

interface Options {
  cable: CableState;
  /** The scenario's endpoints: the ports there are. */
  endpoints: readonly { id: EndpointId }[];
  surface: RefObject<SVGSVGElement | null>;
  /** True while another gesture has the bench, so two are never live at once. */
  blocked?: boolean;
  /** Without it the bench offers no way to pull a plug out, and none is taken hold of. */
  onCommit?: (end: EndId) => void;
}

export function useDisconnectGesture({ cable, endpoints, surface, blocked = false, onCommit }: Options) {
  const [drag, setDrag] = useState<UnplugDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<UnplugDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of the plug. A second finger elsewhere on the
  // bench is not this hand, and must not pull, drop or let go of what it holds.
  const owner = useRef<number | null>(null);
  const offered = onCommit !== undefined;

  const put = useCallback((next: UnplugDrag | null) => {
    held.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setDrag(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the plug. */
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

  /**
   * Close a hand on the bench. On a plug sitting in a port it takes hold of
   * that plug; anywhere else nothing is claimed here.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // A hand is already pulling a plug: another pointer coming down is not
      // this hand, and changes nothing about the pull under way.
      if (!offered || blocked || held.current !== null) return;

      const at = pointIn(event);
      const seated = seatedPlugUnder(at.x, at.y, cable.connections, endpoints);
      if (seated === null) return;

      // No preventDefault: nothing needs preventing — the drawing already
      // carries touch-action: none and select-none.
      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      put({ end: seated.end, endpoint: seated.endpoint, origin: at, at, active: false, pulled: false });
    },
    [blocked, cable, endpoints, offered, pointIn, put, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the plug pulls it.
      if (current === null || !mine(event)) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      put({ ...current, at, active, pulled: active && unplugPulled(at.y - current.origin.y) });
    },
    [mine, pointIn, put],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the plug can let go of it.
      if (current !== null && !mine(event)) return;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      // The hold is gone before anything is sent, so nothing is left for a
      // second release to send again.
      put(null);

      // A plug let go before it was pulled far enough simply stays in.
      if (current !== null && current.active && current.pulled) onCommit?.(current.end);
    },
    [mine, onCommit, put, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (held.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

  // Escape lets the plug go back into its port, with nothing sent.
  useEffect(() => {
    if (drag === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag, put]);

  return {
    drag,
    /** Whether the bench offers a way to pull a plug out of a port at all. */
    offered,
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
