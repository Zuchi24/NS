import { PAIR_IDS, jacketedLengthMm, maxExposed } from "../../model";
import type { CableEnd, CableState, EndId, PairId, Scenario } from "../../model";
import { EndDetail } from "./EndDetail";
import type { Marker } from "./EndDetail";

/**
 * The workbench: a cutting mat with the cable lying across it, end A on the
 * left pointing left, end B on the right pointing right.
 *
 * The two ends are drawn to scale in their own detail areas; the long run of
 * cable between them is not, and is drawn broken, with its length written on
 * it — the graded, jacket-to-jacket length the model reports.
 */

interface Props {
  cable: CableState;
  scenario: Scenario;
  selectedEnd: EndId;
  onSelectEnd: (end: EndId) => void;
  markers: Record<EndId, Marker>;
  onPairClick?: (end: EndId, pair: PairId) => void;
}

const WIDTH = 1000;
const HEIGHT = 250;
const CY = 120;

const LAYOUT: Record<EndId, { x0: number; dir: 1 | -1; region: [number, number] }> = {
  // The jacket edge sits well out from the body, so ~39 mm of jacket shows for cut and strip previews.
  A: { x0: 205, dir: -1, region: [0, 440] },
  B: { x0: 795, dir: 1, region: [560, WIDTH] },
};

export function describeEnd(end: CableEnd): string {
  if (end.plug) {
    return end.plug.crimp === "full"
      ? "crimped"
      : end.plug.crimp === "partial"
        ? "half-crimped"
        : "plug fitted, not crimped";
  }
  if (end.fan) return "conductors fanned flat";

  const untwisted = PAIR_IDS.filter((pair) => end.untwisted[pair]).length;
  if (untwisted > 0) return `untwisting · ${untwisted} of 4 pairs`;

  return maxExposed(end) > 0 ? "jacket stripped" : "clean cut end";
}

export function BenchView({ cable, scenario, selectedEnd, onSelectEnd, markers, onPairClick }: Props) {
  const length = jacketedLengthMm(cable, scenario);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label={`Workbench. End A: ${describeEnd(cable.ends.A)}. End B: ${describeEnd(cable.ends.B)}. Cable ${length} mm jacket to jacket.`}
    >
      <defs>
        <pattern id="bench-mat-grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1" />
        </pattern>
      </defs>

      {/* The mat. */}
      <rect width={WIDTH} height={HEIGHT} rx={14} fill="#1D4436" />
      <rect width={WIDTH} height={HEIGHT} rx={14} fill="url(#bench-mat-grid)" />

      {/* The cable body between the two detail areas — not to scale. */}
      <rect x={LAYOUT.A.region[1]} y={CY - 22} width={LAYOUT.B.region[0] - LAYOUT.A.region[1]} height={44} fill="#8C96A3" />
      <path
        d={`M ${WIDTH / 2 - 9} ${CY - 30} l 10 60 M ${WIDTH / 2 + 1} ${CY - 30} l 10 60`}
        stroke="#1D4436"
        strokeWidth={5}
      />
      <text x={WIDTH / 2} y={CY - 36} textAnchor="middle" fontSize={13} fontWeight={700} fill="#F8FAFC" data-testid="bench-length">
        {length} mm
      </text>
      <text x={WIDTH / 2} y={CY + 42} textAnchor="middle" fontSize={10} fill="#A7C4B5">
        jacket to jacket · not to scale
      </text>

      {/* What the dots at a plug's front mean. */}
      <g fontSize={10} fill="#CBD5E1" aria-hidden="true">
        {[
          { color: "#22C55E", label: "blade pierced the conductor" },
          { color: "#F43F5E", label: "crimped, no contact" },
          { color: "#64748B", label: "not crimped yet" },
        ].map(({ color, label }, index) => (
          <g key={label} transform={`translate(${WIDTH / 2 - 250 + index * 180} ${HEIGHT - 14})`}>
            <circle r={3.5} fill={color} />
            <text x={8} y={3.5}>
              {label}
            </text>
          </g>
        ))}
      </g>

      {(["A", "B"] as const).map((id) => {
        const layout = LAYOUT[id];
        const [left, right] = layout.region;
        const outwardPx = layout.dir === 1 ? right - layout.x0 - 34 : layout.x0 - left - 34;
        const inwardPx = layout.dir === 1 ? layout.x0 - left : right - layout.x0;

        return (
          <g key={id} onClick={() => onSelectEnd(id)} style={{ cursor: "pointer" }}>
            <rect x={left} y={0} width={right - left} height={HEIGHT} fill="transparent" />
            <text
              x={layout.dir === 1 ? right - 18 : left + 18}
              y={24}
              textAnchor={layout.dir === 1 ? "end" : "start"}
              fontSize={13}
              fontWeight={700}
              fill={selectedEnd === id ? "#FDE68A" : "#E2E8F0"}
            >
              END {id}
            </text>
            <text
              x={layout.dir === 1 ? right - 18 : left + 18}
              y={40}
              textAnchor={layout.dir === 1 ? "end" : "start"}
              fontSize={11}
              fill="#A7C4B5"
            >
              {describeEnd(cable.ends[id])}
            </text>
            <EndDetail
              id={id}
              end={cable.ends[id]}
              dir={layout.dir}
              x0={layout.x0}
              outwardPx={outwardPx}
              inwardPx={inwardPx}
              cy={CY}
              marker={markers[id]}
              selected={selectedEnd === id}
              onPairClick={onPairClick ? (pair) => onPairClick(id, pair) : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
