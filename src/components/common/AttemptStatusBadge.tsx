import type { AttemptStatus } from "@/features/content/types";

/**
 * Where a graded attempt stands, as the chip every simulation header shows.
 *
 * Only reads the attempt the page already holds — it decides nothing. Colours
 * are the semantic ones: info while work is open, success or warning once it
 * has been marked, neutral for an attempt that was abandoned.
 */
export function AttemptStatusBadge({
  status,
  passed,
}: {
  status: AttemptStatus;
  passed: boolean;
}) {
  const { label, tone } =
    status === "in_progress"
      ? { label: "In progress", tone: "border-info/25 bg-info/10 text-info" }
      : status === "completed"
        ? passed
          ? { label: "Passed", tone: "border-success/25 bg-success/10 text-success" }
          : { label: "Not passed", tone: "border-warning/25 bg-warning/10 text-warning" }
        : { label: "Closed", tone: "border-border bg-muted text-muted-foreground" };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}
