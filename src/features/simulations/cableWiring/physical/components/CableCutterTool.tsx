import type { PointerEvent as ReactPointerEvent } from "react";

import { SHELF_TOP } from "../benchGeometry";

/**
 * The cable cutters, lying on the shelf at the far end of the row.
 *
 * A different tool from the flush cutters beside them, because they do a
 * different job: these close on the whole cable — jacket, conductors and any
 * plug in one bite — and shorten it. Which of the two a student reaches for is
 * a physical choice, the way the two stripper jaws are, rather than a mode.
 *
 * Drawn with their cutting edge at the tool's own origin, so wherever they are
 * put down the blade sits exactly on the line the bench draws — the tool and
 * the measurement can never disagree. The handles reach inward, along the
 * cable that would stay, leaving the part that would come off in plain view.
 *
 * Nothing here says where they ought to be put.
 */

/** Where the cable cutters lie on the shelf, clear of the flush cutters. */
export const CABLE_CUTTER_SHELF_X = 790;

const GLYPH_W = 96;
const GLYPH_CY = SHELF_TOP + 22;
const LABEL_Y = SHELF_TOP + 52;

interface ShelfProps {
  onTake: (event: ReactPointerEvent) => void;
  /** True while they are off the shelf, drawn in their place as a faint outline. */
  lifted: boolean;
}

export function CableCutterShelfTool({ onTake, lifted }: ShelfProps) {
  return (
    <g data-testid="cable-cutters-tool" data-lifted={lifted}>
      {/* A padded grab area, so the tool stays easy to take at any bench size. */}
      <rect
        data-testid="take-cable-cutters"
        x={CABLE_CUTTER_SHELF_X - GLYPH_W / 2}
        y={SHELF_TOP + 4}
        width={GLYPH_W}
        height={54}
        fill="transparent"
        style={{ cursor: lifted ? "grabbing" : "grab" }}
        onPointerDown={onTake}
      >
        <title>Cable cutters</title>
      </rect>
      <g opacity={lifted ? 0.25 : 1} pointerEvents="none">
        <CableCutters cx={CABLE_CUTTER_SHELF_X} cy={GLYPH_CY} dir={-1} />
      </g>
      <text
        data-testid="label-cable-cutters"
        data-y={LABEL_Y}
        x={CABLE_CUTTER_SHELF_X}
        y={LABEL_Y}
        textAnchor="middle"
        fontSize={9}
        fill="#A7C4B5"
        pointerEvents="none"
      >
        Cable cutters
      </text>
    </g>
  );
}

/**
 * One pair of cable cutters: a heavy curved jaw that closes at x = 0, and two
 * long handles reaching out behind it. `dir` is the way the handles lie, so
 * they can be laid along the cable that stays rather than over the offcut.
 */
export function CableCutters({ cx, cy, dir }: { cx: number; cy: number; dir: 1 | -1 }) {
  const body = "#7C8894";
  const edge = "#D8E3EC";

  return (
    <g transform={`translate(${cx} ${cy}) scale(${dir} 1)`}>
      {/* long handles, reaching back along the cable */}
      <path d="M 18 -9 L 62 -24 L 67 -13 L 23 -2 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      <path d="M 18 9 L 62 24 L 67 13 L 23 2 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      {/* the head, heavier than the flush cutters' */}
      <path d="M 20 -16 L 4 -16 L 4 16 L 20 16 Z" fill={body} stroke={edge} strokeWidth={1.3} />
      {/* the curved jaw, closing on the line itself */}
      <path d="M 4 -16 Q -6 -8 -6 0 Q -6 8 4 16 Z" fill="#E8F1F7" stroke={edge} strokeWidth={1} />
      <circle cx={19} cy={0} r={3} fill={edge} />
    </g>
  );
}
