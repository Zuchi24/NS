import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { FRONT_STOP, MIN_WORK, PAIR_IDS, jacketedLengthMm, maxExposed, startingFan } from "../../model";
import type { CableEnd, CableState, Conductor, EndId, EndpointId, Orientation, PairId, Scenario, StripSlot } from "../../model";
import { CY, HEIGHT, INWARD_PX, LAYOUT, OUTWARD_PX, SHELF_TOP, WIDTH, benchScale } from "../benchGeometry";
import { crimpDieXAt } from "../crimperGeometry";
import { bladeXAt } from "../cutterGeometry";
import { dryRun } from "../dryRun";
import { useArrangeGesture } from "../gestures/useArrangeGesture";
import { useConnectGesture } from "../gestures/useConnectGesture";
import { useCrimpGesture } from "../gestures/useCrimpGesture";
import { useCutGesture } from "../gestures/useCutGesture";
import { useDisconnectGesture } from "../gestures/useDisconnectGesture";
import { useFittedPlugGesture } from "../gestures/useFittedPlugGesture";
import { useInsertGesture } from "../gestures/useInsertGesture";
import { useStripGesture } from "../gestures/useStripGesture";
import { useTrimGesture } from "../gestures/useTrimGesture";
import { useUntwistGesture } from "../gestures/useUntwistGesture";
import { cutXAt } from "../jacketCutGeometry";
import { panelClaims, resolveMarkers } from "../markers";
import type { MarkerClaim } from "../markers";
import { CONDUCTOR_LABEL, PAIR_LABEL, jacketWords } from "../messages";
import { pairOrderOf } from "../pairGeometry";
import { PLUG_GRIP, PLUG_HALF, plugFrontXAt, plugGrip, plugRearXAt } from "../plugGeometry";
import { CableCutterShelfTool, CableCutters } from "./CableCutterTool";
import { Crimper, CrimperShelfTool } from "./CrimperTool";
import { CutterShelfTool, Cutters } from "./CutterTool";
import { EndDetail } from "./EndDetail";
import type { ConductorLift, Marker, PairPull } from "./EndDetail";
import { PlugFlip, PlugGlyph, PlugSeat, PlugShelfTool } from "./PlugTool";
import { PortLayer } from "./PortLayer";
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
 *
 * R6: a plug comes off the shelf and stands on an end, lying along it with its
 * rear opening where it was put down. Which end, and how far on, are read off
 * where it stands; which way up is turned over on the plug itself. It goes on
 * only when it is pressed. While it stands, the model is asked what fitting it
 * would do — including where it would actually stop, which is drawn from the
 * model's own answer rather than worked out here.
 */

interface Props {
  cable: CableState;
  scenario: Scenario;
  selectedEnd: EndId;
  onSelectEnd: (end: EndId) => void;
  markers: Record<EndId, Marker>;
  /** Untwist by tapping a pair where it lies; only offered while the Untwist tool is out. The model still decides. */
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
  /**
   * Send a plug the student pushed onto an end. The model still decides. Without
   * it there are no plugs on the shelf to pick up.
   */
  onInsert?: (end: EndId, orientation: Orientation, pushMm: number) => void;
  /**
   * Send a push the student gave a fitted plug, or a plug they pulled off. The
   * model still decides. Without either, a fitted plug offers no grip.
   */
  onPush?: (end: EndId, pushMm: number) => void;
  onWithdraw?: (end: EndId) => void;
  /**
   * Send a crimp the student squeezed the crimper on. The model still decides.
   * Without it there is no crimper on the shelf to pick up.
   */
  onCrimp?: (end: EndId, squeeze: "full") => void;
  /**
   * Send a plug the student carried to a port by its lead and pressed in. The
   * model still decides. Without it there are no leads to carry.
   */
  onConnect?: (end: EndId, endpoint: EndpointId) => void;
  /** Send a plug the student pulled out of its port. The model still decides. */
  onDisconnect?: (end: EndId) => void;
}

/** What a bench with no way to send an insert does with one: nothing, and it never offers one. */
const NO_INSERT = () => {};

/** The same for a crimp. */
const NO_CRIMP = () => {};

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
  onInsert,
  onPush,
  onWithdraw,
  onCrimp,
  onConnect,
  onDisconnect,
}: Props) {
  const length = jacketedLengthMm(cable, scenario);
  const { scale } = benchScale(cable);
  const surface = useRef<SVGSVGElement | null>(null);
  // Each end's starting arrangement: which pair lies in which row. Drawn and
  // hit-tested from these orders, read out of the scenario's fanOrder as the
  // model reads it, so the pair under the hand is the pair on screen.
  const pairOrders = useMemo(
    () => ({ A: pairOrderOf(startingFan(scenario, "A")), B: pairOrderOf(startingFan(scenario, "B")) }),
    [scenario],
  );

  const { drag, takeTool, surfaceHandlers } = useStripGesture({ scale, surface, onCommit: onStrip });
  const untwist = useUntwistGesture({
    cable,
    scale,
    pairOrders,
    surface,
    blocked: drag !== null,
    onCommit: onUntwist,
    // A tap is read off the gesture's own press and release, never a click.
    onTap: onPairClick,
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

  const insert = useInsertGesture({ scale, surface, onCommit: onInsert ?? NO_INSERT });

  const fitted = useFittedPlugGesture({
    cable,
    scale,
    surface,
    blocked: drag !== null || untwist.drag !== null || arrange.drag !== null,
    onPush,
    onWithdraw,
  });

  const crimp = useCrimpGesture({ scale, surface, onCommit: onCrimp ?? NO_CRIMP });

  // Carrying a plug's lead to a port, and pulling a plug out of one. Neither
  // starts while a hand is already busy on the cable.
  const busy = drag !== null || untwist.drag !== null || arrange.drag !== null || fitted.drag !== null;
  const connect = useConnectGesture({
    cable,
    endpoints: scenario.endpoints,
    scale,
    surface,
    blocked: busy,
    onCommit: onConnect,
  });
  const unplug = useDisconnectGesture({
    cable,
    endpoints: scenario.endpoints,
    surface,
    blocked: busy || connect.lead?.held === true,
    onCommit: onDisconnect,
  });
  const portsOffered = connect.offered || unplug.offered;

  // A lead waiting at a port, or carried over one: a candidate connect — an
  // end and an endpoint, which is the whole of the action — and the model is
  // asked about it. Whether the port is free, whether the end is already in
  // one, and what a connection there would mean, are never worked out here.
  const lead = connect.lead;
  const leadCandidate =
    lead !== null && lead.endpoint !== null
      ? dryRun(cable, { type: "connect", end: lead.end, endpoint: lead.endpoint }, scenario)
      : null;
  const leadRefused = leadCandidate !== null && !leadCandidate.ok;
  const leadConnects =
    leadCandidate !== null && leadCandidate.ok
      ? (leadCandidate.events.flatMap((event) => (event.type === "connected" ? [event.endpoint] : []))[0] ?? null)
      : null;

  // A plug pulled far enough out of its port: a candidate disconnect — an end —
  // and the model is asked about it. Nothing here decides whether it can come out.
  const unplugging = unplug.drag;
  const unplugCandidate =
    unplugging !== null && unplugging.active && unplugging.pulled
      ? dryRun(cable, { type: "disconnect", end: unplugging.end }, scenario)
      : null;
  const unplugRefused = unplugCandidate !== null && !unplugCandidate.ok;

  // One pointer, ten gestures: each hook ignores what it is not holding, so
  // the surface can simply hand the event to all of them. What they can pick
  // up never overlaps — a pair is only drawn while an end is unfanned, a
  // conductor only once it is fanned, a fitted plug only by its grip, which
  // lies outside the conductor row it covers, a plug's lead only past its
  // front face, a plug in a port only up among the ports, and a tool is only
  // ever taken by its own handle, which keeps the event to itself.
  const all =
    (...handlers: ((event: ReactPointerEvent) => void)[]) =>
    (event: ReactPointerEvent) => {
      for (const handler of handlers) handler(event);
    };
  const handlers = {
    onPointerDown: all(
      untwist.surfaceHandlers.onPointerDown,
      arrange.surfaceHandlers.onPointerDown,
      fitted.surfaceHandlers.onPointerDown,
      connect.surfaceHandlers.onPointerDown,
      unplug.surfaceHandlers.onPointerDown,
    ),
    onPointerMove: all(
      surfaceHandlers.onPointerMove,
      untwist.surfaceHandlers.onPointerMove,
      arrange.surfaceHandlers.onPointerMove,
      trim.surfaceHandlers.onPointerMove,
      cut.surfaceHandlers.onPointerMove,
      insert.surfaceHandlers.onPointerMove,
      fitted.surfaceHandlers.onPointerMove,
      crimp.surfaceHandlers.onPointerMove,
      connect.surfaceHandlers.onPointerMove,
      unplug.surfaceHandlers.onPointerMove,
    ),
    onPointerUp: all(
      surfaceHandlers.onPointerUp,
      untwist.surfaceHandlers.onPointerUp,
      arrange.surfaceHandlers.onPointerUp,
      trim.surfaceHandlers.onPointerUp,
      cut.surfaceHandlers.onPointerUp,
      insert.surfaceHandlers.onPointerUp,
      fitted.surfaceHandlers.onPointerUp,
      crimp.surfaceHandlers.onPointerUp,
      connect.surfaceHandlers.onPointerUp,
      unplug.surfaceHandlers.onPointerUp,
    ),
    onPointerCancel: all(
      surfaceHandlers.onPointerCancel,
      untwist.surfaceHandlers.onPointerCancel,
      arrange.surfaceHandlers.onPointerCancel,
      trim.surfaceHandlers.onPointerCancel,
      cut.surfaceHandlers.onPointerCancel,
      insert.surfaceHandlers.onPointerCancel,
      fitted.surfaceHandlers.onPointerCancel,
      crimp.surfaceHandlers.onPointerCancel,
      connect.surfaceHandlers.onPointerCancel,
      unplug.surfaceHandlers.onPointerCancel,
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

  // Wherever a plug is held over an end, the model is asked what fitting it
  // there, that way up, would do. Where it would actually stop is the model's
  // own number, read off the event it would produce; nothing here works out how
  // far a plug can go on. Which end is the one it is over, never the selected one.
  const plugStand = insert.target;
  const plugCandidate =
    plugStand === null || insert.plug === null
      ? null
      : dryRun(
          cable,
          { type: "insert", end: plugStand.end, orientation: insert.plug.orientation, pushMm: plugStand.pushMm },
          scenario,
        );
  const plugRefused = plugCandidate !== null && !plugCandidate.ok;
  const plugSeat =
    plugCandidate !== null && plugCandidate.ok
      ? (plugCandidate.events.flatMap((event) => (event.type === "inserted" ? [event.jacketInMm] : []))[0] ?? null)
      : null;
  // Where the plug is drawn: along the end it is over, or in the hand wherever
  // that is, its rear opening at the hand.
  const plugDrawn =
    insert.plug === null
      ? null
      : plugStand === null
        ? { rearX: insert.plug.at.x, frontX: insert.plug.at.x + FRONT_STOP * scale, cy: insert.plug.at.y }
        : {
            rearX: plugRearXAt(plugStand.pushMm, plugStand.end, scale),
            frontX: plugFrontXAt(plugStand.pushMm, plugStand.end, scale),
            cy: CY,
          };

  // A fitted plug in hand: while it is being pushed on or pulled off there is a
  // candidate — an end and a push, or an end to take the plug off, which is the
  // whole of either action — and the model is asked about it. Where a push
  // would really stop is the model's own number, read off the event it would
  // produce; nothing here works out how far a plug can go, or whether it can
  // come off at all.
  const moving = fitted.drag;
  const plugMove = moving !== null && moving.active ? moving.move : null;
  const moveCandidate =
    moving === null || plugMove === null
      ? null
      : dryRun(
          cable,
          plugMove.kind === "push"
            ? { type: "push", end: moving.end, pushMm: plugMove.pushMm }
            : { type: "withdraw", end: moving.end },
          scenario,
        );
  const moveRefused = moveCandidate !== null && !moveCandidate.ok;
  const pushedSeat =
    plugMove !== null && plugMove.kind === "push" && moveCandidate !== null && moveCandidate.ok
      ? (moveCandidate.events.flatMap((event) => (event.type === "pushed" ? [event.jacketInMm] : []))[0] ?? null)
      : null;
  // Where the plug in hand is drawn: slid along its own end by the hand's travel.
  const movingRearX = moving === null ? 0 : plugRearXAt(moving.fromMm, moving.end, scale) + moving.dx;

  // Wherever the crimper stands, the model is asked what squeezing it there
  // would do: a full crimp of that end, which is all the bench's crimper does.
  // Whether there is a plug to crimp, and whether it can be, is never worked
  // out here. Which end is the one it stands on, never the selected one.
  const crimpCandidate =
    crimp.target === null ? null : dryRun(cable, { type: "crimp", end: crimp.target.end, squeeze: "full" }, scenario);
  const crimpRefused = crimpCandidate !== null && !crimpCandidate.ok;
  // What the model says the plug would be left as — its own word, read off the event.
  const crimpResult =
    crimpCandidate !== null && crimpCandidate.ok
      ? (crimpCandidate.events.flatMap((event) => (event.type === "crimped" ? [event.squeeze] : []))[0] ?? null)
      : null;

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
              pairOrder={pairOrders[id]}
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
                cut.target?.end === id ||
                plugStand?.end === id ||
                moving?.end === id ||
                crimp.target?.end === id ||
                lead?.end === id ||
                unplugging?.end === id
              }
              pull={pulls[id]}
              lift={lifts[id]}
              plugGrip={fitted.offered ? plugGrip(id, cable.ends[id], scale) : null}
              plugLifted={moving !== null && moving.active && moving.end === id}
            />
          </g>
        );
      })}

      {/* The ports, the leads of the plugs, and a plug on its way into a port
          or out of one. Which end is in which port is the model's alone. */}
      {portsOffered && (
        <PortLayer
          cable={cable}
          scenario={scenario}
          scale={scale}
          leads={connect.offered}
          lead={lead}
          leadRefused={leadRefused}
          leadConnects={leadConnects}
          onPressLead={connect.pressLead}
          unplugging={unplugging}
          unplugRefused={unplugRefused}
        />
      )}

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
      {onInsert && <PlugShelfTool onTake={insert.takePlug} count={cable.tray.plugs} lifted={insert.plug !== null} />}
      {onCrimp && <CrimperShelfTool onTake={crimp.takeCrimper} lifted={crimp.crimper !== null} />}

      {/* The crimper, in hand or standing on an end. It crimps when it is
          squeezed, and not before. */}
      {crimp.crimper !== null && (
        <g
          data-testid="crimper"
          data-end={crimp.target?.end ?? ""}
          data-held={crimp.crimper.held}
          data-refused={crimpRefused}
          data-crimp={crimpResult ?? ""}
          // A press here is a hand on the crimper where it stands. Lifted
          // without travelling it is the squeeze, which the gesture reads off
          // the pointer: the click that follows goes to the captured drawing,
          // never to the crimper.
          style={{ cursor: crimp.crimper.held ? "grabbing" : "pointer" }}
          onPointerDown={crimp.pressCrimper}
        >
          {crimp.target !== null && <title>Squeeze the crimper to crimp here</title>}
          <Crimper
            cx={
              crimp.target === null
                ? crimp.crimper.at.x
                : crimpDieXAt(crimp.target.end, cable.ends[crimp.target.end], scale, crimp.crimper.at.x)
            }
            cy={crimp.target === null ? crimp.crimper.at.y : CY}
            // Frame and handles to the outside of whichever end it stands on,
            // away from the cable: as drawn at End A, turned round at End B.
            mirrored={crimp.target !== null && LAYOUT[crimp.target.end].dir === 1}
          />
          {crimp.target !== null && (
            <g transform={`translate(${Math.min(WIDTH - 70, Math.max(70, crimp.crimper.at.x))} ${CY + 88})`} pointerEvents="none">
              <rect
                x={-58}
                y={-15}
                width={116}
                height={26}
                rx={5}
                fill={crimpRefused ? "#4C1520" : "#0B211A"}
                stroke={crimpRefused ? "#F43F5E" : "#E0B23C"}
                strokeWidth={1.5}
              />
              <text textAnchor="middle" y={-2} fontSize={12} fontWeight={700} fill={crimpRefused ? "#FDA4AF" : "#FDE68A"}>
                {crimpRefused ? "✗ full crimp" : "full crimp"}
              </text>
              {!crimpRefused && (
                <text textAnchor="middle" y={8} fontSize={8} fill="#94A3B8">
                  {crimp.crimper.held ? "let go to stand it here" : "squeeze to crimp"}
                </text>
              )}
            </g>
          )}
        </g>
      )}

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
               above the cable, and two labels on one line would collide.
               Picture only: up there it can lie over a port or a plug in one,
               and a press on it must reach them, never squeeze the cutters. */
            <g
              data-testid="cable-cutters-label"
              transform={`translate(${Math.min(WIDTH - 70, Math.max(70, cut.cutters.at.x))} 32)`}
              pointerEvents="none"
            >
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

      {/* The plug, in hand or standing on an end. It goes on when it is
          pressed, and not before. */}
      {insert.plug !== null && plugDrawn !== null && (
        <>
          <g
            data-testid="physical-plug"
            data-end={plugStand?.end ?? ""}
            data-push-mm={plugStand?.pushMm ?? ""}
            data-seat-mm={plugSeat ?? ""}
            data-orientation={insert.plug.orientation}
            data-held={insert.plug.held}
            data-refused={plugRefused}
            // A press here is a hand on the plug where it stands: lifted without
            // travelling it pushes the plug on, read off the pointer rather than
            // a click, which the captured drawing would take.
            style={{ cursor: insert.plug.held ? "grabbing" : "pointer" }}
            onPointerDown={insert.pressPlug}
          >
            {plugStand !== null && <title>Press the plug to push it on here</title>}
            {plugStand !== null && plugSeat !== null && plugSeat !== plugStand.pushMm && (
              <PlugSeat
                rearX={plugRearXAt(plugSeat, plugStand.end, scale)}
                frontX={plugFrontXAt(plugSeat, plugStand.end, scale)}
                cy={CY}
              />
            )}
            <PlugGlyph
              rearX={plugDrawn.rearX}
              frontX={plugDrawn.frontX}
              cy={plugDrawn.cy}
              orientation={insert.plug.orientation}
              refused={plugRefused}
            />
          </g>

          {plugStand !== null && (
            <g
              data-testid="plug-reading"
              transform={`translate(${Math.min(WIDTH - 80, Math.max(80, plugDrawn.rearX))} ${CY - PLUG_HALF - 26})`}
              pointerEvents="none"
            >
              <rect
                x={-76}
                y={-15}
                width={152}
                height={26}
                rx={5}
                fill={plugRefused ? "#4C1520" : "#0B211A"}
                stroke={plugRefused ? "#F43F5E" : "#38BDF8"}
                strokeWidth={1.5}
              />
              <text
                textAnchor="middle"
                y={-2}
                fontSize={10}
                fontWeight={700}
                fill={plugRefused ? "#FDA4AF" : "#E0F2FE"}
              >
                {plugRefused || plugSeat === null ? `✗ ${jacketWords(plugStand.pushMm)}` : jacketWords(plugSeat)}
              </text>
              {!plugRefused && (
                <text textAnchor="middle" y={8} fontSize={8} fill="#94A3B8">
                  {!insert.plug.held
                    ? "press to push it on"
                    : insert.plug.onTool
                      ? "let go to push it on"
                      : "let go to stand it here"}
                </text>
              )}
            </g>
          )}

          {!insert.plug.held && (
            <PlugFlip
              cx={(plugDrawn.rearX + plugDrawn.frontX) / 2}
              cy={plugDrawn.cy + PLUG_HALF + 26}
              orientation={insert.plug.orientation}
              onFlip={insert.flipPlug}
            />
          )}
        </>
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

      {/* The fitted plug in hand: slid along its own end, and what the model
          says about pushing it on there or pulling it off. */}
      {moving !== null && moving.active && (
        <g
          data-testid="fitted-plug-in-hand"
          data-end={moving.end}
          data-move={plugMove?.kind ?? ""}
          data-push-mm={plugMove !== null && plugMove.kind === "push" ? plugMove.pushMm : ""}
          data-seat-mm={pushedSeat ?? ""}
          data-refused={moveRefused}
          pointerEvents="none"
        >
          {plugMove !== null && plugMove.kind === "push" && pushedSeat !== null && pushedSeat !== plugMove.pushMm && (
            <PlugSeat
              rearX={plugRearXAt(pushedSeat, moving.end, scale)}
              frontX={plugFrontXAt(pushedSeat, moving.end, scale)}
              cy={CY}
            />
          )}
          <PlugGlyph
            rearX={movingRearX}
            frontX={movingRearX + LAYOUT[moving.end].dir * FRONT_STOP * scale}
            cy={CY}
            orientation={moving.orientation}
            refused={moveRefused}
          />
          <g transform={`translate(${Math.min(WIDTH - 80, Math.max(80, movingRearX))} ${CY - PLUG_HALF - PLUG_GRIP - 20})`}>
            <rect
              x={-76}
              y={-15}
              width={152}
              height={26}
              rx={5}
              fill={moveRefused ? "#4C1520" : "#0B211A"}
              stroke={moveRefused ? "#F43F5E" : "#38BDF8"}
              strokeWidth={1.5}
            />
            <text textAnchor="middle" y={-2} fontSize={10} fontWeight={700} fill={moveRefused ? "#FDA4AF" : "#E0F2FE"}>
              {plugMove === null
                ? "plug in hand"
                : plugMove.kind === "push"
                  ? moveRefused || pushedSeat === null
                    ? `✗ ${jacketWords(plugMove.pushMm)}`
                    : jacketWords(pushedSeat)
                  : moveRefused
                    ? "✗ off the cable"
                    : "off the cable"}
            </text>
            {!moveRefused && (
              <text textAnchor="middle" y={8} fontSize={8} fill="#94A3B8">
                {plugMove === null
                  ? "push it on, or pull it off"
                  : plugMove.kind === "push"
                    ? "let go to push it on"
                    : "let go to pull it off"}
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
