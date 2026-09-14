import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { endUnder, passedThreshold, stripMmAt, toUserSpace } from "../benchGeometry";
import type { EndId, StripSlot } from "../../model";

/**
 * Picking up a stripper and dragging it onto the cable.
 *
 * One gesture, deliberately written for this one job rather than as a
 * framework: the second action will show what a shared primitive should
 * actually look like, and guessing now would cost more than rewriting later.
 *
 * The end being worked on is the one the tool is physically standing on: the
 * stripper takes jacket off whichever end's jacket it is over. Over the
 * conductors, the out-of-scale middle or the shelf it is on no end, and it says
 * so — it does not remember an end it has left. It never quotes a distance
 * measured from an end the tool is not on.
 *
 * Letting go is the strip, but only where it is let go on a jacket. A stripper
 * carried back to the shelf, or put down anywhere else off the cable, is simply
 * put down: nothing is sent, however far over a jacket it went on the way.
 *
 * What it produces is a candidate — an end, a jaw and a number of millimetres.
 * Whether that candidate is possible is never decided here: the bench asks the
 * model while the drag is live, and the model decides for real on release.
 *
 * Pointer events, so mouse, pen and touch are one code path. The pointer is
 * captured on the bench itself, so a drag that wanders off the drawing still
 * arrives here. The stripper belongs to the pointer that picked it up: another
 * finger on the bench cannot move it, put it down, or let go of it for the
 * hand that is holding it.
 */

export interface StripDrag {
  /** Which jaw was picked up. The student chose it by taking that tool. */
  slot: StripSlot;
  /** Where the stripper is, in the drawing's units. */
  at: { x: number; y: number };
  /** The end the tool is working on, or null while it is on neither. */
  end: EndId | null;
  /** How much jacket it would take. Zero while it is on no end. */
  amountMm: number;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
}

interface Options {
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  onCommit: (end: EndId, amountMm: number, slot: StripSlot) => void;
}

export function useStripGesture({ scale, surface, onCommit }: Options) {
  const [drag, setDrag] = useState<StripDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<StripDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that picked the stripper up. A second finger elsewhere on the
  // bench is not this hand, and must not move, drop or let go of what it holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: StripDrag | null) => {
    held.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setDrag(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the stripper. */
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
   * Pick up a stripper. Goes on the tool itself, so the jaw comes with the
   * gesture, and stops there: taking a tool off the shelf is not also a hand on
   * the bench.
   */
  const takeTool = useCallback(
    (slot: StripSlot) => (event: ReactPointerEvent) => {
      event.stopPropagation();
      event.preventDefault();

      // Another hand already has a stripper.
      if (held.current !== null && !mine(event)) return;

      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      put({ slot, at: pointIn(event), end: null, amountMm: 0, active: false });
    },
    [mine, pointIn, put, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      if (current === null || !mine(event)) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      // The tool's own position picks the end, and only while it is on that
      // end's jacket: the reading is always what letting go here would do.
      const end = endUnder(at.x, at.y);

      put({ ...current, at, active, end, amountMm: end === null ? 0 : stripMmAt(at.x, end, scale) });
    },
    [mine, pointIn, put, scale],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the stripper can let go of it.
      if (current !== null && !mine(event)) return;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      put(null);

      if (current === null || !current.active) return;

      // The strip is taken where the stripper is let go, and only if it is let
      // go on a jacket. No physical target there, no strip — whichever jacket
      // it passed over on the way.
      const at = pointIn(event);
      const end = endUnder(at.x, at.y);
      if (end === null) return;

      const amountMm = stripMmAt(at.x, end, scale);
      if (amountMm > 0) onCommit(end, amountMm, current.slot);
    },
    [mine, onCommit, pointIn, put, scale, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (held.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

  // Escape puts the tool down with nothing sent.
  useEffect(() => {
    if (drag === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag, put]);

  return { drag, takeTool, surfaceHandlers: { onPointerMove, onPointerUp, onPointerCancel } };
}
