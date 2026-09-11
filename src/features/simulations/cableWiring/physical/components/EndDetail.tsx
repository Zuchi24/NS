import {
  CONTACT_LINE,
  FRONT_STOP,
  NATURAL_ORDER,
  PAIR_IDS,
  PAIRS,
  RELIEF_CLAMP,
  exposed,
  hasContact,
  maxExposed,
  pinsAt,
  plugFrontMm,
  plugRearMm,
} from "../../model";
import type { CableEnd, Conductor, EndId, PairId } from "../../model";
import { CONDUCTOR_PAINT, PAIR_PAINT } from "../paint";

/**
 * One end of the cable, drawn to scale.
 *
 * Everything is placed by its end-frame position from the model, measured
 * outward from the jacket edge: the jacket edge is offset 0, a conductor tip
 * is offset exposed(c), the plug's rear and front are J − R and J − F. The one
 * choice made here is the drawing scale, picked so the end fits its panel and
 * shown by the scale bar — the millimetre labels elsewhere are model values,
 * never measured off the picture.
 */

export type Marker = { kind: "cut" | "strip" | "trim"; offsetMm: number; label: string } | null;

interface Props {
  id: EndId;
  end: CableEnd;
  /** +1 draws the tips to the right, −1 to the left. */
  dir: 1 | -1;
  /** Where the jacket edge sits in the bench drawing. */
  x0: number;
  /** Room outward of the jacket edge, and inward of it before the cable body. */
  outwardPx: number;
  inwardPx: number;
  cy: number;
  marker: Marker;
  selected: boolean;
  /** Untwist by clicking a pair; only offered when the untwist tool is out. */
  onPairClick?: (pair: PairId) => void;
}

const LANE_GAP = 8.5;
const PAIR_GAP = 19;
const WIRE = 5.5;

export function EndDetail({ id, end, dir, x0, outwardPx, inwardPx, cy, marker, selected, onPairClick }: Props) {
  const J = end.jacketEdgeMm;
  const rear = plugRearMm(end);
  const front = plugFrontMm(end);
  const plugReach = front === null ? 0 : J - front;

  // Enough room for the longest conductor and the whole plug, with a margin.
  const reachMm = Math.max(26, maxExposed(end) + 5, plugReach + 5);
  const scale = Math.min(6, outwardPx / reachMm);
  const x = (offsetMm: number) => x0 + dir * offsetMm * scale;
  const span = (a: number, b: number) => ({ x: Math.min(x(a), x(b)), width: Math.abs(x(b) - x(a)) });

  const jacketInnerMm = inwardPx / scale;
  const jacket = span(-jacketInnerMm, 0);

  const pins = pinsAt(end);
  const laneY = (index: number) => cy + (index - 3.5) * LANE_GAP;
  const pairY = (index: number) => cy + (index - 1.5) * PAIR_GAP;
  const allFlush = NATURAL_ORDER.every((c) => exposed(end, c) === 0);

  return (
    <g
      data-testid={`end-${id}`}
      data-jacket-edge-mm={J}
      data-exposed-max-mm={maxExposed(end)}
      data-fan={end.fan ? end.fan.join(" ") : ""}
      data-plug={end.plug ? end.plug.orientation : "none"}
      data-crimp={end.plug ? end.plug.crimp : "none"}
      data-jacket-in-mm={end.plug ? end.plug.jacketInMm : ""}
    >
      {selected && (
        <rect
          x={Math.min(x(-jacketInnerMm), x(reachMm)) - 6}
          y={cy - 74}
          width={Math.abs(x(reachMm) - x(-jacketInnerMm)) + 12}
          height={150}
          rx={12}
          fill="none"
          stroke="#FDE68A"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeDasharray="6 5"
        />
      )}

      {/* ---- Conductors, drawn first so the jacket mouth caps them ---- */}
      {end.fan
        ? end.fan.map((conductor, index) => (
            <Wire key={conductor} conductor={conductor} x1={x(0)} x2={x(exposed(end, conductor))} y={laneY(index)} />
          ))
        : PAIR_IDS.map((pair, index) => (
            <g
              key={pair}
              data-testid={`pair-${id}-${pair}`}
              data-untwisted={end.untwisted[pair]}
              onClick={onPairClick ? () => onPairClick(pair) : undefined}
              style={{ cursor: onPairClick ? "pointer" : undefined }}
            >
              {PAIRS[pair].map((conductor, which) =>
                end.untwisted[pair] ? (
                  <Wire
                    key={conductor}
                    conductor={conductor}
                    x1={x(0)}
                    x2={x(exposed(end, conductor))}
                    y={pairY(index) + (which ? 3.5 : -3.5)}
                  />
                ) : (
                  <TwistedWire
                    key={conductor}
                    conductor={conductor}
                    x1={x(0)}
                    x2={x(exposed(end, conductor))}
                    y={pairY(index)}
                    phase={which}
                  />
                ),
              )}
              {onPairClick && !end.untwisted[pair] && exposed(end, PAIRS[pair][0]) > 0 && (
                <rect {...span(0, Math.max(...PAIRS[pair].map((c) => exposed(end, c))))} y={pairY(index) - 8} height={16} fill={PAIR_PAINT[pair]} fillOpacity={0.12} rx={6} />
              )}
            </g>
          ))}

      {/* ---- Nicks: the stripper blade scored all eight here ---- */}
      {end.nicksAtMm.map((n) => (
        <g key={n} data-testid={`nick-${id}`}>
          <line x1={x(J - n)} x2={x(J - n)} y1={cy - 36} y2={cy + 36} stroke="#F43F5E" strokeWidth={2.5} />
          <text x={x(J - n)} y={cy - 40} textAnchor="middle" fontSize={10} fill="#FDA4AF" fontWeight={600}>
            nick
          </text>
        </g>
      ))}

      {/* ---- Jacket, over the conductor roots ---- */}
      <rect {...jacket} y={cy - 22} height={44} fill="#8C96A3" />
      <rect x={jacket.x} y={cy - 15} width={jacket.width} height={9} rx={4.5} fill="#B8C0CA" opacity={0.7} />
      {!allFlush && <rect x={x(0) - 3} y={cy - 23} width={6} height={46} rx={3} fill="#6B7580" />}
      {allFlush && (
        <g>
          <rect x={x(0) - 2} y={cy - 22} width={4} height={44} fill="#6B7580" />
          {NATURAL_ORDER.map((conductor, index) => (
            <circle key={conductor} cx={x(0) + dir * 3} cy={cy + (index - 3.5) * 5} r={2.2} fill={CONDUCTOR_PAINT[conductor].stripe ?? CONDUCTOR_PAINT[conductor].base} />
          ))}
        </g>
      )}

      {/* ---- The plug, translucent, over whatever is inside it ---- */}
      {end.plug && rear !== null && front !== null && pins && (
        <PlugDrawing
          end={end}
          x={x}
          rearOffset={J - rear}
          frontOffset={J - front}
          cy={cy}
          laneY={laneY}
          pins={pins}
          dir={dir}
        />
      )}

      {/* ---- Position numbers at the tips, matching the Arrange row ---- */}
      {end.fan && !end.plug && (
        <g data-testid={`positions-${id}`}>
          {end.fan.map((conductor, index) => (
            <text
              key={conductor}
              x={x(exposed(end, conductor)) + dir * 7}
              y={laneY(index) + 3}
              textAnchor="middle"
              fontSize={8}
              fill="#CBD5E1"
            >
              {index + 1}
            </text>
          ))}
        </g>
      )}

      {/* ---- Tool preview: the line, and what would go ---- */}
      {marker && (
        <MarkerLine
          marker={marker}
          removed={removedBand(marker, end, cy)}
          x={x}
          cy={cy}
          limitPx={dir === 1 ? [x0 - inwardPx, x0 + outwardPx] : [x0 - outwardPx, x0 + inwardPx]}
        />
      )}

      {/* ---- Scale bar: what 10 mm looks like at this end's scale ---- */}
      <g>
        <line x1={x(reachMm - 12)} x2={x(reachMm - 2)} y1={cy + 70} y2={cy + 70} stroke="#E2E8F0" strokeWidth={2} />
        <text x={(x(reachMm - 12) + x(reachMm - 2)) / 2} y={cy + 84} textAnchor="middle" fontSize={10} fill="#CBD5E1">
          10 mm
        </text>
      </g>
    </g>
  );
}

function Wire({ conductor, x1, x2, y }: { conductor: Conductor; x1: number; x2: number; y: number }) {
  const paint = CONDUCTOR_PAINT[conductor];
  if (x1 === x2) return null;

  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={paint.base} strokeWidth={WIRE} strokeLinecap="butt" />
      {paint.stripe && (
        <line x1={x1} x2={x2} y1={y} y2={y} stroke={paint.stripe} strokeWidth={WIRE} strokeDasharray="4 3" />
      )}
      <circle cx={x2} cy={y} r={2} fill="#C98A3C" />
    </g>
  );
}

function TwistedWire({ conductor, x1, x2, y, phase }: { conductor: Conductor; x1: number; x2: number; y: number; phase: number }) {
  const paint = CONDUCTOR_PAINT[conductor];
  const length = Math.abs(x2 - x1);
  if (length < 1) return null;

  const step = 7;
  const sign = x2 > x1 ? 1 : -1;
  const turns = Math.max(1, Math.round(length / step));
  const amp = phase ? 3.8 : -3.8;
  let d = `M ${x1} ${y}`;

  for (let turn = 0; turn < turns; turn++) {
    const a = x1 + sign * (turn * length) / turns;
    const b = x1 + sign * ((turn + 1) * length) / turns;
    d += ` Q ${(a + b) / 2} ${y + (turn % 2 ? -amp : amp)} ${b} ${y}`;
  }

  return (
    <g>
      <path d={d} stroke={paint.base} strokeWidth={WIRE - 1} fill="none" />
      {paint.stripe && <path d={d} stroke={paint.stripe} strokeWidth={WIRE - 1} fill="none" strokeDasharray="4 3" />}
    </g>
  );
}

function PlugDrawing({
  end,
  x,
  rearOffset,
  frontOffset,
  cy,
  laneY,
  pins,
  dir,
}: {
  end: CableEnd;
  x: (offsetMm: number) => number;
  rearOffset: number;
  frontOffset: number;
  cy: number;
  laneY: (index: number) => number;
  pins: Conductor[];
  dir: 1 | -1;
}) {
  const plug = end.plug!;
  const fan = end.fan!;
  const body = { x: Math.min(x(rearOffset), x(frontOffset)), width: Math.abs(x(frontOffset) - x(rearOffset)) };
  // Depths inside the plug, counted from its rear opening.
  const atDepth = (depth: number) => x(rearOffset + depth);
  const contactsUp = plug.orientation === "contacts-up";
  const bladeFill = plug.crimp === "full" ? "#E0B23C" : plug.crimp === "partial" ? "#E0B23C88" : "none";

  return (
    <g data-testid="plug">
      <rect {...body} y={cy - 38} height={76} rx={6} fill="#D7E9F7" fillOpacity={0.28} stroke="#9CC3E6" strokeWidth={2} />

      {/* Where the strain relief grips, and where the blades are. */}
      <line x1={atDepth(RELIEF_CLAMP)} x2={atDepth(RELIEF_CLAMP)} y1={cy - 38} y2={cy + 38} stroke="#9CC3E6" strokeDasharray="3 4" />
      <line x1={atDepth(CONTACT_LINE)} x2={atDepth(CONTACT_LINE)} y1={cy - 38} y2={cy + 38} stroke="#E0B23C" strokeDasharray="3 3" strokeOpacity={0.8} />
      <line x1={atDepth(FRONT_STOP)} x2={atDepth(FRONT_STOP)} y1={cy - 38} y2={cy + 38} stroke="#9CC3E6" strokeWidth={3} />

      {/* Blades: hollow until crimped; faint when the contacts face down. */}
      {fan.map((conductor, index) => {
        const contact = hasContact(end, conductor);
        const pin = pins.indexOf(conductor) + 1;

        return (
          <g key={conductor} opacity={contactsUp ? 1 : 0.45}>
            <rect
              x={Math.min(atDepth(CONTACT_LINE - 1), atDepth(CONTACT_LINE + 1))}
              y={laneY(index) - 3}
              width={Math.abs(atDepth(CONTACT_LINE + 1) - atDepth(CONTACT_LINE - 1))}
              height={6}
              rx={1.5}
              fill={bladeFill}
              stroke="#E0B23C"
              strokeWidth={1}
            />
            <circle
              data-testid={`contact-${conductor}`}
              data-contact={contact}
              cx={atDepth(FRONT_STOP) + dir * 8}
              cy={laneY(index)}
              r={2.6}
              fill={contact ? "#22C55E" : plug.crimp === "full" ? "#F43F5E" : "#64748B"}
            />
            <text x={atDepth(FRONT_STOP) + dir * 17} y={laneY(index) + 3} textAnchor="middle" fontSize={8} fill="#CBD5E1">
              {pin}
            </text>
          </g>
        );
      })}

      {/* The latch is on the other face from the contacts. */}
      {!contactsUp && (
        <path
          d={`M ${atDepth(4)} ${cy - 38} L ${atDepth(7)} ${cy - 50} L ${atDepth(15)} ${cy - 50} L ${atDepth(17)} ${cy - 38}`}
          fill="#D7E9F7"
          fillOpacity={0.4}
          stroke="#9CC3E6"
          strokeWidth={2}
        />
      )}
      {/* What the plug's marks are. Depths come from the model's plug constants. */}
      <text x={atDepth(RELIEF_CLAMP)} y={cy - 56} textAnchor="middle" fontSize={8} fill="#BFDBFE">
        strain relief
      </text>
      <text x={atDepth(FRONT_STOP)} y={cy - 56} textAnchor={dir === 1 ? "start" : "end"} fontSize={8} fill="#BFDBFE">
        front
      </text>
      <text x={atDepth(CONTACT_LINE)} y={cy + 49} textAnchor="middle" fontSize={8} fill="#E0B23C">
        blades
      </text>
      <text x={(x(rearOffset) + x(frontOffset)) / 2} y={cy + 61} textAnchor="middle" fontSize={10} fill="#BFDBFE">
        {contactsUp ? "contacts up" : "contacts down · clip up"}
      </text>
    </g>
  );
}

type Band = { fromMm: number; toMm: number; top: number; bottom: number; label: string };

/**
 * The part of the end the previewed action would take away, in offsets from
 * the jacket edge. Pure picture: what a cut, strip or trim at the marker
 * covers, drawn from the model's own positions. The model still decides
 * whether the action is allowed.
 */
function removedBand(marker: NonNullable<Marker>, end: CableEnd, cy: number): Band | null {
  switch (marker.kind) {
    case "cut": {
      // Everything outward of the cut: jacket, bare conductor and any plug, to the end's outermost point.
      const front = plugFrontMm(end);
      const outermost = Math.max(maxExposed(end), front === null ? 0 : end.jacketEdgeMm - front);

      return { fromMm: marker.offsetMm, toMm: outermost, top: cy - 40, bottom: cy + 40, label: "cut off" };
    }
    case "strip":
      return marker.offsetMm < 0 ? { fromMm: marker.offsetMm, toMm: 0, top: cy - 22, bottom: cy + 22, label: "jacket comes off" } : null;
    case "trim": {
      const longest = maxExposed(end);

      return marker.offsetMm < longest
        ? { fromMm: marker.offsetMm, toMm: longest, top: cy - 36, bottom: cy + 36, label: "trimmed away" }
        : null;
    }
  }
}

function MarkerLine({
  marker,
  removed,
  x,
  cy,
  limitPx,
}: {
  marker: NonNullable<Marker>;
  removed: Band | null;
  x: (offsetMm: number) => number;
  cy: number;
  limitPx: [number, number];
}) {
  const clampX = (value: number) => Math.min(limitPx[1], Math.max(limitPx[0], value));
  const raw = x(marker.offsetMm);
  const at = clampX(raw);
  const color = marker.kind === "cut" ? "#F87171" : marker.kind === "strip" ? "#38BDF8" : "#FBBF24";
  const band = removed ? [clampX(x(removed.fromMm)), clampX(x(removed.toMm))].sort((a, b) => a - b) : null;

  return (
    <g data-testid="tool-marker" data-kind={marker.kind}>
      {/* The shading is the explanation; its name rides along as a tooltip so no label
          collides with the plug's own marks. */}
      {removed && band && band[1] - band[0] > 1 && (
        <g data-testid="tool-removed">
          <title>{removed.label}</title>
          <rect x={band[0]} y={removed.top} width={band[1] - band[0]} height={removed.bottom - removed.top} fill={color} fillOpacity={0.22} rx={3} />
        </g>
      )}
      <line x1={at} x2={at} y1={cy - 62} y2={cy + 50} stroke={color} strokeWidth={2} strokeDasharray="6 4" />
      <text x={at} y={cy - 66} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>
        {raw === at ? marker.label : `${marker.label} (off view)`}
      </text>
    </g>
  );
}
