import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { passedThreshold, toUserSpace } from "../benchGeometry";
import { crimperTarget } from "../crimperGeometry";
import type { CrimperStand } from "../crimperGeometry";
import type { EndId } from "../../model";

/**
 * Picking the crimper up, standing it on a plug, and squeezing.
 *
 * On R4's and R5's pattern, because crimping is the same kind of act as a
 * cut: a heavy tool is carried to the cable, put down where it is wanted, and
 * closed. Letting go of it is not a crimp. It stays standing where it was
 * left, and crimps only when it is squeezed — a separate, deliberate act, so a
 * crimper resting on a plug can never crimp it by itself.
 *
 * A squeeze is a hand coming down on the standing crimper and lifting again
 * without travelling, read off the pointer itself rather than off the click
 * the browser sends afterwards. The bench captures the pointer on the drawing,
 * so in a real browser that click is delivered to the drawing and never to the
 * crimper; a squeeze that waited for it would never happen.
 *
 * Which end is crimped is read off the drawing, from the end the crimper is
 * standing on (see crimperGeometry). The selected end has no say.
 *
 * The crimper on the bench always closes fully: it is squeezed until its
 * ratchet lets go. A half squeeze is still there on the precise controls; the
 * bench does not guess at one from how long a hand was held down.
 *
 * What a squeeze produces is a candidate — an end and a squeeze, which is the
 * whole of a crimp in the model. Whether there is a plug there, whether it is
 * already crimped or plugged into a port, is never decided here: the bench
 * asks while the crimper stands there, and the model decides for real when it
 * closes.
 */

/** How the bench's crimper closes: always fully. */
export const CRIMPER_SQUEEZE = "full" as const;

export interface CrimperHold {
  /** Where the crimper is, in the drawing's units. */
  at: { x: number; y: number };
  /** True while the hand is still on it. */
  held: boolean;
  /** Whether the pointer has travelled far enough for this to be a drag. */
  active: boolean;
  /** True when this gesture picked it up off the shelf rather than off the bench. */
  fromShelf: boolean;
  /**
   * True while the hand is closed on the crimper where it stands, rather than
   * on its spot on the shelf. Lifted again without travelling, that is the
   * squeeze.
   */
  onTool: boolean;
}

interface Options {
  /** User units per millimetre, from benchScale(). */
  scale: number;
  surface: RefObject<SVGSVGElement | null>;
  onCommit: (end: EndId, squeeze: typeof CRIMPER_SQUEEZE) => void;
}

export function useCrimpGesture({ scale, surface, onCommit }: Options) {
  const [crimper, setCrimper] = useState<CrimperHold | null>(null);
  // The crimper is kept in a ref as well, so the pointer handlers can read it
  // without a state updater having to do anything but update state.
  const standing = useRef<CrimperHold | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  // The pointer that took hold of it. A second finger elsewhere on the bench
  // is not this hand, and must not move, drop or squeeze what this one holds.
  const owner = useRef<number | null>(null);

  const put = useCallback((next: CrimperHold | null) => {
    standing.current = next;
    if (next === null) {
      from.current = null;
      owner.current = null;
    }
    setCrimper(next);
  }, []);

  /** Whether an event belongs to the hand that is holding the crimper. */
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

  /** The end the crimper is standing on, if it is standing on one. */
  const target: CrimperStand | null = crimper === null ? null : crimperTarget(crimper.at.x, crimper.at.y, scale);

  /**
   * Close a hand on the crimper. Goes on the tool itself, and stops there:
   * closing a hand on the crimper is not also reaching for the plug, the
   * conductors or the pair underneath it, all of which take their pointer down
   * from the drawing.
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

      // A crimper already standing somewhere stays exactly where it is until
      // the hand actually travels, so a squeeze crimps the end it was shown
      // standing on rather than wherever the hand happened to land.
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

  /** Take the crimper off the shelf — or back off the bench, from its empty spot on the shelf. */
  const takeCrimper = useCallback((event: ReactPointerEvent) => hold(event, false), [hold]);

  /** Close a hand on the crimper where it stands: the start of a squeeze, or of moving it. */
  const pressCrimper = useCallback((event: ReactPointerEvent) => hold(event, true), [hold]);

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
        // A hand that came down on the standing crimper and lifted without
        // travelling squeezed it. The one act that reaches the model. It goes
        // back on the shelf before the action is sent, so nothing is left
        // standing for a second squeeze to close — and it is there to be
        // picked up again for the other end.
        if (current.onTool) {
          const closing = crimperTarget(current.at.x, current.at.y, scale);

          if (closing === null) {
            put({ ...current, held: false, onTool: false });

            return;
          }

          put(null);
          onCommit(closing.end, CRIMPER_SQUEEZE);

          return;
        }

        put(current.fromShelf ? null : { ...current, held: false });

        return;
      }

      // Letting go after carrying it is not a crimp. The crimper stands where
      // it was left if it is over an end, and otherwise goes back on the shelf.
      const landed = crimperTarget(current.at.x, current.at.y, scale);

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

  // Escape puts the crimper back with nothing sent, whether it is in hand or
  // standing on the cable.
  useEffect(() => {
    if (crimper === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") put(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [crimper, put]);

  return {
    crimper,
    target,
    takeCrimper,
    pressCrimper,
    surfaceHandlers: { onPointerMove, onPointerUp, onPointerCancel },
  };
}
