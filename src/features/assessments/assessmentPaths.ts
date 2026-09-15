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
