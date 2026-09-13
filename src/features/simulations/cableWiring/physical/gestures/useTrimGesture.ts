import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { cutterTarget } from "../cutterGeometry";
import type { CableState, EndId } from "../../model";

/**
 * Picking the cutters up, standing them across the conductors, and squeezing.
 *
 * R4's own gesture, written for this one job as the three before it were. The
 * four share what has proved shared — the drawing's units, the drag threshold,
 * pointer capture, Escape — and nothing else. (That shell is now visibly the
 * same four times over; extracting it is its own task, not this one.)
 *
 * The difference from R1's stripper is the whole point of R4: letting go of a
 * stripper is the strip, but letting go of the cutters only puts them down.
 * They stay standing where they were left, showing what they would take, and
 * cut when they are squeezed — a separate, deliberate act. Positioning never
 * touches the cable.
 *
 * What a squeeze produces is a candidate — an end and a number of millimetres
 * to leave, which is the whole of a trim in the model. Whether that cut is one
 * the model will make is never decided here: the bench asks while the cutters
 * stand there, and the model decides for real when they close.
 */

export interface CutterHold {
  /** Where the cutters are, in the drawing's units. */
  at: { x: number; y: number };
  /** True while the hand is still on them. */
  held: boolean;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** True when this gesture picked them up off the shelf rather than off the bench. */
  fromShelf: boolean;
}

interface Options {
  cable: CableState;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  onCommit: (end: EndId, leaveMm: number) => void;
}

export function useTrimGesture({ cable, scale, surface, onCommit }: Options) {
  const [cutters, setCutters] = useState<CutterHold | null>(null);
  // The cutters are kept in a ref as well, so the pointer handlers can read
  // them without a state updater having to do anything but update state.
  const standing = useRef<CutterHold | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // Whether the hand that is lifting was dragging, so the click the browser
  // sends afterwards is not also taken as a squeeze.
  const dragged = useRef(false);

  const put = useCallback((next: CutterHold | null) => {
    standing.current = next;
    if (next === null) from.current = null;
    setCutters(next);
  }, []);

  const pointIn = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = surface.current?.getBoundingClientRect();

      return rect ? toUserSpace(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    },
    [surface],
  );

  /** What the cutters are standing on, if they are standing on anything. */
  const target = cutters === null ? null : cutterTarget(cutters.at.x, cutters.at.y, cable, scale);

  /**
   * Take hold of the cutters — off the shelf, or off the bench where they were
   * left. Goes on the tool itself, and stops there: closing a hand on the
   * cutters is not also reaching for whatever is underneath them.
   */
  const takeCutters = useCallback(
    (event: ReactPointerEvent) => {
      event.stopPropagation();
      // No preventDefault: it would suppress the click the browser sends
      // afterwards, and that click is how the cutters are squeezed (R2's
      // lesson). The drawing already carries touch-action: none and
      // select-none.
      const current = standing.current;

      dragged.current = false;
      from.current = { x: event.clientX, y: event.clientY };

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      // Cutters already standing somewhere stay exactly where they are until
      // the hand actually travels, so a squeeze cuts where the line was drawn
      // rather than wherever the click happened to land.
      put({
        at: current === null ? pointIn(event) : current.at,
        held: true,
        active: false,
        fromShelf: current === null,
      });
    },
    [pointIn, put, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;
      if (current === null || !current.held) return;

      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      if (active) dragged.current = true;

      put({ ...current, at: active ? pointIn(event) : current.at, active });
    },
    [pointIn, put],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      if (current === null || !current.held) return;

      // Letting go is not a cut. The cutters stand where they were left if
      // there is conductor under them, and otherwise go back on the shelf.
      if (!current.active) {
        put(current.fromShelf ? null : { ...current, held: false });

        return;
      }

      const landed = cutterTarget(current.at.x, current.at.y, cable, scale);

      put(landed === null ? null : { ...current, held: false, active: false });
    },
    [cable, put, scale, surface],
  );

  const onPointerCancel = useCallback(() => put(null), [put]);

  /**
   * Squeeze the cutters. The one act that reaches the model, and only ever
   * from a hand that came down and up on the cutters without dragging them.
   */
  const squeeze = useCallback(() => {
    const current = standing.current;

    if (dragged.current || current === null || current.held || target === null) return;

    onCommit(target.end, target.leaveMm);
    put(null);
  }, [onCommit, put, target]);

  // Escape puts the cutters back with nothing sent, whether they are in hand
  // or standing on the cable.
  useEffect(() => {
    if (cutters === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cutters, put]);

  return {
    cutters,
    target,
    takeCutters,
    squeeze,
    /** Whether the hand that just lifted had been dragging the cutters about. */
    wasDragging: useCallback(() => dragged.current, []),
    surfaceHandlers: { onPointerMove, onPointerUp, onPointerCancel },
  };
}
