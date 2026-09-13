import type { PointerEvent as ReactPointerEvent } from "react";

import { SHELF_TOP } from "../benchGeometry";

/**
 * The flush cutters, lying on the shelf beside the strippers.
 *
 * Drawn with their cutting edge at the tool's own origin, so wherever they are
 * put down the blade sits exactly on the line the bench draws — the tool and
 * the measurement can never disagree. The handles reach away from the jacket,
 * over the offcut, so the conductor that would be left stays in view.
 *
 * Nothing here says where they ought to be put.
 */

/** Where the cutters lie on the shelf, clear of both strippers. */
export const CUTTER_SHELF_X = 660;

const GLYPH_W = 96;
const GLYPH_CY = SHELF_TOP + 22;
const LABEL_Y = SHELF_TOP + 52;

interface ShelfProps {
  onTake: (event: ReactPointerEvent) => void;
  /** True while they are off the shelf, drawn in their place as a faint outline. */
  lifted: boolean;
}

export function CutterShelfTool({ onTake, lifted }: ShelfProps) {
  return (
    <g data-testid="cutters-tool" data-lifted={lifted}>
      {/* A padded grab area, so the tool stays easy to take at any bench size. */}
      <rect
        data-testid="take-cutters"
        x={CUTTER_SHELF_X - GLYPH_W / 2}
        y={SHELF_TOP + 4}
        width={GLYPH_W}
        height={54}
        fill="transparent"
        style={{ cursor: lifted ? "grabbing" : "grab" }}
        onPointerDown={onTake}
      >
        <title>Flush cutters</title>
      </rect>
      <g opacity={lifted ? 0.25 : 1} pointerEvents="none">
        <Cutters cx={CUTTER_SHELF_X} cy={GLYPH_CY} dir={1} />
      </g>
      <text
        data-testid="label-cutters"
        data-y={LABEL_Y}
        x={CUTTER_SHELF_X}
        y={LABEL_Y}
        textAnchor="middle"
        fontSize={9}
        fill="#A7C4B5"
        pointerEvents="none"
      >
        Flush cutters
      </text>
    </g>
  );
}

/**
 * One pair of cutters: a head whose jaw closes at x = 0, and two handles
 * reaching out behind it. `dir` is the way the conductors point, so the
 * handles lie over the offcut rather than over what stays.
 */
export function Cutters({ cx, cy, dir }: { cx: number; cy: number; dir: 1 | -1 }) {
  const body = "#9AA8B4";
  const edge = "#DCE7EF";

  return (
    <g transform={`translate(${cx} ${cy}) scale(${dir} 1)`}>
      {/* handles, reaching back over the offcut */}
      <path d="M 14 -7 L 50 -19 L 54 -10 L 18 -1 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      <path d="M 14 7 L 50 19 L 54 10 L 18 1 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      {/* head */}
      <path d="M 16 -12 L 2 -12 L 2 12 L 16 12 Z" fill={body} stroke={edge} strokeWidth={1.3} />
      {/* the jaw, closing on the line itself */}
      <path d="M 2 -12 L -3 -2 L -3 2 L 2 12 Z" fill="#E8F1F7" stroke={edge} strokeWidth={1} />
      <circle cx={15} cy={0} r={2.6} fill={edge} />
    </g>
  );
}
