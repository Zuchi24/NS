import { END_IDS, terminated } from "../../model";
import type { CableState, EndId } from "../../model";
import { endLabel, endPhrase } from "../messages";
import { describeEnd } from "./BenchView";

/**
 * Where the work stands, one row per end.
 *
 * A placeholder, sized to the STRIP slice: it reads the physical state the
 * bench already describes and says nothing a student could not see by looking
 * at the cable. The stage system proper — named steps, per-scenario rows —
 * belongs to the contextual phase.
 *
 * It guides and never gates. Nothing here decides whether an action is
 * allowed, and "terminated" is the model's own word for a plug that has been
 * crimped at all — not a claim that the end is wired correctly. Whether the
 * cable is right is the tester's question, and in the end the server's.
 */

interface Props {
  cable: CableState;
  selectedEnd: EndId;
  onSelectEnd: (end: EndId) => void;
  /** What usually comes next, when the challenge offers a beginner that help. */
  instruction: string | null;
  /** The end the instruction is about, when it is about one. */
  instructionEnd: EndId | null;
}

export function StageRail({ cable, selectedEnd, onSelectEnd, instruction, instructionEnd }: Props) {
  return (
    <section aria-label="Cable ends" className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {END_IDS.map((id) => {
          const end = cable.ends[id];
          const done = terminated(end);
          const active = selectedEnd === id;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelectEnd(id)}
                aria-pressed={active}
                data-testid={`stage-${id}`}
                data-terminated={done}
                className={`flex w-full items-baseline gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-slate-400"
                }`}
              >
                <span className="text-sm font-semibold text-slate-900">{endLabel(id)}</span>
                <span className="text-sm text-slate-600">{describeEnd(end)}</span>
                {done && (
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    terminated
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {instruction && (
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200" data-testid="hint">
          <span className="font-semibold">
            {instructionEnd === null ? "Next · " : `Next on ${endPhrase(instructionEnd)} · `}
          </span>
          {instruction}
        </p>
      )}
    </section>
  );
}
