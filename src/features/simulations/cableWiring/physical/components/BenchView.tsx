import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { MIN_WORK, PAIR_IDS, jacketedLengthMm, maxExposed } from "../../model";
import type { CableEnd, CableState, Conductor, EndId, PairId, Scenario, StripSlot } from "../../model";
import { CY, HEIGHT, INWARD_PX, LAYOUT, OUTWARD_PX, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { bladeXAt } from "../cutterGeometry";
import { dryRun } from "../dryRun";
import { useArrangeGesture } from "../gestures/useArrangeGesture";
import { useCutGesture } from "../gestures/useCutGesture";
import { useStripGesture } from "../gestures/useStripGesture";
import { useTrimGesture } from "../gestures/useTrimGesture";
import { useUntwistGesture } from "../gestures/useUntwistGesture";
import { cutXAt } from "../jacketCutGeometry";
import { panelClaims, resolveMarkers } from "../markers";
import type { MarkerClaim } from "../markers";
import { CONDUCTOR_LABEL, PAIR_LABEL } from "../messages";
import { CableCutterShelfTool, CableCutters } from "./CableCutterTool";
import { CutterShelfTool, Cutters } from "./CutterTool";
import { EndDetail } from "./EndDetail";
import type { ConductorLift, Marker, PairPull } from "./EndDetail";
import { Stripper, StripperTools } from "./StripperTools";

/**
 * The workbench: a cutting mat with the cable lying across it, end A on the
 * left pointing left, end B on the right pointing right, and the tools on a
 * shelf along the bottom.
 *
 * The two ends are drawn to scale — one scale, shared, so a length at end A
 * and the same length at end B are the same size on screen. The long run of
 * cable between them is not to scale, and is drawn broken with its length
 * written on it.
 *
 * R1: the mat is also an input surface. A stripper can be taken off the shelf
 * and dragged onto either end, and where it comes to rest is both which end it
 * works on and how much jacket it takes. While it is on the cable the bench
 * asks the model whether that strip would be accepted and colours the gesture
 * by the answer; the model decides for real when the tool is let go.
 *
 * R2: the cable is an input surface too. A twisted pair can be taken hold of
 * where it is drawn and pulled away from the cable, which is how a pair is
 * untwisted on a real bench. Which pair is whichever one the hand closed on —
 * the drawing decides, not the selected end — and, as with the stripper, the
 * model is asked while the pull is live and decides for real on release.
 *
 * R3: once an end is fanned, a single conductor can be taken out of the row
 * and put somewhere else in it. The row holds a lane open where the wire would
 * land and the rest slide over, so what would happen is visible before the
 * hand opens. Which lane is read off the row, and whether that move is one the
 * model will make is, once again, only ever the model's answer.
 *
 * R5: the cable cutters come off the shelf too, and stand across the jacket
 * rather than the conductors. Which end they cut is the jacket they are
 * standing on — the selected end has no say in it — and, like the flush
 * cutters, they cut only when they are squeezed. What each end shows while
 * several tools are out is settled by one explicit rule (see markers).
 *
 * R4: the cutters come off the shelf and stand across the bare conductor.
 * Standing them there is not cutting: they are put down, they show the line
 * they would cut on and what would come off, and they cut only when they are
 * squeezed. Positioning never touches the cable; the squeeze is the one act
 * that reaches the model.
 */

interface Props {
  cable: CableState;
  scenario: Scenario;
  selectedEnd: EndId;
  onSelectEnd: (end: EndId) => void;
  markers: Record<EndId, Marker>;
  onPairClick?: (end: EndId, pair: PairId) => void;
  /** Send a strip the student dragged out. The model still decides. */
  onStrip: (end: EndId, amountMm: number, slot: StripSlot) => void;
  /** Send an untwist the student pulled apart. The model still decides. */
  onUntwist: (end: EndId, pair: PairId) => void;
  /** Send a conductor the student moved along the row. The model still decides. */
  onArrange: (end: EndId, conductor: Conductor, toIndex: number) => void;
  /** Send a cut the student squeezed the cutters on. The model still decides. */
  onTrim: (end: EndId, leaveMm: number) => void;
  /** Send a cut the student squeezed the cable cutters on. The model still decides. */
  onCut: (end: EndId, atMm: number) => void;
}

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

export function BenchView({
  cable,
  scenario,
  selectedEnd,
  onSelectEnd,
  markers,
  onPairClick,
  onStrip,
  onUntwist,
  onArrange,
  onTrim,
  onCut,
}: Props) {
  const length = jacketedLengthMm(cable, scenario);
  const { scale } = benchScale(cable);
  const surface = useRef<SVGSVGElement | null>(null);

  const { drag, takeTool, surfaceHandlers } = useStripGesture({ scale, surface, onCommit: onStrip });
  const untwist = useUntwistGesture({
    cable,
    scale,
    surface,
    blocked: drag !== null,
    onCommit: onUntwist,
  });

  const arrange = useArrangeGesture({
    cable,
    scale,
    surface,
    blocked: drag !== null || untwist.drag !== null,
    onCommit: onArrange,
  });

  const trim = useTrimGesture({ cable, scale, surface, onCommit: onTrim });

  const cut = useCutGesture({ cable, scale, surface, onCommit: onCut });

  // One pointer, five gestures: each hook ignores what it is not holding, so
  // the surface can simply hand the event to all of them. What they can pick
  // up never overlaps — a pair is only drawn while an end is unfanned, a
  // conductor only once it is fanned, and a tool is only ever taken by its
  // own handle, which keeps the event to itself.
  const all =
    (...handlers: ((event: ReactPointerEvent) => void)[]) =>
    (event: ReactPointerEvent) => {
      for (const handler of handlers) handler(event);
    };
  const handlers = {
    onPointerDown: all(untwist.surfaceHandlers.onPointerDown, arrange.surfaceHandlers.onPointerDown),
    onPointerMove: all(
      surfaceHandlers.onPointerMove,
      untwist.surfaceHandlers.onPointerMove,
      arrange.surfaceHandlers.onPointerMove,
      trim.surfaceHandlers.onPointerMove,
      cut.surfaceHandlers.onPointerMove,
    ),
    onPointerUp: all(
      surfaceHandlers.onPointerUp,
      untwist.surfaceHandlers.onPointerUp,
      arrange.surfaceHandlers.onPointerUp,
      trim.surfaceHandlers.onPointerUp,
      cut.surfaceHandlers.onPointerUp,
    ),
    onPointerCancel: all(
      surfaceHandlers.onPointerCancel,
      untwist.surfaceHandlers.onPointerCancel,
      arrange.surfaceHandlers.onPointerCancel,
      trim.surfaceHandlers.onPointerCancel,
      cut.surfaceHandlers.onPointerCancel,
    ),
  };

  // While the stripper is on the cable, the model is asked whether this strip
  // would be accepted. Nothing here works that out for itself.
  // The end the tool is on, if it is on one and would take anything.
  const target = drag !== null && drag.active && drag.amountMm > 0 ? drag.end : null;
  const candidate =
    target !== null && drag !== null
      ? dryRun(cable, { type: "strip", end: target, amountMm: drag.amountMm, slot: drag.slot }, scenario)
      : null;
  const refused = candidate !== null && !candidate.ok;

  // Once a pair is clear of the bundle there is a candidate untwist — an end
  // and a pair, which is the whole of the action — and the model is asked
  // about it. Nothing here works out whether it would be allowed.
  const pull = untwist.drag;
  const pullCandidate =
    pull !== null && pull.pulling ? dryRun(cable, { type: "untwist", end: pull.end, pair: pull.pair }, scenario) : null;
  const pullRefused = pullCandidate !== null && !pullCandidate.ok;
  const pulls: Record<EndId, PairPull> = { A: null, B: null };
  if (pull !== null && pull.active) {
    pulls[pull.end] = {
      pair: pull.pair,
      lift: pull.lift,
      // The pair follows the hand either way, but it is only ever drawn coming
      // open while the model is saying it would accept this: a pull it would
      // refuse must never look like one that worked.
      openness: pullRefused ? 0 : pull.openness,
      refused: pullRefused,
    };
  }

  // A conductor is out of the row: while a lane is being offered there is a
  // candidate move — an end, a conductor and an index, which is the whole of
  // the action — and the model is asked about it. Nothing here works out
  // whether the wire belongs there, or what the row is supposed to end up as.
  const held = arrange.drag;
  const heldCandidate =
    held !== null && held.active && held.toIndex !== null
      ? dryRun(
          cable,
          { type: "moveConductor", end: held.end, conductor: held.conductor, toIndex: held.toIndex },
          scenario,
        )
      : null;
  const heldRefused = heldCandidate !== null && !heldCandidate.ok;
  const lifts: Record<EndId, ConductorLift> = { A: null, B: null };
  if (held !== null && held.active) {
    lifts[held.end] = {
      conductor: held.conductor,
      fromIndex: held.fromIndex,
      toIndex: held.toIndex,
      at: held.at,
      refused: heldRefused,
    };
  }

  // Wherever the cutters are standing, the model is asked what a cut there
  // would do. Standing them somewhere changes nothing; only a squeeze does.
  const cutCandidate =
    trim.target === null
      ? null
      : dryRun(cable, { type: "trim", end: trim.target.end, leaveMm: trim.target.leaveMm }, scenario);
  const cutRefused = cutCandidate !== null && !cutCandidate.ok;

  // Wherever the cable cutters are standing, the model is asked what a cut
  // there would do to the cable. Standing them somewhere changes nothing; only
  // a squeeze does. Which end is the jacket they are on, never the selected one.
  const jacketCandidate =
    cut.target === null
      ? null
      : dryRun(cable, { type: "cut", end: cut.target.end, atMm: cut.target.atMm }, scenario);
  const jacketRefused = jacketCandidate !== null && !jacketCandidate.ok;
  /** How far behind its jacket edge a cut here would fall. The drawing's own offset, flipped. */
  const cutBackMm = cut.target === null ? 0 : -cut.target.offsetMm;

  // What each end shows, when more than one thing would draw on it. Ranked by
  // one explicit rule rather than by the order of these statements, so no
  // preview can quietly replace another (see markers).
  const claims: MarkerClaim[] = panelClaims(markers);
  if (target !== null && drag !== null) {
    claims.push({
      end: target,
      source: "in-hand",
      marker: {
        kind: "strip",
        offsetMm: -drag.amountMm,
        label: `${drag.amountMm} mm`,
        tone: refused ? "refused" : undefined,
      },
    });
  }
  if (trim.target !== null) {
    claims.push({
      end: trim.target.end,
      source: trim.cutters?.held ? "in-hand" : "standing",
      marker: {
        kind: "trim",
        offsetMm: trim.target.leaveMm,
        label: `${trim.target.leaveMm} mm`,
        tone: cutRefused ? "refused" : undefined,
      },
    });
  }
  if (cut.target !== null) {
    claims.push({
      end: cut.target.end,
      source: cut.cutters?.held ? "in-hand" : "standing",
      marker: {
        kind: "cut",
        offsetMm: cut.target.offsetMm,
        label: `${cutBackMm} mm in`,
        tone: jacketRefused ? "refused" : undefined,
      },
    });
  }
  const shown = resolveMarkers(claims);

  return (
    <svg
      ref={surface}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full touch-none select-none"
      role="img"
      aria-label={`Workbench. End A: ${describeEnd(cable.ends.A)}. End B: ${describeEnd(cable.ends.B)}. Cable ${length} mm jacket to jacket.`}
      {...handlers}
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

      {(["A", "B"] as const).map((id) => {
        const layout = LAYOUT[id];
        const [left, right] = layout.region;

        return (
          <g key={id} onClick={() => onSelectEnd(id)} style={{ cursor: "pointer" }}>
            {/* Selecting an end stops at the shelf, so taking a tool is not also a selection. */}
            <rect x={left} y={0} width={right - left} height={SHELF_TOP} fill="transparent" />
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
              outwardPx={OUTWARD_PX}
              inwardPx={INWARD_PX}
              cy={CY}
              scale={scale}
              marker={shown[id]}
              selected={
                selectedEnd === id ||
                target === id ||
                pull?.end === id ||
                held?.end === id ||
                trim.target?.end === id ||
                cut.target?.end === id
              }
              pull={pulls[id]}
              lift={lifts[id]}
              onPairClick={
                onPairClick
                  ? (pair) => {
                      // The click the browser sends after a pull is not also a tap.
                      if (!untwist.wasDragging()) onPairClick(id, pair);
                    }
                  : undefined
              }
            />
          </g>
        );
      })}

      {/* One ruler for the whole bench, since both ends are drawn at one scale. */}
      <g aria-hidden="true" pointerEvents="none">
        <line x1={WIDTH / 2 - 5 * scale} x2={WIDTH / 2 + 5 * scale} y1={186} y2={186} stroke="#E2E8F0" strokeWidth={2} />
        <line x1={WIDTH / 2 - 5 * scale} x2={WIDTH / 2 - 5 * scale} y1={182} y2={190} stroke="#E2E8F0" strokeWidth={2} />
        <line x1={WIDTH / 2 + 5 * scale} x2={WIDTH / 2 + 5 * scale} y1={182} y2={190} stroke="#E2E8F0" strokeWidth={2} />
        <text x={WIDTH / 2} y={201} textAnchor="middle" fontSize={10} fill="#CBD5E1" data-testid="bench-ruler">
          10 mm · both ends
        </text>
      </g>

      {/* What the dots at a plug's front mean. */}
      <g fontSize={10} fill="#CBD5E1" aria-hidden="true" pointerEvents="none">
        {[
          { color: "#22C55E", label: "blade pierced the conductor" },
          { color: "#F43F5E", label: "crimped, no contact" },
          { color: "#64748B", label: "not crimped yet" },
        ].map(({ color, label }, index) => (
          <g key={label} transform={`translate(${WIDTH / 2 - 250 + index * 180} ${SHELF_TOP - 11})`}>
            <circle r={3.5} fill={color} />
            <text x={8} y={3.5}>
              {label}
            </text>
          </g>
        ))}
      </g>

      <StripperTools onTake={takeTool} held={drag?.slot ?? null} />
      <CutterShelfTool onTake={trim.takeCutters} lifted={trim.cutters !== null} />
      <CableCutterShelfTool onTake={cut.takeCutters} lifted={cut.cutters !== null} />

      {/* The cutters, in hand or standing where they were put down. They cut
          when they are squeezed, and not before. */}
      {trim.cutters !== null && (
        <g
          data-testid="cutters"
          data-end={trim.target?.end ?? ""}
          data-mm={trim.target?.leaveMm ?? ""}
          data-held={trim.cutters.held}
          data-refused={cutRefused}
          // A press here is a hand on the cutters where they stand. Lifted
          // without travelling it is the squeeze, which the gesture reads off
          // the pointer: the click that follows goes to the captured drawing,
          // never to the cutters.
          style={{ cursor: trim.cutters.held ? "grabbing" : "pointer" }}
          onPointerDown={trim.pressCutters}
        >
          {trim.target !== null && <title>Squeeze the cutters to cut here</title>}
          <Cutters
            cx={trim.target === null ? trim.cutters.at.x : bladeXAt(trim.target.leaveMm, trim.target.end, scale)}
            cy={trim.cutters.at.y}
            dir={trim.target === null ? 1 : LAYOUT[trim.target.end].dir}
          />
          {trim.target !== null && (
            <g transform={`translate(${trim.cutters.at.x} ${Math.max(trim.cutters.at.y - 40, 62)})`}>
              <rect
                x={-52}
                y={-15}
                width={104}
                height={26}
                rx={5}
                fill={cutRefused ? "#4C1520" : "#0B211A"}
                stroke={cutRefused ? "#F43F5E" : "#FBBF24"}
                strokeWidth={1.5}
              />
              <text textAnchor="middle" y={-2} fontSize={12} fontWeight={700} fill={cutRefused ? "#FDA4AF" : "#FDE68A"}>
                {cutRefused ? `✗ ${trim.target.leaveMm} mm` : `${trim.target.leaveMm} mm`}
              </text>
              {!cutRefused && (
                <text textAnchor="middle" y={8} fontSize={8} fill="#94A3B8">
                  {trim.cutters.held ? "let go to stand them here" : "click to cut"}
                </text>
              )}
            </g>
          )}
        </g>
      )}

      {/* The cable cutters, in hand or standing where they were put down. They
          cut when they are squeezed, and not before. */}
      {cut.cutters !== null && (
        <g
          data-testid="cable-cutters"
          data-end={cut.target?.end ?? ""}
          data-at-mm={cut.target?.atMm ?? ""}
          data-back-mm={cut.target === null ? "" : cutBackMm}
          data-held={cut.cutters.held}
          data-refused={jacketRefused}
          // A press here is a hand on the cable cutters where they stand, read
          // the same way as the flush cutters': lifted without travelling it is
          // the squeeze, taken off the pointer rather than a click.
          style={{ cursor: cut.cutters.held ? "grabbing" : "pointer" }}
          onPointerDown={cut.pressCutters}
        >
          {cut.target !== null && <title>Squeeze the cable cutters to cut here</title>}
          <CableCutters
            cx={
              cut.target === null
                ? cut.cutters.at.x
                : cutXAt(cut.target.atMm, cut.target.end, cable.ends[cut.target.end], scale)
            }
            cy={cut.cutters.at.y}
            // Handles along the cable that stays, so what would come off is
            // left in view.
            dir={cut.target === null ? -1 : (-LAYOUT[cut.target.end].dir as 1 | -1)}
          />
          {cut.target !== null && (
            /* High on the mat: the cut's own marker writes its length just
               above the cable, and two labels on one line would collide. */
            <g transform={`translate(${Math.min(WIDTH - 70, Math.max(70, cut.cutters.at.x))} 32)`}>
              <rect
                x={-58}
                y={-15}
                width={116}
                height={26}
                rx={5}
                fill={jacketRefused ? "#4C1520" : "#0B211A"}
                stroke={jacketRefused ? "#F43F5E" : "#F87171"}
                strokeWidth={1.5}
              />
              <text
                textAnchor="middle"
                y={-2}
                fontSize={12}
                fontWeight={700}
                fill={jacketRefused ? "#FDA4AF" : "#FECACA"}
              >
                {jacketRefused ? `✗ ${cutBackMm} mm in` : `${cutBackMm} mm in`}
              </text>
              {!jacketRefused && (
                <text textAnchor="middle" y={8} fontSize={8} fill="#94A3B8">
                  {cut.cutters.held ? "let go to stand them here" : "click to cut"}
                </text>
              )}
            </g>
          )}
        </g>
      )}

      {/* The conductor in hand: which one, where it would go, and what the
          model says about putting it there. */}
      {held !== null && held.active && (
        <g
          data-testid="conductor-in-hand"
          data-end={held.end}
          data-conductor={held.conductor}
          data-to-index={held.toIndex ?? ""}
          data-refused={heldRefused}
          pointerEvents="none"
        >
          {/* Above the row, never over it: the hand works inside the row, and
              what the row is showing is the whole point. */}
          <g transform={`translate(${Math.min(WIDTH - 66, Math.max(66, held.at.x))} 62)`}>
            <rect
              x={-62}
              y={-15}
              width={124}
              height={26}
              rx={5}
              fill={heldRefused ? "#4C1520" : "#0B211A"}
              stroke={heldRefused ? "#F43F5E" : "#38BDF8"}
              strokeWidth={1.5}
            />
            <text textAnchor="middle" y={-2} fontSize={11} fontWeight={700} fill={heldRefused ? "#FDA4AF" : "#E0F2FE"}>
              {heldRefused ? `✗ ${CONDUCTOR_LABEL[held.conductor]}` : CONDUCTOR_LABEL[held.conductor]}
            </text>
            <text textAnchor="middle" y={8} fontSize={8} fill={held.toIndex === null ? "#94A3B8" : "#86EFAC"}>
              {held.toIndex === null ? "hold it over the row" : `into position ${held.toIndex + 1}`}
            </text>
          </g>
        </g>
      )}

      {/* The pair in hand: which one, and what the model says about pulling it. */}
      {pull !== null && pull.active && (
        <g
          data-testid="pair-in-hand"
          data-end={pull.end}
          data-pair={pull.pair}
          data-pulling={pull.pulling}
          data-refused={pullRefused}
          pointerEvents="none"
        >
          <line
            x1={pull.origin.x}
            x2={pull.at.x}
            y1={pull.origin.y}
            y2={pull.at.y}
            stroke={pullRefused ? "#F43F5E" : "#38BDF8"}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
          <g transform={`translate(${pull.at.x} ${Math.max(pull.at.y - 30, 62)})`}>
            <rect
              x={-52}
              y={-15}
              width={104}
              height={26}
              rx={5}
              fill={pullRefused ? "#4C1520" : "#0B211A"}
              stroke={pullRefused ? "#F43F5E" : "#38BDF8"}
              strokeWidth={1.5}
            />
            <text
              textAnchor="middle"
              y={-1}
              fontSize={12}
              fontWeight={700}
              fill={pullRefused ? "#FDA4AF" : "#E0F2FE"}
            >
              {pullRefused ? `✗ ${PAIR_LABEL[pull.pair]} pair` : `${PAIR_LABEL[pull.pair]} pair`}
            </text>
            {!pullRefused && (
              <text textAnchor="middle" y={9} fontSize={8} fill={pull.pulling ? "#86EFAC" : "#94A3B8"}>
                {pull.pulling ? "let go to untwist" : "pull away from the cable"}
              </text>
            )}
          </g>
        </g>
      )}

      {/* The stripper in hand, and what it would take. */}
      {drag !== null && drag.active && (
        <g
          data-testid="stripper-in-hand"
          data-mm={drag.amountMm}
          data-end={drag.end ?? ""}
          data-refused={refused}
          pointerEvents="none"
        >
          {target !== null && <MinWorkTick end={target} scale={scale} />}
          <Stripper slot={drag.slot} cx={drag.at.x + 14} cy={drag.at.y} />
          {target !== null && (
            <g transform={`translate(${drag.at.x + 14} ${drag.at.y - 34})`}>
              <rect
                x={-46}
                y={-15}
                width={92}
                height={26}
                rx={5}
                fill={refused ? "#4C1520" : "#0B211A"}
                stroke={refused ? "#F43F5E" : "#38BDF8"}
                strokeWidth={1.5}
              />
              <text textAnchor="middle" y={-1} fontSize={13} fontWeight={700} fill={refused ? "#FDA4AF" : "#E0F2FE"}>
                {refused ? `✗ ${drag.amountMm} mm` : `${drag.amountMm} mm`}
              </text>
              {!refused && (
                <text textAnchor="middle" y={9} fontSize={8} fill={drag.amountMm >= MIN_WORK ? "#86EFAC" : "#94A3B8"}>
                  {drag.amountMm >= MIN_WORK ? "enough to untwist" : `${MIN_WORK} mm to untwist`}
                </text>
              )}
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * Where the jacket would have to reach for a pair to be long enough to grip.
 * Guidance about the next step, not a limit on this one — the model refuses
 * an untwist that has too little to hold, and says so then.
 */
function MinWorkTick({ end, scale }: { end: EndId; scale: number }) {
  const { x0, dir } = LAYOUT[end];
  const at = x0 + dir * -MIN_WORK * scale;

  return (
    <g data-testid="min-work-tick">
      <line x1={at} x2={at} y1={CY - 30} y2={CY + 30} stroke="#86EFAC" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="3 4" />
      <text x={at} y={CY + 44} textAnchor="middle" fontSize={9} fill="#86EFAC" fillOpacity={0.9}>
        {MIN_WORK} mm
      </text>
    </g>
  );
}
