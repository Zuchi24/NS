/**
 * Where an author is on the roadmap page, carried in the address.
 *
 * The roadmap page picks a roadmap and opens a topic, and the assessment
 * builder is a page of its own. Without this, leaving for the builder and
 * coming back lands on whichever roadmap happens to be first, with every topic
 * folded — nowhere near the topic the author was working on. So the two ids go
 * in the query string on the way to the builder and come back out of it on the
 * way home. The address is the only thing both pages can read, and it survives
 * a refresh.
 *
 * Both are hints rather than facts. An id that no longer names a roadmap or a
 * topic is simply not found, and the page falls back as it would with none.
 */

import type { AssessmentType } from "./adminAssessmentService";

export const ROADMAP_ADMIN_PATH = "/admin/roadmap";

export interface RoadmapContext {
  roadmapId: number | null;
  topicId: number | null;
}

/** A positive whole number from the query string, or null for anything else. */
function positiveId(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);

  return id > 0 && Number.isSafeInteger(id) ? id : null;
}

export function readRoadmapContext(params: URLSearchParams): RoadmapContext {
  return {
    roadmapId: positiveId(params.get("roadmap")),
    topicId: positiveId(params.get("topic")),
  };
}

function contextQuery({ roadmapId, topicId }: Partial<RoadmapContext>): string {
  const params = new URLSearchParams();

  if (roadmapId) params.set("roadmap", String(roadmapId));
  if (topicId) params.set("topic", String(topicId));

  const query = params.toString();

  return query === "" ? "" : `?${query}`;
}

/** The roadmap page, reopened on the roadmap and topic given, if any. */
export function roadmapAdminPath(context: Partial<RoadmapContext> = {}): string {
  return `${ROADMAP_ADMIN_PATH}${contextQuery(context)}`;
}

/** The builder for one assessment, remembering where it was opened from. */
export function assessmentBuilderPath(
  assessmentId: number,
  context: Partial<RoadmapContext> = {},
): string {
  return `${ROADMAP_ADMIN_PATH}/assessments/${assessmentId}${contextQuery(context)}`;
}

/*
|--------------------------------------------------------------------------
| The archive
|--------------------------------------------------------------------------
|
| Archived versions are listed a type at a time, at /admin/archive/tests/<slug>.
| The builder opened from there carries `from=archive&type=<slug>`, so its Back
| action returns to the same list rather than to the roadmap.
*/

export const ARCHIVE_ADMIN_PATH = "/admin/archive";

/** How each type is spelled in an archive address. */
export type ArchiveTypeSlug = "pre-test" | "post-test";

const ARCHIVE_SLUGS: Record<AssessmentType, ArchiveTypeSlug> = {
  pre_test: "pre-test",
  post_test: "post-test",
};

/** The type an archive slug names, or null for anything else. */
export function archiveTypeOfSlug(slug: string | null | undefined): AssessmentType | null {
  return (
    (Object.keys(ARCHIVE_SLUGS) as AssessmentType[]).find(
      (type) => ARCHIVE_SLUGS[type] === slug,
    ) ?? null
  );
}

/** The archive of one type — the pre-tests when none is named. */
export function archiveAdminPath(type: AssessmentType = "pre_test"): string {
  return `${ARCHIVE_ADMIN_PATH}/tests/${ARCHIVE_SLUGS[type]}`;
}

/** The builder, opened from the archive of `type`, so Back returns there. */
export function archivedAssessmentBuilderPath(
  assessmentId: number,
  type: AssessmentType,
): string {
  const query = new URLSearchParams({ from: "archive", type: ARCHIVE_SLUGS[type] });

  return `${ROADMAP_ADMIN_PATH}/assessments/${assessmentId}?${query.toString()}`;
}

/** Where the builder's Back action goes, and what it is called. */
export interface BuilderReturn {
  path: string;
  label: string;
}

/**
 * Back from the builder: to the archive it was opened from, when the address
 * says so with a type it recognises; to the roadmap — with whatever roadmap
 * context rode along — otherwise. A half-written or hand-edited archive
 * context falls back to the roadmap rather than to a page that is not there.
 */
export function builderReturnOf(params: URLSearchParams): BuilderReturn {
  const archiveType = params.get("from") === "archive" ? archiveTypeOfSlug(params.get("type")) : null;

  return archiveType !== null
    ? { path: archiveAdminPath(archiveType), label: "Back to archive" }
    : { path: roadmapAdminPath(readRoadmapContext(params)), label: "Back to roadmap" };
}
