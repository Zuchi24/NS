/**
 * Formatting for the timestamps the API returns.
 *
 * Shared rather than per-feature: "2h ago" has to mean the same thing on a
 * student's own dashboard as it does on the instructor's view of that student,
 * or the two pages quietly disagree about the same attempt.
 */

/** How long ago something happened. Null is said plainly, not guessed at. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  const days = Math.floor(seconds / 86400);

  return days === 1 ? "Yesterday" : `${days}d ago`;
}

/** A date for a record, rather than a relative age. */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";

  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
