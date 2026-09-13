import type { PointerEvent as ReactPointerEvent } from "react";

import type { StripSlot } from "../../model";
import { HEIGHT, SHELF_TOP, WIDTH } from "../benchGeometry";

/**
 * The two strippers, lying on the bench.
 *
 * Which jaw the cable goes through is a physical choice, so it is made by
 * picking up a different tool rather than by setting a field. The UTP jaw is
 * cut for a Cat5e/6 jacket; the small round hole closes further than the
 * jacket is thick, which is why it can score what is underneath — the model
 * decides whether it did, and says so.
 *
 * Both lie in the middle of the shelf, below the stretch of cable that is
 * drawn out of scale and belongs to neither end. A tool picked up there is on
 * no end until the student carries it to one, so which tool they reach for
 * cannot decide which end they are working on.
 *
 * Nothing here marks either tool as the right one.
 */

const TOOLS: { slot: StripSlot; cx: number; label: string }[] = [
  { slot: "correct", cx: 450, label: "UTP jaw · Cat5e/6" },
  { slot: "too-deep", cx: 550, label: "Small round jaw" },
];

const GLYPH_W = 96;

/** The tool, and the name under it, both inside the shelf. */
const GLYPH_CY = SHELF_TOP + 22;
const LABEL_Y = SHELF_TOP + 52;

interface Props {
  onTake: (slot: StripSlot) => (event: ReactPointerEvent) => void;
  /** The tool currently off the shelf, drawn in its place as an empty outline. */
  held: StripSlot | null;
}

export function StripperTools({ onTake, held }: Props) {
  return (
    <g data-testid="tool-shelf">
      <rect x={0} y={SHELF_TOP} width={WIDTH} height={HEIGHT - SHELF_TOP} fill="#12281F" />
      <line x1={0} x2={WIDTH} y1={SHELF_TOP} y2={SHELF_TOP} stroke="#2C5B49" strokeWidth={2} />
      <text x={18} y={SHELF_TOP + 22} fontSize={10} fill="#7FA893" letterSpacing="0.08em">
        TOOLS
      </text>
      <text x={18} y={SHELF_TOP + 38} fontSize={9} fill="#5F8874">
        drag one onto
      </text>
      <text x={18} y={SHELF_TOP + 49} fontSize={9} fill="#5F8874">
        the cable
      </text>

      {TOOLS.map(({ slot, cx, label }) => {
        const lifted = held === slot;

        return (
          <g key={slot} data-testid={`stripper-${slot}`} data-lifted={lifted}>
            {/* A padded grab area, so the tool stays easy to take at any bench size. */}
            <rect
              data-testid={`take-${slot}`}
              x={cx - GLYPH_W / 2}
              y={SHELF_TOP + 4}
              width={GLYPH_W}
              height={54}
              fill="transparent"
              style={{ cursor: lifted ? "grabbing" : "grab" }}
              onPointerDown={onTake(slot)}
            >
              <title>{label}</title>
            </rect>
            <g opacity={lifted ? 0.25 : 1} pointerEvents="none">
              <Stripper slot={slot} cx={cx} cy={GLYPH_CY} />
            </g>
            <text
              data-testid={`label-${slot}`}
              data-y={LABEL_Y}
              x={cx}
              y={LABEL_Y}
              textAnchor="middle"
              fontSize={9}
              fill="#A7C4B5"
              pointerEvents="none"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * One stripper: two handles, and a jaw whose opening is the whole difference
 * between the pair of them.
 */
export function Stripper({ slot, cx, cy }: { slot: StripSlot; cx: number; cy: number }) {
  const utp = slot === "correct";
  const body = utp ? "#8FA7B8" : "#B99A62";
  const edge = utp ? "#D3E2EC" : "#E7CF9E";

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* handles */}
      <path d="M 8 -6 L 46 -17 L 50 -9 L 12 0 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      <path d="M 8 6 L 46 17 L 50 9 L 12 0 Z" fill={body} stroke={edge} strokeWidth={1.2} />
      {/* head */}
      <rect x={-34} y={-15} width={44} height={30} rx={5} fill={body} stroke={edge} strokeWidth={1.4} />
      {/* the jaw: a wide flat slot, or a small round hole */}
      {utp ? (
        <rect x={-27} y={-4.5} width={26} height={9} rx={1.5} fill="#101F19" stroke={edge} strokeWidth={1} />
      ) : (
        <circle cx={-15} cy={0} r={4.2} fill="#101F19" stroke={edge} strokeWidth={1} />
      )}
      <circle cx={8} cy={0} r={2.8} fill={edge} />
    </g>
  );
}
