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
 * one row while another row's name is on the gesture. And the pull belongs to
 * the pointer that took hold: another finger on the bench cannot pull it
 * further, let it go, or finish it for the hand that is holding it.
 *
 * A pair can also be tapped: a hand that closes on it and lifts again without
 * travelling. That is read off the same press and release, from the pair the
 * hand took hold of — never off a click, which the captured drawing would take
 * instead of the pair, and never off whatever is under the hand when it lifts.
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
  /**
   * Untwist by tapping a pair: a hand that closes on it and lifts without
   * travelling. Only offered when the bench passes it — while the Untwist tool
   * is out. Without it, a tap does nothing.
   */
  onTap?: (end: EndId, pair: PairId) => void;
  /** Which pair lies in which row on each end, top to bottom — the order the bench draws them in. */
  pairOrders?: Partial<Record<EndId, readonly PairId[]>>;
}

export function useUntwistGesture({ cable, scale, surface, blocked = false, onCommit, onTap, pairOrders }: Options) {
  const [drag, setDrag] = useState<UntwistDrag | null>(null);
  // The drag is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const held = useRef<UntwistDrag | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of the pair. A second finger elsewhere on the
  // bench is not this hand, and must not pull, drop or let go of what it holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: UntwistDrag | null) => {
    held.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setDrag(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the pair. */
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
   * Close a hand on the bench. On a pair it takes hold of it; anywhere else —
   * the jacket, the middle of the cable, the shelf, the gaps between the rows
   * — nothing is claimed and nothing happens.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      // A hand is already holding a pair: another pointer coming down is not
      // this hand, and changes nothing about the pull under way.
      if (blocked || held.current !== null) return;

      const at = pointIn(event);
      const region: PairRegion | null = pairUnder(at.x, at.y, cable, scale, undefined, pairOrders);
      if (region === null) return;

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
    [blocked, cable, pairOrders, pointIn, put, scale, surface],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      if (current === null || !mine(event)) return;

      const at = pointIn(event);
      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

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
    [mine, pointIn, put],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const current = held.current;
      // Only the hand holding the pair can let go of it.
      if (current !== null && !mine(event)) return;

      try {
        surface.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }

      put(null);

      if (current === null) return;

      if (current.active) {
        // A pair let go before it came clear of the bundle simply falls back in.
        if (current.pulling) onCommit(current.end, current.pair);

        return;
      }

      // A hand that closed on a pair and lifted without travelling tapped it —
      // the pair it took hold of, whatever is under the hand now. The hold is
      // already gone, so nothing is left for a second release to tap.
      onTap?.(current.end, current.pair);
    },
    [mine, onCommit, onTap, put, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (held.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

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
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
