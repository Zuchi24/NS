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
