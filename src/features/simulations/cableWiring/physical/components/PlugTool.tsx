import type { PointerEvent as ReactPointerEvent } from "react";

import { CONTACT_LINE, FRONT_STOP } from "../../model";
import type { Orientation } from "../../model";
import { SHELF_TOP } from "../benchGeometry";
import { LANE_COUNT, laneY } from "../conductorGeometry";
import { orientationWords } from "../messages";
import { PLUG_HALF } from "../plugGeometry";

/**
 * The RJ45 plugs, lying on the shelf, and a plug in the student's hand.
 *
 * How many are on the shelf is the model's tray, read and shown; when it is
 * empty there is nothing to pick up. Whether a plug can go on an end, and where
 * it would stop, are the model's answers — nothing here draws a plug as right
 * or wrong, and nothing here says which way up it ought to be.
 *
 * A plug in hand is drawn the way EndDetail draws a seated one: a clear body as
 * long as the plug, the front face, the row of blades, and the latch on the
 * face opposite the contacts. No pin numbers and no conductor names — which
 * conductor lands on which pin is for the student to read off a seated plug.
 */

/** Where the plugs lie on the shelf, past the cable cutters. */
export const PLUG_SHELF_X = 910;

const GLYPH_W = 96;
const GLYPH_CY = SHELF_TOP + 22;
const LABEL_Y = SHELF_TOP + 52;

interface ShelfProps {
  onTake: (event: ReactPointerEvent) => void;
  /** Plugs in the model's tray. */
  count: number;
  /** True while one is off the shelf, in hand or standing on the bench. */
  lifted: boolean;
}

export function PlugShelfTool({ onTake, count, lifted }: ShelfProps) {
  const lying = Math.max(0, lifted ? count - 1 : count);

  return (
    <g data-testid="plug-tool" data-count={count} data-lifted={lifted}>
      {count > 0 && (
        /* A padded grab area, so a plug stays easy to take at any bench size. */
        <rect
          data-testid="take-plug"
          x={PLUG_SHELF_X - GLYPH_W / 2}
          y={SHELF_TOP + 4}
          width={GLYPH_W}
          height={54}
          fill="transparent"
          style={{ cursor: lifted ? "grabbing" : "grab" }}
          onPointerDown={onTake}
        >
          <title>RJ45 plugs</title>
        </rect>
      )}
      <g pointerEvents="none">
        {Array.from({ length: Math.min(lying, 4) }, (_, index) => (
          <ShelfPlug key={index} cx={PLUG_SHELF_X - 24 + index * 16} cy={GLYPH_CY} />
        ))}
      </g>
      <text
        data-testid="label-plugs"
        data-y={LABEL_Y}
        x={PLUG_SHELF_X}
        y={LABEL_Y}
        textAnchor="middle"
        fontSize={9}
        fill="#A7C4B5"
        pointerEvents="none"
      >
        {`Plugs · ${lying}`}
      </text>
    </g>
  );
}

/** One plug lying on the shelf, face on. */
function ShelfPlug({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect x={-6} y={-12} width={12} height={22} rx={2} fill="#D7E9F7" fillOpacity={0.5} stroke="#9CC3E6" strokeWidth={1.2} />
      <line x1={-3} x2={3} y1={6} y2={6} stroke="#E0B23C" strokeWidth={1.5} />
    </g>
  );
}

interface GlyphProps {
  /** Where the rear opening is, and where the front face is, in the bench's units. */
  rearX: number;
  frontX: number;
  cy: number;
  orientation: Orientation;
  /** Set when the model has said it would refuse fitting it here. Colour only. */
  refused: boolean;
}

/** A plug in hand, lying along the cable with its rear opening at `rearX`. */
export function PlugGlyph({ rearX, frontX, cy, orientation, refused }: GlyphProps) {
  const contactsUp = orientation === "contacts-up";
  const edge = refused ? "#F43F5E" : "#9CC3E6";
  // Depths inside the plug, counted from its rear opening.
  const atDepth = (depth: number) => rearX + ((frontX - rearX) * depth) / FRONT_STOP;

  return (
    <g data-testid="plug-glyph" data-contacts={orientation}>
      <rect
        x={Math.min(rearX, frontX)}
        y={cy - PLUG_HALF}
        width={Math.abs(frontX - rearX)}
        height={2 * PLUG_HALF}
        rx={6}
        fill={refused ? "#4C1520" : "#D7E9F7"}
        fillOpacity={0.35}
        stroke={edge}
        strokeWidth={2}
      />
      <line x1={frontX} x2={frontX} y1={cy - PLUG_HALF} y2={cy + PLUG_HALF} stroke={edge} strokeWidth={3} />

      {/* The blades: bright on the contacts face, faint through the body when it faces down. */}
      <g opacity={contactsUp ? 1 : 0.45}>
        {Array.from({ length: LANE_COUNT }, (_, index) => (
          <rect
            key={index}
            x={Math.min(atDepth(CONTACT_LINE - 1), atDepth(CONTACT_LINE + 1))}
            y={laneY(index, cy) - 3}
            width={Math.abs(atDepth(CONTACT_LINE + 1) - atDepth(CONTACT_LINE - 1))}
            height={6}
            rx={1.5}
            fill="none"
            stroke="#E0B23C"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* The latch is on the other face from the contacts. */}
      {!contactsUp && (
        <path
          data-testid="plug-latch"
          d={`M ${atDepth(4)} ${cy - PLUG_HALF} L ${atDepth(7)} ${cy - PLUG_HALF - 12} L ${atDepth(15)} ${cy - PLUG_HALF - 12} L ${atDepth(17)} ${cy - PLUG_HALF}`}
          fill="#D7E9F7"
          fillOpacity={0.4}
          stroke={edge}
          strokeWidth={2}
        />
      )}

      <text x={(rearX + frontX) / 2} y={cy + PLUG_HALF + 11} textAnchor="middle" fontSize={9} fill="#BFDBFE" pointerEvents="none">
        {orientationWords(orientation)}
      </text>
    </g>
  );
}

/** Where the model says a plug held here would actually stop: its outline, dashed. */
export function PlugSeat({ rearX, frontX, cy }: { rearX: number; frontX: number; cy: number }) {
  return (
    <rect
      data-testid="plug-seat"
      x={Math.min(rearX, frontX)}
      y={cy - PLUG_HALF}
      width={Math.abs(frontX - rearX)}
      height={2 * PLUG_HALF}
      rx={6}
      fill="none"
      stroke="#E0F2FE"
      strokeOpacity={0.8}
      strokeWidth={1.5}
      strokeDasharray="5 4"
      pointerEvents="none"
    />
  );
}

/** The handle that turns a standing plug over. Taken on its own press, never a click. */
export function PlugFlip({
  cx,
  cy,
  orientation,
  onFlip,
}: {
  cx: number;
  cy: number;
  orientation: Orientation;
  onFlip: (event: ReactPointerEvent) => void;
}) {
  return (
    <g
      data-testid="flip-plug"
      data-orientation={orientation}
      transform={`translate(${cx} ${cy})`}
      style={{ cursor: "pointer" }}
      onPointerDown={onFlip}
    >
      <title>Turn the plug over</title>
      <rect x={-26} y={-9} width={52} height={18} rx={9} fill="#0B211A" stroke="#38BDF8" strokeWidth={1.2} />
      <text textAnchor="middle" y={3.5} fontSize={9} fontWeight={700} fill="#E0F2FE" pointerEvents="none">
        ⟲ flip
      </text>
    </g>
  );
}
