/**
 * The tray of RJ45 plugs. Picking one up is a UI choice — the plug is taken
 * from the tray only when the model accepts an insert.
 */

interface Props {
  remaining: number;
  total: number;
  picked: boolean;
  onPick: () => void;
  onPutBack: () => void;
}

export function PlugTray({ remaining, total, picked, onPick, onPutBack }: Props) {
  const used = total - remaining;
  const inTray = picked ? remaining - 1 : remaining;

  return (
    <section aria-label="Plug tray" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Plug tray</h3>
        <span className="text-[11px] text-slate-500 tabular-nums" data-testid="tray-count">
          {remaining} left · {used} used
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: inTray }, (_, index) =>
          index === 0 && !picked ? (
            <button
              key="pick"
              type="button"
              onClick={onPick}
              aria-label="Pick up a plug"
              className="flex h-9 w-7 items-end justify-center rounded-md border border-sky-400 bg-sky-100 pb-1 hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <PlugGlyph />
            </button>
          ) : (
            <span
              key={`plug-${index}`}
              className="flex h-9 w-7 items-end justify-center rounded-md border border-sky-200 bg-sky-50 pb-1"
              aria-hidden="true"
            >
              <PlugGlyph />
            </span>
          ),
        )}
        {Array.from({ length: used }, (_, index) => (
          <span key={`used-${index}`} className="h-9 w-7 rounded-md border border-dashed border-slate-300" aria-hidden="true" />
        ))}
        {remaining === 0 && <span className="text-xs text-slate-500">Empty</span>}
      </div>
      {!picked && remaining > 0 && <p className="mt-1 text-[11px] text-slate-500">Click a plug to pick it up.</p>}

      {picked && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-300">
          <PlugGlyph />
          <span>Plug in hand</span>
          <button type="button" onClick={onPutBack} className="ml-auto underline underline-offset-2">
            put back
          </button>
        </div>
      )}
    </section>
  );
}

function PlugGlyph() {
  return (
    <svg viewBox="0 0 14 20" className="h-5 w-3.5" aria-hidden="true">
      <rect x="1" y="4" width="12" height="15" rx="2" fill="#E0F2FE" stroke="#0EA5E9" />
      {[3, 5, 7, 9, 11].map((x) => (
        <line key={x} x1={x} x2={x} y1="15" y2="18" stroke="#CA8A04" strokeWidth="1" />
      ))}
      <path d="M4 4 L5 1 L9 1 L10 4" fill="none" stroke="#0EA5E9" />
    </svg>
  );
}
