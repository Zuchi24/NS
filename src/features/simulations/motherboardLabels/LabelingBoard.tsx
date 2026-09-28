import { LABEL_WIDTH, leaderStart, toPercent, viewBoxOf, type Box } from "./board";
import type { LabelingSetup } from "./config";

/**
 * The board, its numbered marks, and a box to name each one.
 *
 * Two layouts of the same drawing. Wide, the whole drawing is shown with a
 * label box beside each part and a leader line from box to mark. Narrow, the
 * drawing is cropped to the board — the same file, a smaller viewBox — and
 * the boxes become a numbered list beneath it. Either way the marks and the
 * boxes share their numbers, and the inputs come in that order, so the tab
 * order follows the numbers.
 *
 * Nothing here knows what any part is. A box is named "Component n" and
 * described by how its part looks and where it is; the answer is the server's.
 */
export function LabelingBoard({
  setup,
  answers,
  onChange,
  layout,
  disabled = false,
}: {
  setup: LabelingSetup;
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  layout: "wide" | "narrow";
  disabled?: boolean;
}) {
  const { board, regions } = setup;
  const frame = layout === "wide" ? board.viewBox : board.crop;

  const input = (id: string, number: number, className: string) => (
    <input
      id={`label-${id}`}
      data-mark={id}
      type="text"
      value={answers[id] ?? ""}
      onChange={(event) => onChange(id, event.target.value)}
      aria-label={`Component ${number}`}
      aria-describedby={`label-${id}-where`}
      maxLength={64}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      disabled={disabled}
      className={`min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 ${className}`}
    />
  );

  const badge = (number: number) => (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
    >
      {number}
    </span>
  );

  const where = (id: string, description: string) => (
    <span id={`label-${id}-where`} className="sr-only">
      {description}
    </span>
  );

  return (
    <div data-layout={layout}>
      <div className="relative w-full" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
        <Drawing setup={setup} frame={frame} leaders={layout === "wide"} />

        {layout === "wide" &&
          regions.map((region, index) => {
            const at = toPercent(
              { x: region.labelAt.x - LABEL_WIDTH / 2, y: region.labelAt.y },
              frame,
            );

            return (
              <div
                key={region.id}
                data-label-box={region.id}
                className="absolute flex -translate-y-1/2 items-center gap-1.5"
                style={{ left: `${at.left}%`, top: `${at.top}%`, width: `${(LABEL_WIDTH / frame.width) * 100}%` }}
              >
                {badge(index + 1)}
                {input(region.id, index + 1, "w-full")}
                {where(region.id, region.description)}
              </div>
            );
          })}
      </div>

      {layout === "narrow" && (
        <ol className="mt-4 space-y-2">
          {regions.map((region, index) => (
            <li key={region.id} data-label-box={region.id} className="flex items-center gap-2">
              {badge(index + 1)}
              {input(region.id, index + 1, "flex-1")}
              {where(region.id, region.description)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The drawing itself, loaded from its file rather than redrawn here, with the
 * marks — and, when the labels are around it, the leader lines — on top, in
 * the drawing's own coordinates so they scale with it.
 */
function Drawing({ setup, frame, leaders }: { setup: LabelingSetup; frame: Box; leaders: boolean }) {
  const { board, regions } = setup;
  // The marks are drawn a little larger when the board is cropped and so shown larger.
  const radius = leaders ? 13 : 16;

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={viewBoxOf(frame)}
      role="img"
      aria-label="Motherboard with numbered marks"
    >
      <image
        href={board.src}
        x={board.viewBox.x}
        y={board.viewBox.y}
        width={board.viewBox.width}
        height={board.viewBox.height}
      />

      {leaders &&
        regions.map((region) => {
          const from = leaderStart(region);

          return (
            <line
              key={`leader-${region.id}`}
              data-leader={region.id}
              x1={from.x}
              y1={from.y}
              x2={region.anchor.x}
              y2={region.anchor.y}
              stroke="#2563EB"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}

      {regions.map((region, index) => (
        <g key={`mark-${region.id}`} data-marker={region.id} aria-hidden="true">
          <circle cx={region.anchor.x} cy={region.anchor.y} r={radius} fill="#2563EB" stroke="#FFFFFF" strokeWidth={3} />
          <text
            x={region.anchor.x}
            y={region.anchor.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontSize={radius * 1.1}
            fontWeight={700}
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
