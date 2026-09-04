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
}

function toTopic(topic: ApiTopic): Topic {
  return {
    id: topic.id,
    roadmapId: topic.roadmap_id,
    title: topic.title,
    description: topic.description,
    videoUrl: topic.ytube_link,
    order: topic.order,
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
 * How long a topic's overview may be, in characters.
 *
 * The same number the API enforces — StoreTopicRequest::DESCRIPTION_MAX_CHARACTERS
 * — and it has to stay that way: a form that allows more produces a draft the
 * server refuses, and one that allows less refuses work the server would have
 * taken. It is an overview, not the topic's content: about three lines in the
 * card the student roadmap draws it in, which is what keeps a path of them
 * readable.
 */
export const TOPIC_DESCRIPTION_MAX = 280;

/**
 * How long an overview is, counted the way the server counts it.
 *
 * `String.length` counts UTF-16 units, so anything outside the basic plane —
 * an emoji, most rarer scripts — reads as two. Laravel's `max` rule counts
 * characters with mb_strlen, which reads it as one. Left alone, a form built on
 * `.length` refuses an overview of 280 emoji that the API would have stored,
 * and there is no way for the author to appeal it. Spreading the string counts
 * code points, which is what mb_strlen counts.
 *
 * The text is trimmed first because that is what gets stored: toPayload sends
 * the trimmed value, and Laravel trims incoming strings again before it
 * validates them, so trailing spaces can never be what puts an overview over.
 */
export function overviewLength(description: string): number {
  return [...description.trim()].length;
}

/**
 * What is wrong with this draft, per field, or nothing.
 *
 * The server validates all of this again and has the final say; this exists so
 * an author is told which field to fix without a round trip.
 */
export function validateTopicDraft(
  draft: TopicDraft,
): Partial<Record<"title" | "description" | "videoUrl", string>> {
  const errors: Partial<Record<"title" | "description" | "videoUrl", string>> =
    {};

  if (draft.title.trim() === "") {
    errors.title = "Give the topic a title.";
  } else if (draft.title.trim().length > 255) {
    errors.title = "Keep the title under 255 characters.";
  }

  // The same count the server will make, on the same text it will store.
  const overview = overviewLength(draft.description);

  if (overview > TOPIC_DESCRIPTION_MAX) {
    errors.description =
      `Keep the overview to ${TOPIC_DESCRIPTION_MAX} characters or fewer. ` +
      `That one is ${overview}.`;
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
