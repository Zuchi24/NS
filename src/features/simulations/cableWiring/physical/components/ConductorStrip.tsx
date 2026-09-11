import type { CableEnd, Conductor } from "../../model";
import { CONDUCTOR_LABEL } from "../messages";
import { swatchBackground } from "../paint";

/**
 * Arranging the fan: pick a conductor, then pick the position it should go
 * to. The model does the moving — lift it out, drop it in, the rest shift
 * over — and this strip just shows the row it hands back.
 *
 * Positions are counted across the flat bundle, the same numbers the bench
 * draws at the conductor tips. The beginner reference sits directly under
 * them, so each position can be read against the pin it should become.
 */

interface Props {
  end: CableEnd;
  selected: Conductor | null;
  onSelect: (conductor: Conductor | null) => void;
  onMove: (conductor: Conductor, toIndex: number) => void;
  /** Beginner reference: the order the objective names, if it names one. */
  reference: { name: string; order: readonly Conductor[] } | null;
}

const CELL = "w-[4.6rem] shrink-0";

export function ConductorStrip({ end, selected, onSelect, onMove, reference }: Props) {
  if (end.fan === null) {
    return (
      <p className="text-sm text-slate-600">
        The conductors are still in their pairs. Untwist all four pairs to lay them flat, then arrange them here.
      </p>
    );
  }

  const fan = end.fan;
  const selectedIndex = selected ? fan.indexOf(selected) : -1;

  const choose = (conductor: Conductor, index: number) => {
    if (selected === null) return onSelect(conductor);
    if (selected === conductor) return onSelect(null);

    // Placing a conductor puts it down; the arrow buttons keep it in hand for step-by-step moves.
    onMove(selected, index);
    onSelect(null);
  };

  return (
    <div className="space-y-2">
      {end.plug && (
        <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
          A plug is on this end, so the conductors can't be moved. Pull the plug off first (before it is crimped).
        </p>
      )}

      <div className="overflow-x-auto">
        <ol className="flex gap-1.5" aria-label="Conductor positions, 1 to 8 across the flat bundle">
          {fan.map((conductor, index) => {
            const isSelected = conductor === selected;

            return (
              <li key={conductor} className={CELL}>
                <button
                  type="button"
                  onClick={() => choose(conductor, index)}
                  aria-pressed={isSelected}
                  aria-label={`Position ${index + 1}: ${CONDUCTOR_LABEL[conductor]}${
                    selected && !isSelected ? ` — move ${CONDUCTOR_LABEL[selected]} here` : ""
                  }`}
                  className={`flex w-full flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSelected
                      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300"
                      : selected
                        ? "border-dashed border-slate-400 bg-white hover:border-amber-500 hover:bg-amber-50"
                        : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <span className="text-[10px] font-semibold tabular-nums text-slate-500">{index + 1}</span>
                  <span className="h-7 w-3.5 rounded-full border border-black/15" style={{ background: swatchBackground(conductor) }} />
                  <span className="text-slate-700">{CONDUCTOR_LABEL[conductor]}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {reference && (
          <ol className="mt-1 flex gap-1.5" aria-label={`${reference.name} reference, pin 1 to pin 8`}>
            {reference.order.map((conductor, index) => (
              <li key={conductor} className={`${CELL} flex flex-col items-center text-[10px] text-slate-500`}>
                <span
                  className="h-2.5 w-10 rounded-full border border-black/10"
                  style={{ background: swatchBackground(conductor) }}
                  title={CONDUCTOR_LABEL[conductor]}
                  aria-hidden="true"
                />
                <span>
                  <span className="sr-only">{CONDUCTOR_LABEL[conductor]}, </span>
                  {reference.name} pin {index + 1}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {selected ? (
          <>
            <span>
              <strong>{CONDUCTOR_LABEL[selected]}</strong> is in your hand. Pick a position: it goes there and the
              conductors in between slide over one place — nothing swaps.
            </span>
            <span className="flex items-center gap-1.5">
              <StepButton disabled={selectedIndex <= 0} onClick={() => onMove(selected, selectedIndex - 1)}>
                ◀ one place left
              </StepButton>
              <StepButton disabled={selectedIndex >= fan.length - 1} onClick={() => onMove(selected, selectedIndex + 1)}>
                one place right ▶
              </StepButton>
              <button type="button" className="underline underline-offset-2" onClick={() => onSelect(null)}>
                put it down
              </button>
            </span>
          </>
        ) : (
          <span>
            Click a conductor to pick it up, then click the position it should go to. The others slide over — it
            doesn't swap.
            {reference
              ? ` Match each position to the ${reference.name} pin under it — with the plug's contacts facing up, position 1 becomes pin 1.`
              : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function StepButton({ children, onClick, disabled }: { children: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {children}
    </button>
  );
}
