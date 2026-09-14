import { useEffect, useRef, useState } from "react";

import { jacketedLengthMm } from "../model";
import type { EndId, PairId } from "../model";
import { BenchView } from "./components/BenchView";
import type { Marker } from "./components/EndDetail";
import { HandInPanel } from "./components/HandInPanel";
import { InspectionPanel } from "./components/InspectionPanel";
import { MeasurementsPanel } from "./components/MeasurementsPanel";
import { PlugTray } from "./components/PlugTray";
import { StageRail } from "./components/StageRail";
import { DEFAULT_CONTROLS, ToolControls } from "./components/ToolControls";
import type { Controls } from "./components/ToolControls";
import { TesterPanel } from "./components/TesterPanel";
import { beginnerHint } from "./hints";
import { objectiveLines } from "./messages";
import type { BenchSetup } from "./setup";
import { TOOLS } from "./tools";
import type { ToolId } from "./tools";
import { useCableBench } from "./useCableBench";

/**
 * The physical RJ45 bench.
 *
 * The cable itself is the P1 model's state and lives in useCableBench; every
 * physical change is an action the model applies or refuses. What this page
 * keeps for itself is only what the model has no business knowing: which end
 * is selected, which tool is out, where the sliders sit, whether a plug is in
 * hand.
 *
 * Standalone and prop-driven — no router, no attempt, no API. It is not yet
 * reachable from the app; P2 renders it in tests and in a development preview.
 *
 * Its setup is a challenge's public side only (see BenchSetup): the bench is
 * never told what the challenge is graded on. PRACTICE_BENCH is S1.
 */
export function PhysicalCableChallenge({ scenario, title, difficulty, description, objectives, assist }: BenchSetup) {
  const bench = useCableBench(scenario);
  const beginner = difficulty === "beginner";
  const { cable } = bench;

  const [selectedEnd, setSelectedEnd] = useState<EndId>("A");
  const [tool, setTool] = useState<ToolId>("strip");
  const [controls, setControlsState] = useState<Controls>(DEFAULT_CONTROLS);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const setControls = (patch: Partial<Controls>) => setControlsState((previous) => ({ ...previous, ...patch }));

  // A plug in hand is used up when the model takes one from the tray.
  const trayBefore = useRef(cable.tray.plugs);
  useEffect(() => {
    if (cable.tray.plugs < trayBefore.current) setControlsState((previous) => ({ ...previous, plugPicked: false }));
    trayBefore.current = cable.tray.plugs;
  }, [cable.tray.plugs]);

  const end = cable.ends[selectedEnd];
  const selectedConductor =
    controls.selectedConductor && end.fan?.includes(controls.selectedConductor) ? controls.selectedConductor : null;

  const hint = beginnerHint(cable, { difficulty, assist });

  const markers: Record<EndId, Marker> = { A: null, B: null };
  if (tool === "cut") markers[selectedEnd] = { kind: "cut", offsetMm: -controls.cutMm, label: `cut ${controls.cutMm} mm in` };
  if (tool === "strip") markers[selectedEnd] = { kind: "strip", offsetMm: -controls.stripMm, label: `strip ${controls.stripMm} mm` };
  if (tool === "trim") markers[selectedEnd] = { kind: "trim", offsetMm: controls.trimMm, label: `trim to ${controls.trimMm} mm` };

  const selectEnd = (id: EndId) => {
    setSelectedEnd(id);
    setControls({ selectedConductor: null });
  };

  const goals = objectiveLines(objectives, scenario);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1500px] px-4 py-3">
        {/* ---- Scenario header ---- */}
        <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{title}</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                {difficulty}
              </span>
            </div>
            <p className="text-sm text-slate-600">{description ?? "Terminate the cable."}</p>
            {goals.length > 0 && (
              <ul aria-label="Objectives" className="list-disc pl-5 text-sm text-slate-600">
                {goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">
              Cable <strong className="font-mono tabular-nums text-slate-900">{jacketedLengthMm(cable, scenario)} mm</strong>
            </p>
            {confirmingReset ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-700" role="group" aria-label="Confirm reset">
                Start again with a new cable?
                <button
                  type="button"
                  onClick={() => {
                    bench.reset();
                    setControlsState(DEFAULT_CONTROLS);
                    setConfirmingReset(false);
                  }}
                  className="rounded-md bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Keep working
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Reset bench
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ---- The bench and its tools ---- */}
          <main className="min-w-0 space-y-2">
            <StageRail
              cable={cable}
              selectedEnd={selectedEnd}
              onSelectEnd={selectEnd}
              instruction={hint?.text ?? null}
              instructionEnd={hint?.end ?? null}
            />

            <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10">
              <BenchView
                cable={cable}
                scenario={scenario}
                selectedEnd={selectedEnd}
                onSelectEnd={selectEnd}
                markers={markers}
                onPairClick={
                  tool === "untwist" ? (id: EndId, pair: PairId) => bench.act({ type: "untwist", end: id, pair }) : undefined
                }
                onStrip={(end, amountMm, slot) => {
                  selectEnd(end);
                  bench.act({ type: "strip", end, amountMm, slot });
                }}
                onUntwist={(end, pair) => {
                  selectEnd(end);
                  bench.act({ type: "untwist", end, pair });
                }}
                onArrange={(end, conductor, toIndex) => {
                  selectEnd(end);
                  bench.act({ type: "moveConductor", end, conductor, toIndex });
                }}
                onTrim={(end, leaveMm) => {
                  selectEnd(end);
                  bench.act({ type: "trim", end, leaveMm });
                }}
                onCut={(end, atMm) => {
                  selectEnd(end);
                  bench.act({ type: "cut", end, atMm });
                }}
                onInsert={(end, orientation, pushMm) => {
                  selectEnd(end);
                  bench.act({ type: "insert", end, orientation, pushMm });
                }}
                onPush={(end, pushMm) => {
                  selectEnd(end);
                  bench.act({ type: "push", end, pushMm });
                }}
                onWithdraw={(end) => {
                  selectEnd(end);
                  bench.act({ type: "withdraw", end });
                }}
                onCrimp={(end, squeeze) => {
                  selectEnd(end);
                  bench.act({ type: "crimp", end, squeeze });
                }}
                onConnect={(end, endpoint) => {
                  selectEnd(end);
                  bench.act({ type: "connect", end, endpoint });
                }}
                onDisconnect={(end) => {
                  selectEnd(end);
                  bench.act({ type: "disconnect", end });
                }}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Cable end" className="flex rounded-md bg-slate-100 p-0.5">
                  {(["A", "B"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selectedEnd === id}
                      onClick={() => selectEnd(id)}
                      className="rounded px-3 py-1 text-sm font-semibold text-slate-600 aria-pressed:bg-white aria-pressed:text-slate-900 aria-pressed:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      End {id}
                    </button>
                  ))}
                </div>

                <div role="toolbar" aria-label="Tools" className="flex flex-wrap gap-1">
                  {TOOLS.map(({ id, label }) => {
                    const suggested = hint?.tools.includes(id) && (hint.end === null || hint.end === selectedEnd);

                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={tool === id}
                        onClick={() => setTool(id)}
                        className={`relative rounded-md border px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          tool === id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {label}
                        {suggested && tool !== id && (
                          <>
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" aria-hidden="true" />
                            <span className="sr-only"> (suggested)</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* The tray sits beside the controls, and wraps below them when the arrange row
                  needs the full width — all eight positions must stay in view. */}
              <div className="flex flex-wrap items-start gap-3">
                <div
                  className={`min-w-0 flex-1 ${tool === "arrange" ? "basis-[40rem]" : "basis-[18rem]"}`}
                  aria-label={`${TOOLS.find((t) => t.id === tool)!.label} controls`}
                  role="region"
                >
                  <ToolControls
                    tool={tool}
                    endId={selectedEnd}
                    end={end}
                    connections={cable.connections}
                    scenario={scenario}
                    assist={assist}
                    beginner={beginner}
                    controls={{ ...controls, selectedConductor }}
                    setControls={setControls}
                    act={bench.act}
                  />
                </div>
                <div className="w-full sm:w-56 sm:shrink-0">
                  <PlugTray
                    remaining={cable.tray.plugs}
                    total={scenario.plugs}
                    picked={controls.plugPicked}
                    onPick={() => {
                      setControls({ plugPicked: true });
                      setTool("insert");
                    }}
                    onPutBack={() => setControls({ plugPicked: false })}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              {/* The live region stays mounted so screen readers keep listening to it; only
                  its content is swapped, keyed so a repeated sentence is still announced. */}
              <p
                role="status"
                aria-live="polite"
                data-testid="feedback"
                data-tone={bench.feedback?.tone ?? ""}
                className={`min-h-[2rem] rounded-md px-3 py-1.5 text-sm ${
                  bench.feedback?.tone === "refused"
                    ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                    : bench.feedback?.tone === "done"
                      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                <span key={bench.feedback?.seq ?? 0}>
                  {bench.feedback
                    ? `${bench.feedback.tone === "refused" ? "✗ Not done: " : bench.feedback.tone === "done" ? "✓ " : "• "}${bench.feedback.text}`
                    : "Choose an end and a tool, then use the controls below the bench."}
                </span>
              </p>
            </div>
          </main>

          {/* ---- Readouts ---- */}
          <aside
            className="grid content-start gap-2 md:grid-cols-2 lg:max-h-[calc(100vh-5rem)] lg:grid-cols-1 lg:overflow-y-auto"
            aria-label="Readouts"
          >
            <TesterPanel cable={cable} scenario={scenario} beginner={beginner} reading={bench.test} onTest={bench.runTest} />
            <InspectionPanel cable={cable} />
            <MeasurementsPanel cable={cable} scenario={scenario} />
            <HandInPanel cable={cable} scenario={scenario} reading={bench.handIn} onHandIn={bench.prepareHandIn} />
          </aside>
        </div>
      </div>
    </div>
  );
}
