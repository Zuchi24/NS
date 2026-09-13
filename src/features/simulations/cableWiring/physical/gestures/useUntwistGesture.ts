import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { openness, pairLift, pairUnder, pulledClear, pullAcross, travelAlong } from "../pairGeometry";
import type { PairRegion } from "../pairGeometry";
import type { CableState, EndId, PairId } from "../../model";

/**
 * Taking hold of a twisted pair and pulling it apart.
 *
 * R2's own gesture, written for this one job as R1's was for its own. The two
 * share what has proved shared — the drawing's units, the drag threshold,
 * pointer capture, Escape — and nothing else. What a pull *means* is different
 * enough from what a tool standing on the cable means that folding them into
 * one engine now would be guessing.
 *
 * The pair is whichever pair is under the hand when it closes, read off the
 * drawing and not off whatever end happens to be selected. A hand keeps the
 * pair it took hold of: you do not let go of one pair and find yourself
 * holding another halfway through a pull, so nothing can be shown opening at
 * one row while another row's name is on the gesture.
 *
 * What it produces is a candidate — an end and a pair, which is the whole of
 * an untwist in the model. Whether that pair can be untwisted is never decided
 * here: the bench asks the model while the pull is live, and the model decides
 * for real on release.
 */

export interface UntwistDrag {
  /** The pair in hand. Fixed when the hand closed. */
  end: EndId;
  pair: PairId;
  /** Its row in the bundle, so the drawing knows where it came from. */
  index: number;
  /** Where the pair was taken hold of, and where the hand is now, in the drawing's units. */
  origin: { x: number; y: number };
  at: { x: number; y: number };
  /** Travel from where the pair was taken hold of, in the drawing's units. */
  dx: number;
  dy: number;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** Whether the pair has been pulled clear of the bundle — a candidate untwist. */
  pulling: boolean;
  /** How far the pair is drawn off the bundle, and how far open it is drawn. */
  lift: number;
  openness: number;
}

interface Options {
  cable: CableState;
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  /** True while another gesture has the bench, so two are never live at once. */
  blocked?: boolean;
  onCommit: (end: EndId, pair: PairId) => void;
}

export function useUntwistGesture({ cable, scale, surface, blocked = false, onCommit }: Options) {
  const [drag, setDrag] = useState<UntwistDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<UntwistDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // Whether the hand that is lifting was dragging, so the click the browser
  // sends after it is not also taken as a tap on the pair.
  const dragged = useRef(false);

  const put = useCallback((next: UntwistDrag | null) => {
    held.current = next;
    if (next === null) from.current = null;
    setDrag(next);
  }, []);

  const pointIn = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = surface.current?.getBoundingClientRect();

      return rect ? toUserSpace(event.clientX, event.clientY, rect) : { x: 0, y: 0 };
    },
    [surface],
  );

  /**
   * Close a hand on the bench. On a pair it takes hold of it; anywhere else —
   * the jacket, the middle of the cable, the shelf, the gaps between the rows
   * — nothing is claimed and nothing happens.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      dragged.current = false;
      if (blocked || held.current !== null) return;

      const at = pointIn(event);
      const region: PairRegion | null = pairUnder(at.x, at.y, cable, scale);
      if (region === null) return;

      // No preventDefault here, unlike picking a tool off the shelf: that
      // would suppress the click the browser sends afterwards, and a tap on a
      // pair is still a way to untwist it. Nothing needs preventing anyway —
      // the drawing already carries touch-action: none and select-none.
      from.current = { x: event.clientX, y: event.clientY };

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      put({
        end: region.end,
        pair: region.pair,
        index: region.index,
        origin: at,
        at,
        dx: 0,
        dy: 0,
        active: false,
        pulling: false,
        lift: 0,
        openness: 0,
      });
    },
    [blocked, cable, pointIn, put, scale, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      if (current === null) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

      if (active) dragged.current = true;

      // Travel from where the pair was taken hold of, in the drawing's own
      // units, split into the two that matter: across the cable is the pull,
      // along it counts for nothing.
      const travelled = { x: at.x - current.origin.x, y: at.y - current.origin.y };
      const dx = travelAlong(travelled.x, travelled.y);
      const dy = pullAcross(travelled.x, travelled.y);

      put({
        ...current,
        at,
        dx,
        dy,
        active,
        pulling: active && pulledClear(dx, dy),
        lift: active ? pairLift(dx, dy) : 0,
        openness: active ? openness(dx, dy) : 0,
      });
    },
    [pointIn, put],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      put(null);

      // A pair let go before it came clear of the bundle simply falls back in.
      if (current !== null && current.active && current.pulling) onCommit(current.end, current.pair);
    },
    [onCommit, put, surface],
  );

  const onPointerCancel = useCallback(() => put(null), [put]);

  // Escape lets the pair go with nothing sent.
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
    /** Whether the hand that just lifted had been dragging a pair about. */
    wasDragging: useCallback(() => dragged.current, []),
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
