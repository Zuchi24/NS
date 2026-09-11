import { memo } from "react";

import type { CableRecord, CableState, EndRecord, Scenario } from "../../model";
import { endpointLabel } from "../messages";
import type { Reading } from "../useCableBench";

/**
 * HAND IN, as far as P2 goes: the model's toRecord() of the cable as it is,
 * shown for review. Nothing is sent anywhere. The record holds the physical
 * termination only — no verdict, map, standard or pass — because the server
 * works those out for itself.
 *
 * The summary is read straight off that record, so what a student sees is
 * what would be sent, and it says nothing about whether the cable is right.
 *
 * Memoised: re-renders only when the cable, scenario or reading change.
 */
export const HandInPanel = memo(function HandInPanel({
  cable,
  scenario,
  reading,
  onHandIn,
}: {
  cable: CableState;
  scenario: Scenario;
  reading: Reading<CableRecord> | null;
  onHandIn: () => void;
}) {
  const stale = reading !== null && reading.cable !== cable;

  return (
    <section aria-labelledby="handin-heading" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="handin-heading" className="text-sm font-semibold text-slate-800">
          Hand in
        </h2>
        <button
          type="button"
          onClick={onHandIn}
          className="rounded-md bg-sky-700 px-3 py-1 text-sm font-semibold text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          HAND IN
        </button>
      </div>

      {reading ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="rounded bg-sky-50 px-2 py-1 text-sky-900">
            Preview only — nothing has been submitted and no mark is given here. When hand-in is connected, the server
            will mark this record.
          </p>
          {stale && <p className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">The cable has changed since — hand in again to refresh.</p>}
          <ul className="space-y-0.5 text-slate-700" data-testid="handin-summary">
            {(["A", "B"] as const).map((end) => (
              <li key={end}>
                <span className="font-semibold">End {end}:</span> {endSummary(reading.value.ends[end])}
              </li>
            ))}
            <li>
              <span className="font-semibold">Plugged into:</span> {connectionsSummary(reading.value, scenario)}
            </li>
          </ul>
          <details className="rounded border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-2 py-1 text-slate-600">cable/1 record (developer view)</summary>
            <pre className="max-h-48 overflow-auto px-2 pb-2 text-[10px] leading-snug text-slate-700" data-testid="handin-record">
              {JSON.stringify(reading.value, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Shows the cable's physical record as it would be handed in. In this preview nothing is submitted.
        </p>
      )}
    </section>
  );
});

function endSummary(end: EndRecord): string {
  if (!end.plug) return end.fan ? "conductors fanned, no plug" : "no plug";

  const face = end.plug.orientation === "contacts-up" ? "contacts up" : "contacts down";
  const crimp = { none: "not crimped", partial: "half crimped", full: "fully crimped" }[end.plug.crimp];

  return `plug on, ${face}, ${crimp}`;
}

function connectionsSummary(record: CableRecord, scenario: Scenario): string {
  const parts = (["A", "B"] as const)
    .filter((end) => record.connections[end] !== undefined)
    .map((end) => `end ${end} → ${endpointLabel(scenario, record.connections[end]!)}`);

  return parts.length ? parts.join(", ") : "nothing";
}
