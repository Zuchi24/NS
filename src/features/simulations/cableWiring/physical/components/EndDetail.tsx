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
import { JACKET_HALF } from "../benchGeometry";
import { LANE_GAP, laneY as laneCentre, liftedRow, rowBounds } from "../conductorGeometry";
import { CONDUCTOR_LABEL } from "../messages";
import { pairRegions, pairRowY } from "../pairGeometry";
import { CONDUCTOR_PAINT, PAIR_PAINT } from "../paint";
import type { PlugGrip } from "../plugGeometry";

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

/**
 * A pair being pulled out of the bundle right now: how far off the cable it
 * has come and how far open it is drawn, both worked out by the gesture from
 * the hand's travel. `refused` is the model's answer to this very pull; it is
 * never worked out here.
 */
export type PairPull = { pair: PairId; lift: number; openness: number; refused: boolean } | null;

/**
 * A conductor out of the row right now: which one, the lane it came from, the
 * lane it is being offered to (null while the hand is off the row), and where
 * the hand is. `refused` is the model's answer to this very move; it is never
 * worked out here.
 */
export type ConductorLift = {
  conductor: Conductor;
  fromIndex: number;
  toIndex: number | null;
  at: { x: number; y: number };
  refused: boolean;
} | null;

export type Marker = {
  kind: "cut" | "strip" | "trim";
  offsetMm: number;
  label: string;
  /** Set when the model has said it would refuse this. Colour only. */
  tone?: "refused";
} | null;

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
  /**
   * User units per millimetre. Chosen once for the whole bench and handed to
   * both ends, so the same length is the same size wherever it is drawn.
   */
  scale: number;
  marker: Marker;
  selected: boolean;
  /** The pair in hand, when one is being pulled apart on this end. */
  pull?: PairPull;
  /** The conductor in hand, when one is being moved about this end's row. */
  lift?: ConductorLift;
  /**
   * Where the fitted plug on this end can be taken hold of, when the bench
   * offers moving one — the very region the gesture hit-tests, so the grip
   * drawn is the grip a hand closes on.
   */
  plugGrip?: PlugGrip | null;
  /** True while a hand has this end's fitted plug out of its seat: the seated plug is drawn faint behind it. */
  plugLifted?: boolean;
}

const WIRE = 5.5;

/** How far off its lane a conductor in hand is drawn, however far the hand goes. */
const HELD_REACH = 46;

/** How far apart a pulled pair's tips are drawn once it is fully open. */
const OPEN_SPREAD = 8;

export function EndDetail({
  id,
  end,
  dir,
  x0,
  outwardPx,
  inwardPx,
  cy,
  scale,
  marker,
  selected,
  pull,
  lift,
  plugGrip,
  plugLifted = false,
}: Props) {
  const J = end.jacketEdgeMm;
  const rear = plugRearMm(end);
  const front = plugFrontMm(end);

  // How far out of the jacket edge this panel reaches, at the bench's scale.
  const outwardMm = outwardPx / scale;
  const x = (offsetMm: number) => x0 + dir * offsetMm * scale;
  const span = (a: number, b: number) => ({ x: Math.min(x(a), x(b)), width: Math.abs(x(b) - x(a)) });

  const jacketInnerMm = inwardPx / scale;
  const jacket = span(-jacketInnerMm, 0);

  const pins = pinsAt(end);
  const laneY = (index: number) => laneCentre(index, cy);
  // Where each conductor is drawn while one of them is in hand: the row the
  // model's own move would leave behind, and the lane being held open for it.
  // A move the model has said it would refuse rearranges nothing — the rest
  // stay put, and only the lane being offered is marked.
  const lifted = end.fan && lift ? liftedRow(end.fan, lift.conductor, lift.refused ? null : lift.toIndex) : null;
  const laneOf = (conductor: Conductor, index: number) => lifted?.lanes.get(conductor) ?? index;
  const pairY = (index: number) => pairRowY(index, cy);
  // Where each twisted pair can be taken hold of — the very regions the
  // gesture hit-tests, so the band drawn round a pair is the pair a hand
  // closing there picks up.
  const grabs = new Map(pairRegions(id, end, scale, cy).map((region) => [region.pair, region]));
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
          x={Math.min(x(-jacketInnerMm), x(outwardMm)) - 6}
          y={cy - 74}
          width={Math.abs(x(outwardMm) - x(-jacketInnerMm)) + 12}
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
        ? end.fan.map((conductor, index) =>
            lift && lift.conductor === conductor ? null : (
              <g
                key={conductor}
                data-testid={`lane-${id}-${conductor}`}
                data-lane={laneOf(conductor, index)}
                style={{ cursor: "grab" }}
              >
                <title>{`Move ${CONDUCTOR_LABEL[conductor]} to another position in the row.`}</title>
                <Wire
                  conductor={conductor}
                  x1={x(0)}
                  x2={x(exposed(end, conductor))}
                  y1={laneY(laneOf(conductor, index))}
                  y2={laneY(laneOf(conductor, index))}
                />
              </g>
            ),
          )
        : PAIR_IDS.map((pair, index) => {
            const grab = grabs.get(pair);
            const pulled = pull && pull.pair === pair ? pull : null;
            // A pair being pulled swings out of the jacket mouth: its roots
            // stay where they are and its tips follow the hand, coming open as
            // they clear the bundle.
            const lift = pulled?.lift ?? 0;
            const open = pulled?.openness ?? 0;

            return (
              <g
                key={pair}
                data-testid={`pair-${id}-${pair}`}
                data-untwisted={end.untwisted[pair]}
                data-pulled={pulled ? "true" : undefined}
                data-open={pulled ? open.toFixed(2) : undefined}
                style={{ cursor: grab ? "grab" : undefined }}
              >
                {grab && (
                  <g data-testid={`pair-grab-${id}-${pair}`} data-x={grab.x} data-y={grab.y}>
                    <title>{`Pull the ${pair} pair away from the cable to untwist it.`}</title>
                    <rect
                      x={grab.x}
                      y={grab.y}
                      width={grab.width}
                      height={grab.height}
                      rx={6}
                      fill={pulled?.refused ? "#F43F5E" : PAIR_PAINT[pair]}
                      fillOpacity={pulled ? 0.1 : 0.14}
                    />
                    {!pulled && <PullTicks region={grab} dir={dir} />}
                  </g>
                )}
                {PAIRS[pair].map((conductor, which) =>
                  end.untwisted[pair] ? (
                    <Wire
                      key={conductor}
                      conductor={conductor}
                      x1={x(0)}
                      x2={x(exposed(end, conductor))}
                      y1={pairY(index) + (which ? 3.5 : -3.5)}
                      y2={pairY(index) + (which ? 3.5 : -3.5)}
                    />
                  ) : (
                    <TwistedWire
                      key={conductor}
                      conductor={conductor}
                      x1={x(0)}
                      x2={x(exposed(end, conductor))}
                      y1={pairY(index)}
                      y2={pairY(index) + lift + (which ? 1 : -1) * OPEN_SPREAD * open}
                      phase={which}
                      openness={open}
                    />
                  ),
                )}
              </g>
            );
          })}

      {/* ---- The lane being held open for the conductor in hand, and the
             conductor itself, drawn over the row it came out of ---- */}
      {end.fan && lift && (
        <HeldConductor
          id={id}
          lift={lift}
          bounds={rowBounds(id, end, scale, cy)}
          x={x}
          tipMm={exposed(end, lift.conductor)}
          laneY={laneY}
          dir={dir}
        />
      )}

      {/* ---- What to do with a row of conductors, the way the shelf says what
             to do with a tool ---- */}
      {end.fan && !end.plug && (
        <text
          data-testid={`arrange-caption-${id}`}
          x={x(maxExposed(end) / 2)}
          y={cy + 48}
          textAnchor="middle"
          fontSize={9}
          fill="#A7C4B5"
          pointerEvents="none"
        >
          drag a conductor to another position
        </text>
      )}

      {/* ---- What to do with a twisted pair, the way the shelf says what to
             do with a tool. Nothing about whether any of it is right. ---- */}
      {grabs.size > 0 && (
        <text
          data-testid={`pull-caption-${id}`}
          x={x(maxExposed(end) / 2)}
          y={cy + 58}
          textAnchor="middle"
          fontSize={9}
          fill="#A7C4B5"
          pointerEvents="none"
        >
          pull a pair off the cable to untwist it
        </text>
      )}

      {/* ---- Nicks: the stripper blade scored all eight here ---- */}
      {end.nicksAtMm.map((n) => (
        <g key={n} data-testid={`nick-${id}`}>
          <line x1={x(J - n)} x2={x(J - n)} y1={cy - 36} y2={cy + 36} stroke="#F43F5E" strokeWidth={2.5} />
          <text x={x(J - n)} y={cy - 40} textAnchor="middle" fontSize={10} fill="#FDA4AF" fontWeight={600}>
            nick
          </text>
        </g>
      ))}

      {/* ---- Jacket, over the conductor roots. The very band a tool
             hit-tests when it is standing on this end's jacket. ---- */}
      <rect
        data-testid={`jacket-${id}`}
        {...jacket}
        y={cy - JACKET_HALF}
        height={2 * JACKET_HALF}
        fill="#8C96A3"
      />
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
      {/* ---- Where a hand takes hold of the fitted plug: along its length,
             above the conductor row and below it, never over a conductor ---- */}
      {end.plug && plugGrip && (
        <g data-testid={`plug-grip-${id}`} data-x={plugGrip.x} data-width={plugGrip.width} style={{ cursor: "grab" }}>
          <title>Push the plug further on, or pull it off the cable.</title>
          {plugGrip.bands.map((band, index) => (
            <rect
              key={index}
              x={plugGrip.x}
              y={band.y}
              width={plugGrip.width}
              height={band.height}
              rx={4}
              fill="#9CC3E6"
              fillOpacity={plugLifted ? 0.06 : 0.16}
            />
          ))}
        </g>
      )}

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
          lifted={plugLifted}
        />
      )}

      {/* ---- Position numbers at the tips, matching the Arrange row ---- */}
      {end.fan && !end.plug && (
        <g data-testid={`positions-${id}`}>
          {end.fan.map((conductor, index) =>
            lift && lift.conductor === conductor ? null : (
              <text
                key={conductor}
                x={x(exposed(end, conductor)) + dir * 7}
                y={laneY(laneOf(conductor, index)) + 3}
                textAnchor="middle"
                fontSize={8}
                fill="#CBD5E1"
              >
                {laneOf(conductor, index) + 1}
              </text>
            ),
          )}
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

    </g>
  );
}

function Wire({
  conductor,
  x1,
  x2,
  y1,
  y2,
}: {
  conductor: Conductor;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}) {
  const paint = CONDUCTOR_PAINT[conductor];
  if (x1 === x2) return null;

  return (
    <g>
      <line x1={x1} x2={x2} y1={y1} y2={y2} stroke={paint.base} strokeWidth={WIRE} strokeLinecap="butt" />
      {paint.stripe && (
        <line x1={x1} x2={x2} y1={y1} y2={y2} stroke={paint.stripe} strokeWidth={WIRE} strokeDasharray="4 3" />
      )}
      <circle cx={x2} cy={y2} r={2} fill="#C98A3C" />
    </g>
  );
}

/**
 * One conductor of a twisted pair, from its root at the jacket mouth to its
 * tip.
 *
 * `openness` is how far the pair has been pulled apart: at 0 the two wind
 * round each other as they left the factory, and by 1 the winding is gone and
 * the wire runs straight out to wherever its tip has been taken. Drawing only
 * — it comes from the hand's travel, and says nothing about whether the model
 * will accept the untwist.
 */
function TwistedWire({
  conductor,
  x1,
  x2,
  y1,
  y2,
  phase,
  openness = 0,
}: {
  conductor: Conductor;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  phase: number;
  openness?: number;
}) {
  const paint = CONDUCTOR_PAINT[conductor];
  const length = Math.abs(x2 - x1);
  if (length < 1) return null;

  const step = 7;
  const sign = x2 > x1 ? 1 : -1;
  const turns = Math.max(1, Math.round(length / step));
  const amp = (phase ? 3.8 : -3.8) * (1 - openness);
  const atTurn = (turn: number) => y1 + (y2 - y1) * (turn / turns);
  let d = `M ${x1} ${y1}`;

  for (let turn = 0; turn < turns; turn++) {
    const a = x1 + sign * (turn * length) / turns;
    const b = x1 + sign * ((turn + 1) * length) / turns;
    const mid = (atTurn(turn) + atTurn(turn + 1)) / 2;
    d += ` Q ${(a + b) / 2} ${mid + (turn % 2 ? -amp : amp)} ${b} ${atTurn(turn + 1)}`;
  }

  return (
    <g>
      <path d={d} stroke={paint.base} strokeWidth={WIRE - 1} fill="none" />
      {paint.stripe && <path d={d} stroke={paint.stripe} strokeWidth={WIRE - 1} fill="none" strokeDasharray="4 3" />}
      {openness > 0 && <circle cx={x2} cy={y2} r={2} fill="#C98A3C" />}
    </g>
  );
}

/**
 * A conductor out of the row: the lane being held open for it, and the wire
 * itself, still rooted at the jacket mouth with its far end in the hand.
 *
 * The lane is drawn whenever one is being offered, in the refusal's own colour
 * when the model has said it would refuse this move — it says where the wire
 * would go, never whether it belongs there.
 */
function HeldConductor({
  id,
  lift,
  bounds,
  x,
  tipMm,
  laneY,
  dir,
}: {
  id: EndId;
  lift: NonNullable<ConductorLift>;
  bounds: { x: number; y: number; width: number; height: number } | null;
  x: (offsetMm: number) => number;
  tipMm: number;
  laneY: (index: number) => number;
  dir: 1 | -1;
}) {
  const tone = lift.refused ? "#F43F5E" : "#38BDF8";
  const root = laneY(lift.fromIndex);
  // The hand moves the wire up and down the row; how far out it reaches is its
  // own length, which no amount of dragging changes.
  const heldY = Math.min(root + HELD_REACH, Math.max(root - HELD_REACH, lift.at.y));
  const tip = x(tipMm);

  return (
    <g data-testid={`held-${id}`} data-conductor={lift.conductor} data-to-index={lift.toIndex ?? ""} pointerEvents="none">
      {lift.toIndex !== null && bounds && (
        <g data-testid={`insertion-${id}`} data-index={lift.toIndex}>
          <rect
            x={bounds.x}
            y={laneY(lift.toIndex) - LANE_GAP / 2 + 0.5}
            width={bounds.width}
            height={LANE_GAP - 1}
            rx={3}
            fill={tone}
            fillOpacity={0.16}
            stroke={tone}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          {/* The caret: this lane, at the jacket mouth the wire comes out of. */}
          <path
            d={`M ${x(0)} ${laneY(lift.toIndex) - 4} L ${x(0) + dir * 6} ${laneY(lift.toIndex)} L ${x(0)} ${laneY(lift.toIndex) + 4} Z`}
            fill={tone}
          />
        </g>
      )}

      {/* A leader to the hand, so the wire and the hand read as one thing even
          when the hand has wandered off the row. */}
      <line x1={tip} x2={lift.at.x} y1={heldY} y2={lift.at.y} stroke={tone} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 4" />
      <line x1={x(0)} x2={tip} y1={root} y2={heldY} stroke={tone} strokeOpacity={0.5} strokeWidth={WIRE + 5} strokeLinecap="round" />
      <Wire conductor={lift.conductor} x1={x(0)} x2={tip} y1={root} y2={heldY} />
    </g>
  );
}

/**
 * Which way a pair comes apart: a tick above its band and one below. The cable
 * runs along the bench, so a pair leaves it upward or downward.
 */
function PullTicks({
  region,
  dir,
}: {
  region: { x: number; y: number; width: number; height: number };
  dir: 1 | -1;
}) {
  // At the tip end of the band, where the braid has finished and the ticks
  // are not drawn over it.
  const cx = dir === 1 ? region.x + region.width - 5 : region.x + 5;
  const top = region.y + 2;
  const bottom = region.y + region.height - 2;

  return (
    <g
      stroke="#F1F5F9"
      strokeOpacity={0.8}
      strokeWidth={1.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={`M ${cx - 4.5} ${top + 4} l 4.5 -4 l 4.5 4`} />
      <path d={`M ${cx - 4.5} ${bottom - 4} l 4.5 4 l 4.5 -4`} />
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
  lifted,
}: {
  end: CableEnd;
  x: (offsetMm: number) => number;
  rearOffset: number;
  frontOffset: number;
  cy: number;
  laneY: (index: number) => number;
  pins: Conductor[];
  dir: 1 | -1;
  /** True while a hand has the plug out of its seat: it stays drawn where the model has it, faint. */
  lifted: boolean;
}) {
  const plug = end.plug!;
  const fan = end.fan!;
  const body = { x: Math.min(x(rearOffset), x(frontOffset)), width: Math.abs(x(frontOffset) - x(rearOffset)) };
  // Depths inside the plug, counted from its rear opening.
  const atDepth = (depth: number) => x(rearOffset + depth);
  const contactsUp = plug.orientation === "contacts-up";
  const bladeFill = plug.crimp === "full" ? "#E0B23C" : plug.crimp === "partial" ? "#E0B23C88" : "none";

  return (
    <g data-testid="plug" data-lifted={lifted} opacity={lifted ? 0.35 : undefined}>
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
  const color =
    marker.tone === "refused"
      ? "#F43F5E"
      : marker.kind === "cut"
        ? "#F87171"
        : marker.kind === "strip"
          ? "#38BDF8"
          : "#FBBF24";
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
