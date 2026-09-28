import { memo } from "react";

import type { CableRecord, CableState, EndRecord, Scenario } from "../../model";
import { endpointLabel } from "../messages";
import type { Reading } from "../useCableBench";

/**
 * HAND IN: the model's toRecord() of the cable as it is, shown for review. The
 * record holds the physical termination only — no verdict, map, standard or
 * pass — because the server works those out for itself.
 *
 * The summary is read straight off that record, so what a student sees is
 * what would be sent, and it says nothing about whether the cable is right.
 *
 * Where the record then goes is not this panel's business. `wired` says only
 * whether anyone is listening: with no one listening — the standalone preview —
 * the panel says so plainly and the press goes nowhere, which is what it has
 * always done. The two flags below are the listener's own state, not a second
 * copy of it kept here.
 *
 * Memoised: re-renders only when the cable, scenario, reading or those flags
 * change — which is why they are passed as booleans rather than as an object
 * that would be new on every render.
 */
export const HandInPanel = memo(function HandInPanel({
  cable,
  scenario,
  reading,
  onHandIn,
  wired = false,
  submitting = false,
  submitted = false,
}: {
  cable: CableState;
  scenario: Scenario;
  reading: Reading<CableRecord> | null;
  onHandIn: () => void;
  /** True when someone is listening for the record. False in the preview. */
  wired?: boolean;
  /** True while the listener's handover is in flight. */
  submitting?: boolean;
  /** True once the work is in and may not be sent again. */
  submitted?: boolean;
}) {
  const stale = reading !== null && reading.cable !== cable;
  // Nothing to press while a handover is running or after one has landed: a
  // second press would be a second submission of work already sent.
  const closed = submitting || submitted;

  return (
    <section aria-labelledby="handin-heading" className="rounded-lg border border-slate-200 border-t-4 border-t-brand-teal bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="handin-heading" className="text-sm font-semibold text-slate-800">
          Hand in
        </h2>
        <button
          type="button"
          onClick={onHandIn}
          disabled={closed}
          className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300"
        >
          {submitting ? "SENDING…" : submitted ? "HANDED IN" : "HAND IN"}
        </button>
      </div>

      {reading ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="rounded bg-info/10 px-2 py-1 text-info">
            {!wired ? (
              <>
                Preview only — nothing has been submitted and no mark is given here. When hand-in is connected, the
                server will mark this record.
              </>
            ) : submitting ? (
              <>Sending this record to be marked…</>
            ) : submitted ? (
              <>Handed in. The server marks this record — no mark is given here.</>
            ) : (
              <>This is the record that is sent to be marked. No mark is given here.</>
            )}
          </p>
          {stale && <p className="rounded bg-warning/10 px-2 py-0.5 text-warning">The cable has changed since — hand in again to refresh.</p>}
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
          {wired
            ? "Shows the cable's physical record and sends it to be marked."
            : "Shows the cable's physical record as it would be handed in. In this preview nothing is submitted."}
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
