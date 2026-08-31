import { api } from "@/services/api";
import type { Topic } from "./types";

/**
 * Authoring the topics of a roadmap.
 *
 * Writes only — reading topics is contentService's job, and these go to the
 * admin endpoints the student side never touches. As with materials, access is
 * the server's decision: the API refuses anyone without canManageContent(), so
 * nothing here re-decides it and the admin screens simply never reach a
 * student.
 *
 * A topic's position is not a field on it. Where a topic sits decides which
 * topics unlock after it, so moving one goes through reorderTopics with the
 * whole running order at once, and saveTopic never touches it.
 */

interface ApiTopic {
  id: number;
  roadmap_id: number;
  title: string;
  description: string | null;
  ytube_link: string | null;
  order: number;
  challenges_count?: number;
}

function toTopic(topic: ApiTopic): Topic {
  return {
    id: topic.id,
    roadmapId: topic.roadmap_id,
    title: topic.title,
    description: topic.description,
    videoUrl: topic.ytube_link,
    order: topic.order,
    challengesCount: topic.challenges_count ?? null,
    // These endpoints are staff-facing and answer about the topic, not about
    // any one student, so there is no standing to report.
    progress: null,
  };
}

/** What the author is saving. */
export interface TopicDraft {
  title: string;
  description: string;
  videoUrl: string;
}

export const EMPTY_TOPIC_DRAFT: TopicDraft = {
  title: "",
  description: "",
  videoUrl: "",
};

export function draftOfTopic(topic: Topic): TopicDraft {
  return {
    title: topic.title,
    description: topic.description ?? "",
    videoUrl: topic.videoUrl ?? "",
  };
}

/**
 * Packs a draft for the API.
 *
 * An empty box means "no description" rather than "an empty description", so
 * the blanks go as null — which is what the API reads as clearing the field.
 */
function toPayload(draft: TopicDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    ytube_link: draft.videoUrl.trim() || null,
  };
}

/**
 * Adds a topic to a roadmap.
 *
 * `position` is a place in the running order, not a column value: left out the
 * topic is appended, which is what adding one more usually means. The server
 * shifts what follows out of the way and renumbers, so the order stays without
 * gaps or ties whatever is sent.
 */
export async function createTopic(
  roadmapId: number,
  draft: TopicDraft,
  position?: number,
): Promise<Topic> {
  const { data } = await api.post<{ data: ApiTopic }>(
    `/admin/roadmaps/${roadmapId}/topics`,
    position === undefined
      ? toPayload(draft)
      : { ...toPayload(draft), order: position },
  );

  return toTopic(data);
}

export async function updateTopic(
  topicId: number,
  draft: TopicDraft,
): Promise<Topic> {
  // PUT rather than PATCH, and a whole draft rather than a diff: the form
  // holds every editable field, so what it sends is the complete new state.
  // The route takes either verb; there is no file here, so unlike a material
  // edit this needs no method spoofing.
  const { data } = await api.put<{ data: ApiTopic }>(
    `/admin/topics/${topicId}`,
    toPayload(draft),
  );

  return toTopic(data);
}

export async function deleteTopic(topicId: number): Promise<void> {
  await api.delete(`/admin/topics/${topicId}`);
}

/**
 * Stores a new running order.
 *
 * The whole list is sent, not a moved pair — and the server insists on it,
 * because a partial list would renumber the topics it left out and move
 * students' unlock chain in a way nobody asked for.
 */
export async function reorderTopics(
  roadmapId: number,
  topicIds: number[],
): Promise<Topic[]> {
  const { data } = await api.put<{ data: ApiTopic[] }>(
    `/admin/roadmaps/${roadmapId}/topics/order`,
    { topic_ids: topicIds },
  );

  return data.map(toTopic);
}

/**
 * What is wrong with this draft, per field, or nothing.
 *
 * The server validates all of this again and has the final say; this exists so
 * an author is told which field to fix without a round trip.
 */
export function validateTopicDraft(
  draft: TopicDraft,
): Partial<Record<"title" | "videoUrl", string>> {
  const errors: Partial<Record<"title" | "videoUrl", string>> = {};

  if (draft.title.trim() === "") {
    errors.title = "Give the topic a title.";
  } else if (draft.title.trim().length > 255) {
    errors.title = "Keep the title under 255 characters.";
  }

  // Optional, but if there is one it has to be an address a browser can open —
  // a javascript: or mailto: link is refused by the server and has no business
  // in a lesson.
  const url = draft.videoUrl.trim();

  if (url !== "" && !/^https?:\/\/\S+$/i.test(url)) {
    errors.videoUrl = "The address must start with http:// or https://.";
  }

  return errors;
}
