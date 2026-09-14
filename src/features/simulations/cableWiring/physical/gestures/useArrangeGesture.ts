import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { conductorUnder, insertionAt } from "../conductorGeometry";
import type { ConductorRegion } from "../conductorGeometry";
import type { CableState, Conductor, EndId } from "../../model";

/**
 * Taking a single conductor out of the row and putting it somewhere else in
 * it.
 *
 * R3's own gesture, written for this one job as R1's and R2's were for theirs.
 * The three share what has proved shared — the drawing's units, the drag
 * threshold, pointer capture, Escape — and nothing else.
 *
 * The conductor is whichever one is under the hand when it closes, read off
 * the drawing and not off whatever end happens to be selected. It then stays
 * in the hand: carrying it over another conductor, or over the other end's
 * row, never swaps what is being held. That is the difference from R1's tool,
 * which belongs to whichever end it is standing on — a wire, once picked up,
 * is picked up. And it is picked up by one hand: another finger on the bench
 * cannot offer it to a lane, drop it, or let it go for the hand that holds it.
 *
 * What it produces is a candidate — an end, a conductor and the lane it is
 * being offered to, which is the whole of a move in the model. Whether that
 * move is one the model will make is never decided here: the bench asks while
 * the hand is still down, and the model decides for real on release.
 */

export interface ArrangeDrag {
  /** The conductor in hand, and the end it came out of. Fixed when the hand closed. */
  end: EndId;
  conductor: Conductor;
  /** The lane it came from, so the drawing knows where it is rooted. */
  fromIndex: number;
  /** Where it was taken hold of, and where the hand is now, in the drawing's units. */
  origin: { x: number; y: number };
  at: { x: number; y: number };
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** The lane it is being offered to, or null while the hand is off the row. */
  toIndex: number | null;
}

interface Options {
  cable: CableState;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  /** True while another gesture has the bench, so two are never live at once. */
  blocked?: boolean;
  onCommit: (end: EndId, conductor: Conductor, toIndex: number) => void;
}

export function useArrangeGesture({ cable, scale, surface, blocked = false, onCommit }: Options) {
  const [drag, setDrag] = useState<ArrangeDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<ArrangeDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // Whether the hand that is lifting was dragging, so anything the browser
  // sends afterwards is not taken as a click on the row.
  const dragged = useRef(false);
  // The pointer that picked the conductor up. A second finger elsewhere on the
  // bench is not this hand, and must not offer, drop or let go of what it holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: ArrangeDrag | null) => {
    held.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setDrag(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the conductor. */
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
   * Close a hand on the bench. On a conductor it picks it up; anywhere else —
   * the jacket, the middle of the cable, the shelf, past the tips — nothing is
   * claimed and nothing happens.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // A hand is already holding a conductor: another pointer coming down is
      // not this hand, and changes nothing about the move under way.
      if (held.current !== null) return;

      dragged.current = false;
      if (blocked) return;

      const at = pointIn(event);
      const region: ConductorRegion | null = conductorUnder(at.x, at.y, cable, scale);
      if (region === null) return;

      // No preventDefault: it would suppress the click the browser sends
      // afterwards, and the bench's other paths still want it (R2's lesson).
      // The drawing already carries touch-action: none and select-none.
      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      put({
        end: region.end,
        conductor: region.conductor,
        fromIndex: region.index,
        origin: at,
        at,
        active: false,
        toIndex: null,
      });
    },
    [blocked, cable, pointIn, put, scale, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the conductor offers it to a lane.
      if (current === null || !mine(event)) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      if (active) dragged.current = true;

      // The lane is read from the row the conductor came out of, and only that
      // one. Carrying it over the other end's row offers it nowhere: a
      // conductor cannot move between ends, and quoting a lane there would be
      // describing a move that does not exist.
      const toIndex = active ? insertionAt(at.x, at.y, current.end, cable.ends[current.end], scale) : null;

      put({ ...current, at, active, toIndex });
    },
    [cable, mine, pointIn, put, scale],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the conductor can let go of it.
      if (current !== null && !mine(event)) return;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      put(null);

      // Let go off the row and the conductor simply falls back into the row it
      // came from; nothing is sent, because no lane was ever offered.
      if (current !== null && current.active && current.toIndex !== null) {
        onCommit(current.end, current.conductor, current.toIndex);
      }
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

  // Escape puts the conductor back with nothing sent.
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
    /** Whether the hand that just lifted had been dragging a conductor about. */
    wasDragging: useCallback(() => dragged.current, []),
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
