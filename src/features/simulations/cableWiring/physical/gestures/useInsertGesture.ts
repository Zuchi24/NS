import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { plugTarget } from "../plugGeometry";
import type { PlugStand } from "../plugGeometry";
import type { EndId, Orientation } from "../../model";

/**
 * Taking a plug off the shelf, standing it on an end, turning it over, and
 * pushing it on.
 *
 * R6's own gesture, on R4's and R5's pattern because fitting a plug is the
 * same kind of act as a cut: something is carried to the cable, put down
 * where it is wanted, and then deliberately closed on it. Letting go of the
 * plug is not fitting it. It stands where it was left, showing where it would
 * go and which way up it is, and goes on only when it is pressed — so a plug
 * resting on an end can never fit itself.
 *
 * The press is read off the pointer itself: the hand that came down on the
 * standing plug lifts again without travelling. Never off a click — the bench
 * captures the pointer on the drawing, so in a real browser the click is
 * delivered to the drawing and never to the plug.
 *
 * Which end, and how far on, are read off the drawing (see plugGeometry); the
 * selected end has no say. Which way up is the student's own choice, turned
 * over on the standing plug and kept here until the plug is pressed on.
 *
 * What a press produces is a candidate — an end, an orientation and a push,
 * which is the whole of an insert in the model. Whether the model will fit it,
 * and where it would actually stop, are never decided here: the bench asks
 * while the plug stands there, and the model decides for real when it is
 * pushed on.
 */

export interface PlugHold {
  /** Where the plug's rear opening is, in the drawing's units. */
  at: { x: number; y: number };
  /** True while the hand is still on it. */
  held: boolean;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** True when this gesture took it off the shelf rather than off the bench. */
  fromShelf: boolean;
  /**
   * True while the hand is closed on the plug where it stands, rather than on
   * the shelf. Lifted again without travelling, that is pushing it on.
   */
  onTool: boolean;
  /** Which way up it is held. The student's choice, and nobody else's. */
  orientation: Orientation;
}

interface Options {
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  onCommit: (end: EndId, orientation: Orientation, pushMm: number) => void;
}

export function useInsertGesture({ scale, surface, onCommit }: Options) {
  const [plug, setPlug] = useState<PlugHold | null>(null);
  // The plug is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const standing = useRef<PlugHold | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of it. A second finger elsewhere on the bench
  // is not this hand, and must not move, drop or push on what this one holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: PlugHold | null) => {
    standing.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setPlug(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the plug. */
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

  /** The end the plug is held over and the push that means, if it is over one. */
  const target: PlugStand | null = plug === null ? null : plugTarget(plug.at.x, plug.at.y, scale);

  /**
   * Close a hand on a plug. Goes on the plug itself, and stops there: closing a
   * hand on a plug is not also reaching for the conductor or the pair under it.
   */
  const hold = useCallback(
    (event: ReactPointerEvent, onTool: boolean) => {
      event.stopPropagation();
      // No preventDefault: nothing needs preventing, the drawing already
      // carries touch-action: none and select-none.
      const current = standing.current;

      // Another hand already has it.
      if (current !== null && current.held && !mine(event)) return;

      from.current = { x: event.clientX, y: event.clientY };
      owner.current = typeof event.pointerId === "number" ? event.pointerId : null;

      try {
        surface.current?.setPointerCapture(event.pointerId);
      } catch {
        // No capture available (older engines, jsdom). The drag still works;
        // it just ends if the pointer leaves the drawing.
      }

      // A plug already standing somewhere stays exactly where it is until the
      // hand actually travels, so pushing it on fits it where it was shown
      // rather than wherever the hand happened to land.
      put({
        at: current === null ? pointIn(event) : current.at,
        held: true,
        active: false,
        fromShelf: current === null,
        onTool: onTool && current !== null && !current.held,
        orientation: current?.orientation ?? "contacts-up",
      });
    },
    [mine, pointIn, put, surface],
  );

  /** Take a plug off the shelf — or back off the bench, from the shelf. */
  const takePlug = useCallback((event: ReactPointerEvent) => hold(event, false), [hold]);

  /** Close a hand on the plug where it stands: the start of pushing it on, or of moving it. */
  const pressPlug = useCallback((event: ReactPointerEvent) => hold(event, true), [hold]);

  /**
   * Turn the standing plug over. Only which way up it is changes — nothing is
   * sent, and the plug does not move. Not while a hand is carrying it.
   */
  const flipPlug = useCallback(
    (event: ReactPointerEvent) => {
      event.stopPropagation();
      const current = standing.current;
      if (current === null || current.held) return;

      put({ ...current, orientation: current.orientation === "contacts-up" ? "contacts-down" : "contacts-up" });
    },
    [put],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const current = standing.current;
      if (current === null || !current.held || !mine(event)) return;

      const start = from.current;
      const active =
        current.active || (start !== null && passedThreshold(event.clientX - start.x, event.clientY - start.y));

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
        // A hand that came down on the standing plug and lifted without
        // travelling pushed it on. The one act that reaches the model. The
        // plug leaves the bench before the action is sent, so nothing is left
        // standing for a second press to push on.
        if (current.onTool) {
          const stand = plugTarget(current.at.x, current.at.y, scale);

          if (stand === null) {
            put({ ...current, held: false, onTool: false });

            return;
          }

          put(null);
          onCommit(stand.end, current.orientation, stand.pushMm);

          return;
        }

        put(current.fromShelf ? null : { ...current, held: false });

        return;
      }

      // Letting go after carrying it is not fitting it. The plug stands where
      // it was left if it is over an end, and otherwise goes back on the shelf.
      const landed = plugTarget(current.at.x, current.at.y, scale);

      put(landed === null ? null : { ...current, held: false, active: false, onTool: false });
    },
    [mine, onCommit, put, scale, surface],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent) => {
      if (standing.current !== null && !mine(event)) return;

      put(null);
    },
    [mine, put],
  );

  // Escape puts the plug back with nothing sent, whether it is in hand or
  // standing on an end.
  useEffect(() => {
    if (plug === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [plug, put]);

  return {
    plug,
    target,
    takePlug,
    pressPlug,
    flipPlug,
    surfaceHandlers: { onPointerMove, onPointerUp, onPointerCancel },
  };
}
