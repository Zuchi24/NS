import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { jacketCutTarget } from "../jacketCutGeometry";
import type { JacketCut } from "../jacketCutGeometry";
import type { CableState, EndId } from "../../model";

/**
 * Picking the cable cutters up, standing them across the jacket, and
 * squeezing.
 *
 * R5's own gesture, on R4's pattern because a cut is the same kind of act as a
 * trim: a heavy tool is carried to the cable, put down where it is wanted, and
 * closed. Letting go of it is not a cut. It stays standing where it was left,
 * showing the line it would cut on and what would come off, and cuts only when
 * it is squeezed — a separate, deliberate act, so cutters resting on the cable
 * can never take a cable off by themselves. Positioning never touches the
 * model.
 *
 * A squeeze is a hand coming down on the standing cutters and lifting again
 * without travelling, read off the pointer itself rather than off the click
 * the browser sends afterwards. The bench captures the pointer on the drawing,
 * so in a real browser that click is delivered to the drawing and never to the
 * cutters; a squeeze that waited for it would never happen.
 *
 * Which end is being cut is read off the drawing, from the jacket the cutters
 * are actually standing on (see jacketCutGeometry). The selected end has no
 * say: cutters standing on end B cut end B while end A is selected, and the
 * other way round.
 *
 * What a squeeze produces is a candidate — an end and a position along the
 * cable, which is the whole of a cut in the model. Whether the model will make
 * that cut is never decided here: the bench asks while the cutters stand there,
 * and the model decides for real when they close.
 */

export interface CableCutterHold {
  /** Where the cutters are, in the drawing's units. */
  at: { x: number; y: number };
  /** True while the hand is still on them. */
  held: boolean;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** True when this gesture picked them up off the shelf rather than off the bench. */
  fromShelf: boolean;
  /**
   * True while the hand is closed on the cutters where they stand, rather than
   * on their spot on the shelf. Lifted again without travelling, that is the
   * squeeze.
   */
  onTool: boolean;
}

interface Options {
  cable: CableState;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  onCommit: (end: EndId, atMm: number) => void;
}

export function useCutGesture({ cable, scale, surface, onCommit }: Options) {
  const [cutters, setCutters] = useState<CableCutterHold | null>(null);
  // The cutters are kept in a ref as well, so the pointer handlers can read
  // them without a state updater having to do anything but update state.
  const standing = useRef<CableCutterHold | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // Whether the hand that is lifting was dragging the cutters about.
  const dragged = useRef(false);
  // The pointer that took hold of them. A second finger elsewhere on the bench
  // is not this hand, and must not move, drop or squeeze what this one holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: CableCutterHold | null) => {
    standing.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setCutters(next);
  }, []);

  /** Whether an event belongs to the hand that is carrying the cutters. */
  const mine = useCallback((event: { pointerId?: number }) => {
    const held = owner.current;

    return held === null || typeof event.pointerId !== "number" || event.pointerId === held;
  }, []);

  const pointIn = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = surface.current?.getBoundingClientRect();

      return rect ? toUserSpace(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    },
    [surface],
  );

  /** The jacket the cutters are standing on, if they are standing on any. */
  const target: JacketCut | null =
    cutters === null ? null : jacketCutTarget(cutters.at.x, cutters.at.y, cable, scale);

  /**
   * Close a hand on the cable cutters.
   *
   * Goes on the tool itself, and stops there: closing a hand on the cutters is
   * not also reaching for the pair, the conductor or the end underneath them,
   * all of which take their pointer down from the drawing.
   */
  const hold = useCallback(
    (event: ReactPointerEvent, onTool: boolean) => {
      event.stopPropagation();
      // No preventDefault: nothing needs preventing, the drawing already
      // carries touch-action: none and select-none.
      const current = standing.current;

      // Another hand already has them.
      if (current !== null && current.held && !mine(event)) return;

      dragged.current = false;
      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      // Cutters already standing somewhere stay exactly where they are until
      // the hand actually travels, so a squeeze cuts where the line was drawn
      // rather than wherever the hand happened to land.
      put({
        at: current === null ? pointIn(event) : current.at,
        held: true,
        active: false,
        fromShelf: current === null,
        onTool: onTool && current !== null && !current.held,
      });
    },
    [mine, pointIn, put, surface],
  );

  /** Take the cable cutters off the shelf — or back off the bench, from their empty spot on the shelf. */
  const takeCutters = useCallback((event: ReactPointerEvent) => hold(event, false), [hold]);

  /** Close a hand on the cable cutters where they are: the start of a squeeze, or of moving them. */
  const pressCutters = useCallback((event: ReactPointerEvent) => hold(event, true), [hold]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;
      if (current === null || !current.held || !mine(event)) return;

      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      if (active) dragged.current = true;

      put({ ...current, at: active ? pointIn(event) : current.at, active });
    },
    [mine, pointIn, put],
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
        // A hand that came down on the standing cutters and lifted without
        // travelling squeezed them. The one act that reaches the model. They
        // leave the cable before the action is sent, so nothing is left
        // standing for a second squeeze to close.
        if (current.onTool) {
          const closing = jacketCutTarget(current.at.x, current.at.y, cable, scale);

          if (closing === null) {
            put({ ...current, held: false, onTool: false });

            return;
          }

          put(null);
          onCommit(closing.end, closing.atMm);

          return;
        }

        put(current.fromShelf ? null : { ...current, held: false });

        return;
      }

      // Letting go after carrying them is not a cut. The cutters stand where
      // they were left if there is jacket under them, and otherwise go back on
      // the shelf.
      const landed = jacketCutTarget(current.at.x, current.at.y, cable, scale);

      put(landed === null ? null : { ...current, held: false, active: false, onTool: false });
    },
    [cable, mine, onCommit, put, scale, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (standing.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

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
    pressCutters,
    /** Whether the hand that just lifted had been dragging the cutters about. */
    wasDragging: useCallback(() => dragged.current, []),
    surfaceHandlers: { onPointerMove, onPointerUp, onPointerCancel },
  };
}
