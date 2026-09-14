import type { PointerEvent as ReactPointerEvent } from "react";

import { SHELF_TOP } from "../benchGeometry";

/**
 * The RJ45 crimper, lying on the shelf at the near end of the row.
 *
 * Drawn with its die at the tool's own origin: two jaws, one above the plug
 * and one below it, with the row of teeth that drives the blades down. Wherever
 * it stands on an end it is drawn with that die across the plug's blade line,
 * so the tool and the plug it would close on are always seen together. The
 * handles reach up and away from the cable, leaving the plug in view.
 *
 * Nothing here says whether a plug is ready to crimp.
 */

/** Where the crimper lies on the shelf, clear of the shelf's own caption and the strippers. */
export const CRIMPER_SHELF_X = 330;

const GLYPH_W = 96;
const GLYPH_CY = SHELF_TOP + 26;
const LABEL_Y = SHELF_TOP + 52;
/** The crimper is a big tool; on the shelf it is drawn small enough to lie in its spot. */
const SHELF_SCALE = 0.3;

interface ShelfProps {
  onTake: (event: ReactPointerEvent) => void;
  /** True while it is off the shelf, drawn in its place as a faint outline. */
  lifted: boolean;
}

export function CrimperShelfTool({ onTake, lifted }: ShelfProps) {
  return (
    <g data-testid="crimper-tool" data-lifted={lifted}>
      {/* A padded grab area, so the tool stays easy to take at any bench size. */}
      <rect
        data-testid="take-crimper"
        x={CRIMPER_SHELF_X - GLYPH_W / 2}
        y={SHELF_TOP + 4}
        width={GLYPH_W}
        height={54}
        fill="transparent"
        style={{ cursor: lifted ? "grabbing" : "grab" }}
        onPointerDown={onTake}
      >
        <title>Crimper</title>
      </rect>
      <g opacity={lifted ? 0.25 : 1} pointerEvents="none" transform={`translate(${CRIMPER_SHELF_X} ${GLYPH_CY}) rotate(90) scale(${SHELF_SCALE})`}>
        <Crimper cx={0} cy={0} />
      </g>
      <text
        data-testid="label-crimper"
        data-y={LABEL_Y}
        x={CRIMPER_SHELF_X}
        y={LABEL_Y}
        textAnchor="middle"
        fontSize={9}
        fill="#A7C4B5"
        pointerEvents="none"
      >
        Crimper
      </text>
    </g>
  );
}

/**
 * One crimper: a C-shaped frame holding an upper and a lower jaw around the
 * plug's path, the upper jaw carrying the teeth, and two long handles.
 */
export function Crimper({ cx, cy }: { cx: number; cy: number }) {
  const body = "#5B6B78";
  const edge = "#D8E3EC";

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* a padded hit area over the die, so a hand closing on it need not be precise */}
      <rect x={-30} y={-64} width={60} height={128} fill="transparent" />
      {/* handles, reaching up and down away from the cable */}
      <path d="M -26 -58 L -40 -96 L -28 -100 L -14 -58 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      <path d="M -26 58 L -40 96 L -28 100 L -14 58 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      {/* the frame behind the die */}
      <rect x={-26} y={-60} width={8} height={120} rx={2} fill={body} stroke={edge} strokeWidth={1.2} />
      {/* upper jaw, with the teeth that drive the blades */}
      <rect x={-20} y={-60} width={40} height={18} rx={3} fill={body} stroke={edge} strokeWidth={1.3} />
      {[-12, -6, 0, 6, 12].map((tooth) => (
        <line key={tooth} x1={tooth} x2={tooth} y1={-42} y2={-37} stroke="#E0B23C" strokeWidth={1.6} />
      ))}
      {/* lower jaw, the anvil the plug is pressed against */}
      <rect x={-20} y={42} width={40} height={18} rx={3} fill={body} stroke={edge} strokeWidth={1.3} />
    </g>
  );
}
