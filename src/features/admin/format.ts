import type { Standing } from "./types";

/** Shared wording and colour for the instructor pages, so a student's
 * standing reads the same wherever it appears. */

const STANDING_CLASSES: Record<Standing, string> = {
  on_track: "bg-green-100 text-green-700",
  progressing: "bg-blue-100 text-blue-700",
  needs_support: "bg-orange-100 text-orange-700",
  not_started: "bg-gray-100 text-gray-600",
};

export function standingClass(standing: Standing): string {
  return STANDING_CLASSES[standing];
}

/** Bands a completion figure for a progress bar or a dot. */
export function completionColor(percent: number): string {
  if (percent >= 80) return "#10b981";
  if (percent >= 60) return "#f59e0b";
  return "#ef4444";
}

/**
 * A duration the API measured. Null means it had nothing to measure, which is
 * said plainly rather than shown as zero.
 */
export function minutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${value}m`;

  const hours = Math.floor(value / 60);
  const rest = value % 60;

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
