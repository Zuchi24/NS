import { memo } from "react";

import type { PhysicalScenario } from "../../integration/publicConfig";
import { linkState } from "../../model";
import type { CableState, ElectricalReport, EndId, TesterReadout } from "../../model";
import { CONDUCTOR_LABEL, PATTERN_LABEL, VERDICT_HELP, VERDICT_LABEL, endLabel, endPhrase, endpointLabel } from "../messages";
import type { Reading } from "../useCableBench";

/**
 * The cable tester. Pressing TEST takes a reading from the model — its
 * testerReadout(), which is its wiremap seen from the MAIN end — and this
 * panel shows that reading as it was taken. Nothing here works out a map, a
 * verdict or a pattern; it only lays out the ones the model returned.
 */

interface Props {
  cable: CableState;
  scenario: PhysicalScenario;
  /** A beginner is told where an open has no contact. */
  beginner: boolean;
  reading: Reading<TesterReadout> | null;
  onTest: () => void;
}

/** Memoised: re-renders only when the cable, scenario or reading change — not on every slider tick. */
export const TesterPanel = memo(function TesterPanel({ cable, scenario, beginner, reading, onTest }: Props) {
  const portOf = (kind: "tester-main" | "tester-remote") => {
    const port = scenario.endpoints.find((endpoint) => endpoint.kind === kind);
    const end = (["A", "B"] as const).find((id) => port && cable.connections[id] === port.id);

    return end ? endLabel(end) : "—";
  };
  const stale = reading !== null && reading.cable !== cable;
  const hasDevices = scenario.endpoints.some((endpoint) => endpoint.kind === "mdi" || endpoint.kind === "mdix");
  const link = hasDevices ? linkState(cable, scenario) : null;

  return (
    <section aria-labelledby="tester-heading" className="rounded-lg bg-slate-900 p-3 text-slate-100">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="tester-heading" className="text-sm font-semibold tracking-wide">
          Cable tester
        </h2>
        <button
          type="button"
          onClick={onTest}
          className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-bold text-emerald-950 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
        >
          TEST
        </button>
      </div>

      {/* The tester itself, a MAIN unit and a REMOTE unit. A picture only: the readout below is the model's. */}
      <div className="mb-2 rounded-md bg-slate-800 px-2 py-1.5">
        <TesterIllustration />
      </div>

      <dl className="mb-2 grid grid-cols-2 gap-1 text-xs">
        <div className="rounded bg-slate-800 px-2 py-1">
          <dt className="text-slate-400">MAIN</dt>
          <dd data-testid="tester-main-end">{portOf("tester-main")}</dd>
        </div>
        <div className="rounded bg-slate-800 px-2 py-1">
          <dt className="text-slate-400">REMOTE</dt>
          <dd data-testid="tester-remote-end">{portOf("tester-remote")}</dd>
        </div>
      </dl>

      <div aria-live="polite" data-testid="tester-readout">
        {reading === null ? (
          <p className="text-xs text-slate-400">Plug one end into MAIN and the other into REMOTE, then press TEST.</p>
        ) : (
          <>
            {stale && (
              <p className="mb-1 rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-200">
                The cable has changed since this reading — press TEST again.
              </p>
            )}
            <Readout readout={reading.value} beginner={beginner} />
          </>
        )}
      </div>

      {link && (
        <p className="mt-2 text-xs" data-testid="link-state">
          Link:{" "}
          {link.connected
            ? `${endpointLabel(scenario, link.endpoints[0])} ↔ ${endpointLabel(scenario, link.endpoints[1])} — ${link.up ? "up" : "down"}`
            : "no device on both ends"}
        </p>
      )}
    </section>
  );
});

function Readout({ readout, beginner }: { readout: TesterReadout; beginner: boolean }) {
  if (readout.status === "idle") {
    return <p className="text-xs text-slate-300">Nothing in the MAIN jack — the tester has nothing to read.</p>;
  }
  if (readout.status === "no-remote") {
    return <p className="text-xs text-slate-300">MAIN reads {endLabel(readout.mainEnd)}, but finds no REMOTE unit on the far end.</p>;
  }

  return <Report report={readout.report} mainEnd={readout.mainEnd} beginner={beginner} />;
}

/**
 * Which of the model's verdicts are faults, for colouring only. A recognised
 * pattern is not called good or bad here — whether a crossover is right
 * depends on the objective, and the tester does not know the objective.
 */
const FAULTS: ReadonlySet<ElectricalReport["verdict"]> = new Set(["incomplete", "short", "open", "miswired", "split-pair"]);

function Report({ report, mainEnd, beginner }: { report: ElectricalReport; mainEnd: EndId; beginner: boolean }) {
  const kind = report.verdict === "incomplete" ? "incomplete" : FAULTS.has(report.verdict) ? "fault" : "pattern";
  const lit = new Set(report.map.filter((pin): pin is number => pin !== null));

  return (
    <div className="space-y-2">
      <div
        className={`rounded px-2 py-1 ${
          kind === "pattern" ? "bg-sky-500/20 text-sky-100" : kind === "fault" ? "bg-rose-500/20 text-rose-200" : "bg-slate-700 text-slate-200"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80" data-testid="tester-kind">
          {kind === "pattern" ? "Recognised wiring pattern" : kind === "fault" ? "Fault found" : "Can't measure yet"}
        </p>
        <p data-testid="tester-verdict" className="text-sm font-bold">
          {VERDICT_LABEL[report.verdict]}
        </p>
        <p className="text-[11px] leading-snug opacity-90" data-testid="tester-help">
          {VERDICT_HELP[report.verdict]}
          {kind === "pattern" && " Whether that's the right cable depends on what you were asked to make."}
        </p>
      </div>
      {report.pattern && report.pattern !== report.verdict && (
        <p className="text-[11px] text-slate-300" data-testid="tester-pattern">
          Underlying map: {PATTERN_LABEL[report.pattern]}
        </p>
      )}

      {report.verdict !== "incomplete" && (
        <div className="space-y-1" aria-label="Wire map">
          {/* MAIN drives every pin in turn; REMOTE lights only where a signal arrived. */}
          <LedRow label="MAIN" lit={() => true} />
          <LedRow label="REMOTE" lit={(pin) => lit.has(pin)} />
          <ol className="grid grid-cols-4 gap-x-2 font-mono text-[11px] text-slate-300" data-testid="tester-map">
            {report.map.map((far, index) => (
              <li key={index} className={far === null ? "text-rose-300" : ""}>
                {index + 1}→{far ?? "—"}
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-slate-500">Pins numbered at {endLabel(mainEnd)} (MAIN).</p>
        </div>
      )}

      {report.opens.length > 0 && (
        <ul className="text-[11px] text-rose-200">
          {report.openDetail.map((open) => (
            <li key={open.aPin}>
              Pin {open.aPin} ({CONDUCTOR_LABEL[open.conductor]}) open
              {beginner && ` — no contact at ${open.noContactAt.map(endPhrase).join(" and ")}`}
            </li>
          ))}
        </ul>
      )}
      {report.splitPairs.length > 0 && (
        <ul className="text-[11px] text-amber-200">
          {report.splitPairs.map((split) => (
            <li key={`${split.end}-${split.pins.join()}`}>
              Pins {split.pins.join("–")} at {endPhrase(split.end)} carry {CONDUCTOR_LABEL[split.conductors[0]]} and{" "}
              {CONDUCTOR_LABEL[split.conductors[1]]}, which are not a pair
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A handheld RJ45 cable tester as it sits on the bench: the MAIN unit, with
 * its power switch, and the REMOTE unit that plugs onto the far end, each a
 * cream case with a green face and a row of pin lights, and an RJ45 jack.
 * Its lights are drawn dark; what they read is the readout below, not this.
 */
function TesterIllustration() {
  const body = "#ECE8DC";
  const bodyEdge = "#C9C2AE";
  const face = "#1F6B45";
  const ink = "#E8F3EC";
  const led = "#4A1F1F";
  const pins = ["1", "2", "3", "4", "5", "6", "7", "8", "G"];

  return (
    <svg
      viewBox="0 0 200 112"
      role="img"
      aria-label="Network cable tester: a MAIN unit and a REMOTE unit, each with a row of pin lights and an RJ45 jack"
      data-testid="tester-illustration"
      className="mx-auto block h-auto w-full max-w-[14rem]"
    >
      {/* ---- MAIN unit ---- */}
      {/* its RJ45 jack, on the top edge */}
      <rect x={48} y={1} width={22} height={8} rx={1.5} fill="#2B2F33" />
      <rect x={51} y={3} width={16} height={4} rx={0.8} fill="#111418" />
      <rect x={6} y={6} width={106} height={102} rx={11} fill={body} stroke={bodyEdge} strokeWidth={1.2} />
      <rect x={16} y={15} width={86} height={62} rx={4} fill={face} />
      <text x={22} y={26} fontSize={7} fontWeight={700} fill={ink} letterSpacing="0.06em">
        CABLE TESTER
      </text>
      <text x={96} y={26} fontSize={5.5} fill={ink} textAnchor="end">
        RJ45
      </text>
      {pins.map((pin, index) => (
        <g key={pin} transform={`translate(${24 + index * 9} 44)`}>
          <circle r={2.4} fill={led} stroke="#7A3A3A" strokeWidth={0.4} />
          <text y={9} fontSize={5} fill={ink} textAnchor="middle">
            {pin}
          </text>
        </g>
      ))}
      <text x={59} y={71} fontSize={6.5} fontWeight={700} fill={ink} textAnchor="middle" letterSpacing="0.08em">
        MAIN
      </text>
      {/* the power switch, OFF · ON · S(low) */}
      <rect x={20} y={85} width={26} height={11} rx={5.5} fill="#F8F6EF" stroke={bodyEdge} strokeWidth={0.8} />
      <rect x={23} y={87} width={9} height={7} rx={2} fill="#B9B2A0" />
      <text x={50} y={93} fontSize={5} fill="#6B6656">
        OFF · ON · S
      </text>

      {/* ---- REMOTE unit ---- */}
      <rect x={128} y={10} width={64} height={98} rx={9} fill={body} stroke={bodyEdge} strokeWidth={1.2} />
      <rect x={136} y={18} width={48} height={60} rx={4} fill={face} />
      <text x={160} y={28} fontSize={6.5} fontWeight={700} fill={ink} textAnchor="middle" letterSpacing="0.08em">
        REMOTE
      </text>
      {pins.map((pin, index) => (
        <g key={pin} transform={`translate(${153} ${35 + index * 4.9})`}>
          <circle r={1.7} fill={led} stroke="#7A3A3A" strokeWidth={0.3} />
          <text x={5} y={1.8} fontSize={4.5} fill={ink}>
            {pin}
          </text>
        </g>
      ))}
      {/* its RJ45 jack, at the foot of the case */}
      <rect x={149} y={86} width={22} height={15} rx={2} fill="#2B2F33" />
      <rect x={152} y={89} width={16} height={9} rx={1} fill="#111418" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((contact) => (
        <line key={contact} x1={153.5 + contact * 1.9} x2={153.5 + contact * 1.9} y1={89.5} y2={92} stroke="#E0B23C" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

function LedRow({ label, lit }: { label: string; lit: (pin: number) => boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 text-[10px] text-slate-400">{label}</span>
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full ${lit(index + 1) ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-slate-700"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
