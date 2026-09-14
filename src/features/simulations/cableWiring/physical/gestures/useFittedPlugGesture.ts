import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { fittedPlugMove, fittedPlugUnder } from "../plugGeometry";
import type { PlugMove } from "../plugGeometry";
import type { CableState, EndId, Orientation } from "../../model";

/**
 * Taking hold of a plug already on an end, and pushing it further on or
 * pulling it off.
 *
 * Its own gesture, on the pattern of R2's and R3's: the hand closes on
 * something drawn on the cable, moves, and lets go, and letting go is the one
 * act that reaches the model. They share what has proved shared — the
 * drawing's units, the drag threshold, pointer capture, Escape, the pointer
 * that owns the hold — and nothing else.
 *
 * The plug is whichever plug's grip is under the hand when it closes, read off
 * the drawing and not off whatever end happens to be selected (see
 * fittedPlugUnder). It then stays the plug in hand: carrying the hand over the
 * other end never swaps which plug is being moved. And it is held by one hand:
 * another finger on the bench cannot move it, let it go, or cancel it for the
 * hand that holds it.
 *
 * The plug only slides along its own end. Moving it inward is a push to where
 * its rear opening now is — the same reading INSERT takes of a plug held over
 * an end. Moving it outward is a pull, and becomes taking it off once it has
 * been drawn back far enough (see fittedPlugMove); short of that, letting go
 * leaves it where it was, and nothing is sent.
 *
 * What it produces is a candidate — an end and a push, or an end to pull the
 * plug off — which is the whole of a push or a withdraw in the model. Whether
 * the plug can move, how far it would really go, and whether it can come off
 * are never decided here: the bench asks while the hand is on the plug, and
 * the model decides for real on release.
 */

export interface FittedPlugDrag {
  /** The end the plug in hand is on. Fixed when the hand closed. */
  end: EndId;
  /** Which way up it is, as it was when the hand closed — for drawing it. */
  orientation: Orientation;
  /** Where it sat when the hand closed: the model's jacketInMm then. */
  fromMm: number;
  /** Where the hand closed, and where it is now, in the drawing's units. */
  origin: { x: number; y: number };
  at: { x: number; y: number };
  /** Travel across the drawing since the hand closed; only travel along the cable moves the plug. */
  dx: number;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** The candidate letting go here would send, or null while it would send nothing. */
  move: PlugMove;
}

interface Options {
  cable: CableState;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  /** True while another gesture has the bench, so two are never live at once. */
  blocked?: boolean;
  /** Without either callback the bench offers no way to move a fitted plug, and none is taken hold of. */
  onPush?: (end: EndId, pushMm: number) => void;
  onWithdraw?: (end: EndId) => void;
}

export function useFittedPlugGesture({ cable, scale, surface, blocked = false, onPush, onWithdraw }: Options) {
  const [drag, setDrag] = useState<FittedPlugDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<FittedPlugDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of the plug. A second finger elsewhere on the
  // bench is not this hand, and must not move, drop or let go of what it holds.
  const owner = useRef<number | null>(null);
  const offered = onPush !== undefined || onWithdraw !== undefined;

  const put = useCallback((next: FittedPlugDrag | null) => {
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
   * Close a hand on the bench. On a fitted plug's grip it takes hold of that
   * plug; anywhere else — the conductors inside it included — nothing is
   * claimed here and nothing happens.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // A hand is already holding a plug: another pointer coming down is not
      // this hand, and changes nothing about the move under way.
      if (!offered || blocked || held.current !== null) return;

      const at = pointIn(event);
      const plug = fittedPlugUnder(at.x, at.y, cable, scale);
      if (plug === null) return;

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

      put({
        end: plug.end,
        orientation: plug.orientation,
        fromMm: plug.jacketInMm,
        origin: at,
        at,
        dx: 0,
        active: false,
        move: null,
      });
    },
    [blocked, cable, offered, pointIn, put, scale, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the plug moves it.
      if (current === null || !mine(event)) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));
      const dx = at.x - current.origin.x;

      put({
        ...current,
        at,
        dx,
        active,
        move: active ? fittedPlugMove(current.fromMm, dx, current.end, scale) : null,
      });
    },
    [mine, pointIn, put, scale],
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

      if (current === null || !current.active || current.move === null) return;

      // What is sent is the candidate the bench was showing, not a fresh reading.
      if (current.move.kind === "push") onPush?.(current.end, current.move.pushMm);
      else onWithdraw?.(current.end);
    },
    [mine, onPush, onWithdraw, put, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (held.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

  // Escape lets the plug go where it was, with nothing sent.
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
    /** Whether the bench offers a way to move a fitted plug at all. */
    offered,
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
