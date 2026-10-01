import type { PointerEvent as ReactPointerEvent } from "react";

import type { StripSlot } from "../../model";
import { SHELF_TOP } from "../benchGeometry";
import { CRIMPER_OPERATION_LABEL } from "../crimperOperation";
import type { CrimperOperation } from "../crimperOperation";

/**
 * The RJ45 crimper: the bench's one hand tool for preparing the cable. Its
 * cutting blade cuts the cable and trims the conductors, its stripping blade
 * takes the jacket off, and its die crimps the plug — whichever the student
 * has chosen in the toolbar (see crimperOperation).
 *
 * Drawn with its die at the tool's own origin: two jaws, one above the plug
 * and one below it, with the row of teeth that drives the blades down. Wherever
 * it stands on an end it is drawn with that die across the plug's blade line,
 * so the tool and the plug it would close on are always seen together. The
 * handles reach up and away from the cable, leaving the plug in view.
 *
 * On the shelf it is drawn whole, as the modular crimping tool a student would
 * pick up: one tool whose metal head carries the RJ45 die, a stripping blade
 * and a cutting blade, hinged to two gripped handles.
 *
 * Nothing here says whether a plug is ready to crimp.
 */

/** Where the crimper lies on the shelf: the middle of the row, under the stretch of cable that belongs to neither end. */
export const CRIMPER_SHELF_X = 480;

const GLYPH_W = 96;
const GLYPH_CY = SHELF_TOP + 24;
const LABEL_Y = SHELF_TOP + 52;
/** Drawn a little under full size, so the handles clear both the shelf's edge and the label. */
const SHELF_SCALE = 0.9;

/** The crimper's colours: a dark steel head and frame, blue handle grips, bright blade steel. */
const STEEL = "#2E353C";
const STEEL_EDGE = "#9AA8B4";
const GRIP = "#2F6FD0";
const GRIP_EDGE = "#9CC0F2";
const BLADE = "#D3DBE2";

interface ShelfProps {
  onTake: (event: ReactPointerEvent) => void;
  /** True while it is off the shelf, drawn in its place as a faint outline. */
  lifted: boolean;
  /** What taking it now would do, or null when the chosen operation is not one the crimper does. */
  operation: CrimperOperation | null;
}

export function CrimperShelfTool({ onTake, lifted, operation }: ShelfProps) {
  const title =
    operation === null
      ? "Crimper: RJ45 crimping tool with crimper, wire stripper and wire cutter. Choose Cut, Strip, Trim or Crimp to use it."
      : `Crimper: RJ45 crimping tool with crimper, wire stripper and wire cutter. Take it to ${CRIMPER_OPERATION_LABEL[operation]}.`;

  return (
    <g data-testid="crimper-tool" data-lifted={lifted} data-operation={operation ?? ""}>
      {/* A padded grab area, so the tool stays easy to take at any bench size. */}
      <rect
        data-testid="take-crimper"
        x={CRIMPER_SHELF_X - GLYPH_W / 2}
        y={SHELF_TOP + 4}
        width={GLYPH_W}
        height={54}
        fill="transparent"
        style={{ cursor: lifted ? "grabbing" : operation === null ? "not-allowed" : "grab" }}
        onPointerDown={onTake}
      >
        <title>{title}</title>
      </rect>
      <g opacity={lifted ? 0.25 : operation === null ? 0.6 : 1} pointerEvents="none" transform={`translate(${CRIMPER_SHELF_X} ${GLYPH_CY}) scale(${SHELF_SCALE})`}>
        <ShelfCrimper />
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
        {operation === null ? "Crimper" : `Crimper · ${CRIMPER_OPERATION_LABEL[operation]}`}
      </text>
    </g>
  );
}

/**
 * The whole tool lying on its side, head to the left and handles open to the
 * right, about 88 units long. Its parts, from the nose back: the 8P and 6P
 * crimp dies, the stripping blade under them, the cutting blade over them,
 * the pivot, then the two handles in their blue grips with the ratchet
 * spring between them.
 */
function ShelfCrimper() {
  return (
    <g data-testid="crimper-shelf-glyph">
      {/* lower handle: steel arm into a blue grip */}
      <path d="M -2 4 L 12 9 L 10 13 L -4 8 Z" fill={STEEL} stroke={STEEL_EDGE} strokeWidth={0.6} />
      <path d="M 10 8 L 42 15 Q 45.5 16 44.5 19 Q 43.5 21 40 20 L 8.5 13 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={0.6} />
      {/* upper handle: steel arm into a blue grip */}
      <path d="M -6 -12 L 12 -15 L 13 -11 L -4 -8 Z" fill={STEEL} stroke={STEEL_EDGE} strokeWidth={0.6} />
      <path d="M 10 -16 L 40 -22 Q 44 -22.5 44.5 -19.5 Q 44.5 -17 41 -16.5 L 11 -10.5 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={0.6} />
      {/* the ratchet spring that holds the handles open */}
      <polyline points="14,-10 17,-7 13,-4 17,-1 13,2 17,5 14,8" fill="none" stroke={STEEL_EDGE} strokeWidth={0.8} />

      {/* the metal head */}
      <path
        d="M -44 -1 Q -44 -12 -34 -14 L -8 -14 Q -2 -14 0 -9 L 2 2 Q 2 9 -4 10 L -36 12 Q -44 12 -44 4 Z"
        fill={STEEL}
        stroke={STEEL_EDGE}
        strokeWidth={0.8}
      />
      {/* cutting blade, across the top of the head */}
      <path d="M -16 -14 L -6 -14 L -7 -10 L -16 -10 Z" fill={BLADE} />
      {/* stripping blade, in its notch under the dies */}
      <rect x={-28} y={7} width={9} height={2.5} rx={0.6} fill={BLADE} />
      {/* the RJ45 (8P) die and the smaller 6P die */}
      <rect x={-38} y={-6} width={13} height={9} rx={1} fill="#111418" stroke={STEEL_EDGE} strokeWidth={0.5} />
      {[-36, -34, -32, -30, -28].map((x) => (
        <line key={x} x1={x + 0.5} x2={x + 0.5} y1={-6} y2={-3.5} stroke="#E0B23C" strokeWidth={0.6} />
      ))}
      <rect x={-22} y={-5} width={10} height={7.5} rx={1} fill="#111418" stroke={STEEL_EDGE} strokeWidth={0.5} />
      {/* the pivot */}
      <circle cx={-3} cy={-3} r={3} fill="#5B6670" stroke={STEEL_EDGE} strokeWidth={0.6} />
      <circle cx={-3} cy={-3} r={1} fill={STEEL} />
    </g>
  );
}

/**
 * One crimper: a C-shaped frame holding an upper and a lower jaw around the
 * plug's path, the upper jaw carrying the teeth, and two long handles in
 * their grips, as on the tool on the shelf.
 *
 * Drawn with the frame and handles to the left. `mirrored` turns it to face
 * the other way, about its die, so the die stays where it was.
 */
export function Crimper({ cx, cy, mirrored = false }: { cx: number; cy: number; mirrored?: boolean }) {
  return (
    <g transform={`translate(${cx} ${cy})${mirrored ? " scale(-1 1)" : ""}`}>
      {/* a padded hit area over the die, so a hand closing on it need not be precise */}
      <rect x={-30} y={-64} width={60} height={128} fill="transparent" />
      {/* handles, reaching up and down away from the cable */}
      <path d="M -26 -58 L -40 -96 L -28 -100 L -14 -58 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      <path d="M -26 58 L -40 96 L -28 100 L -14 58 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      {/* the frame behind the die */}
      <rect x={-26} y={-60} width={8} height={120} rx={2} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.2} />
      {/* pivots where the handles meet the frame */}
      <circle cx={-22} cy={-56} r={2.5} fill="#5B6670" stroke={STEEL_EDGE} strokeWidth={0.8} />
      <circle cx={-22} cy={56} r={2.5} fill="#5B6670" stroke={STEEL_EDGE} strokeWidth={0.8} />
      {/* upper jaw, with the teeth that drive the blades */}
      <rect x={-20} y={-60} width={40} height={18} rx={3} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.3} />
      {[-12, -6, 0, 6, 12].map((tooth) => (
        <line key={tooth} x1={tooth} x2={tooth} y1={-42} y2={-37} stroke="#E0B23C" strokeWidth={1.6} />
      ))}
      {/* lower jaw, the anvil the plug is pressed against */}
      <rect x={-20} y={42} width={40} height={18} rx={3} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.3} />
    </g>
  );
}

/**
 * The crimper used to cut: its head side-on, with the cutting blade closing at
 * x = 0 so that, wherever it is put down, the blade sits exactly on the line
 * the bench draws. `dir` is the way the handles lie, as it was for the cutters
 * this drawing replaces: over the offcut when trimming conductors, back along
 * the cable that stays when cutting the cable through.
 */
export function CrimperCutting({ cx, cy, dir }: { cx: number; cy: number; dir: 1 | -1 }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${dir} 1)`}>
      {/* handles in their grips, reaching back from the pivot */}
      <path d="M 24 -8 L 60 -21 L 64 -12 L 28 -1 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      <path d="M 24 8 L 60 21 L 64 12 L 28 1 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      {/* the steel head, with the crimp die in it */}
      <path d="M 2 -14 L 21 -14 Q 27 -14 27 -8 L 27 8 Q 27 14 21 14 L 2 14 Z" fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.3} />
      <rect x={8} y={-5} width={11} height={8} rx={1} fill="#111418" stroke={STEEL_EDGE} strokeWidth={0.6} />
      {/* the cutting blade, closing on the line itself */}
      <path d="M 2 -14 L -3 -2 L -3 2 L 2 14 Z" fill={BLADE} stroke={STEEL_EDGE} strokeWidth={1} />
      <circle cx={23} cy={0} r={2.6} fill="#5B6670" stroke={STEEL_EDGE} strokeWidth={0.8} />
    </g>
  );
}

/**
 * The crimper used to strip: its head side-on, with the stripping blade's
 * opening where a stripper's jaw would be. The slot chosen in the strip
 * controls is the opening drawn — the flat UTP slot, or the small round one —
 * and is the whole difference between the two, as it is to the model.
 */
export function CrimperStripping({ slot, cx, cy }: { slot: StripSlot; cx: number; cy: number }) {
  const utp = slot === "correct";

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* handles in their grips */}
      <path d="M 8 -6 L 46 -18 L 50 -9 L 12 0 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      <path d="M 8 6 L 46 18 L 50 9 L 12 0 Z" fill={GRIP} stroke={GRIP_EDGE} strokeWidth={1.2} />
      {/* the steel head */}
      <path d="M -34 -9 Q -34 -15 -28 -15 L 6 -15 Q 10 -15 10 -11 L 10 11 Q 10 15 6 15 L -28 15 Q -34 15 -34 9 Z" fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.4} />
      {/* the stripping blade's opening: a wide flat slot, or a small round hole */}
      {utp ? (
        <>
          <rect x={-27} y={-4.5} width={26} height={9} rx={1.5} fill="#101F19" stroke={BLADE} strokeWidth={1} />
          <line x1={-26} x2={-2} y1={-4.5} y2={-4.5} stroke={BLADE} strokeWidth={1.4} />
        </>
      ) : (
        <circle cx={-15} cy={0} r={4.2} fill="#101F19" stroke={BLADE} strokeWidth={1.2} />
      )}
      <circle cx={8} cy={0} r={2.8} fill="#5B6670" stroke={STEEL_EDGE} strokeWidth={0.8} />
    </g>
  );
}
