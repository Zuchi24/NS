import type { SubtopicStatus } from "./types";

/**
 * How a student's standing on a section is put into words and colour.
 *
 * One definition, because a student meets the same three states in two places —
 * the roadmap's branches and the topic page's progress card — and two copies of
 * the wording would drift the moment either was edited. The judgement itself is
 * never made here: this only says how to draw one the server already made.
 */

/** What each standing is called, wherever a student is shown one. */
export const SUBTOPIC_STATUS_LABEL: Record<SubtopicStatus, string> = {
  completed: "Completed",
  // Not "Open", which the student flow already uses as an action.
  available: "Available",
  locked: "Locked",
};

/** The chip each standing is drawn as: the same three colours in both places. */
export const SUBTOPIC_STATUS_STYLE: Record<SubtopicStatus, string> = {
  completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  available: "text-blue-700 bg-blue-50 border-blue-200",
  locked: "text-gray-600 bg-gray-100 border-gray-200",
};

/**
 * What a control is called once its section's standing is said aloud:
 * "Open Subnetting — Locked".
 *
 * A standing shown only as a colour, an icon or a dimmed title is a standing a
 * screen reader never reports, so it goes into the control's own name rather
 * than into text beside it — there is then one name to read rather than two.
 *
 * A section with no standing keeps the plain name. The server sends none for
 * staff, and none for anything it made no judgement about; inventing "Locked"
 * for that silence would announce a lock that does not exist.
 */
export function labelWithStatus(name: string, status?: SubtopicStatus): string {
  return status === undefined ? name : `${name} — ${SUBTOPIC_STATUS_LABEL[status]}`;
}
