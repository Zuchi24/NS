import { api } from "@/services/api";
import type { Roadmap } from "./types";

/**
 * Authoring the roadmaps themselves.
 *
 * Writes only — reading the catalogue is contentService's job, and these go to
 * the admin endpoints the student side never touches. As with topics and
 * materials, access is the server's decision: the API refuses anyone without
 * canManageContent(), so nothing here re-decides it and the admin screens
 * simply never reach a student.
 *
 * Publishing is deliberately not a field on the edit form. Whether students can
 * see a roadmap is a release decision rather than a detail of it, so the API
 * keeps it on its own routes and updateRoadmap never touches it — which is also
 * what stops a rename from quietly putting an unfinished roadmap in front of a
 * class.
 */

interface ApiRoadmap {
  id: number;
  title: string;
  description: string;
  order: number;
  is_published: boolean;
  topics_count?: number;
}

/**
 * The written roadmap, without its topics.
 *
 * These endpoints answer about the roadmap row alone — they never nest topics,
 * because a rename has nothing to say about them. Callers reload the catalogue
 * through fetchRoadmaps() after a write, which is where the topics come from.
 */
function toRoadmap(roadmap: ApiRoadmap): Roadmap {
  return {
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description,
    order: roadmap.order,
    isPublished: roadmap.is_published,
    topics: [],
  };
}

/** What the author is saving. */
export interface RoadmapDraft {
  title: string;
  description: string;
}

export const EMPTY_ROADMAP_DRAFT: RoadmapDraft = {
  title: "",
  description: "",
};

export function draftOfRoadmap(roadmap: Roadmap): RoadmapDraft {
  return {
    title: roadmap.title,
    description: roadmap.description ?? "",
  };
}

function toPayload(draft: RoadmapDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    // An empty box means "no description" rather than "an empty description".
    description: draft.description.trim() || null,
  };
}

/**
 * Adds a roadmap to the catalogue.
 *
 * It arrives as a draft: nothing is put in front of students by the act of
 * writing it down, and the author releases it with publishRoadmap() once the
 * topics under it are worth reading. Its place in the list is the server's —
 * a new roadmap goes to the end.
 */
export async function createRoadmap(draft: RoadmapDraft): Promise<Roadmap> {
  const { data } = await api.post<{ data: ApiRoadmap }>(
    "/admin/roadmaps",
    toPayload(draft),
  );

  return toRoadmap(data);
}

export async function updateRoadmap(
  roadmapId: number,
  draft: RoadmapDraft,
): Promise<Roadmap> {
  // PUT rather than PATCH, and a whole draft rather than a diff: the form
  // holds every editable field, so what it sends is the complete new state.
  // The route takes either verb.
  const { data } = await api.put<{ data: ApiRoadmap }>(
    `/admin/roadmaps/${roadmapId}`,
    toPayload(draft),
  );

  return toRoadmap(data);
}

/** Releases it: students are shown the roadmap and everything published in it. */
export async function publishRoadmap(roadmapId: number): Promise<Roadmap> {
  const { data } = await api.post<{ data: ApiRoadmap }>(
    `/admin/roadmaps/${roadmapId}/publish`,
  );

  return toRoadmap(data);
}

/**
 * Withdraws it from students without erasing anything.
 *
 * Progress, attempts and earned achievements all stay where they are — this is
 * the reversible half of the pair, and it is what the API offers instead of a
 * delete once a roadmap has student history.
 */
export async function unpublishRoadmap(roadmapId: number): Promise<Roadmap> {
  const { data } = await api.post<{ data: ApiRoadmap }>(
    `/admin/roadmaps/${roadmapId}/unpublish`,
  );

  return toRoadmap(data);
}

/**
 * Deletes a roadmap, its topics, and the files their materials hold.
 *
 * Refused with 409 once any student has history on it — progress on one of its
 * topics, an attempt at a challenge placed in one, or an achievement pointed at
 * it. The server carries the explanation in the ApiError's message, so callers
 * show that rather than inventing one.
 */
export async function deleteRoadmap(roadmapId: number): Promise<void> {
  await api.delete(`/admin/roadmaps/${roadmapId}`);
}

/**
 * What is wrong with this draft, per field, or nothing.
 *
 * The server validates all of this again and has the final say; this exists so
 * an author is told which field to fix without a round trip.
 */
export function validateRoadmapDraft(
  draft: RoadmapDraft,
): Partial<Record<"title" | "description", string>> {
  const errors: Partial<Record<"title" | "description", string>> = {};

  if (draft.title.trim() === "") {
    errors.title = "Give the roadmap a title.";
  } else if (draft.title.trim().length > 255) {
    errors.title = "Keep the title under 255 characters.";
  }

  if (draft.description.trim().length > 5000) {
    errors.description = "Keep the description under 5000 characters.";
  }

  return errors;
}
