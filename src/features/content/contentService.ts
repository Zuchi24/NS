import { api } from "@/services/api";
import type { TopologyDocument } from "@/features/simulations/networkTopology/topologyDocument";
import { toMaterial } from "./materialService";
import type { ApiMaterial } from "./materialService";
import type {
  Attempt,
  Challenge,
  ChallengeActivity,
  Paginated,
  RequirementResult,
  Roadmap,
  Subtopic,
  SubtopicStatus,
  Topic,
} from "./types";

/**
 * Reads the learning content and the student's own attempts.
 *
 * Everything the API returns is snake_case; nothing outside this file should
 * have to know that.
 */

interface ApiTopic {
  id: number;
  roadmap_id: number;
  /** Null for a topic of the roadmap; the holding topic's id for a section. */
  parent_id: number | null;
  title: string;
  description: string | null;
  ytube_link: string | null;
  order: number;
  roadmap?: ApiRoadmap;
  /** Present only where the endpoint was asked to nest them. */
  subtopics?: ApiSubtopic[];
}

/**
 * A section as the API nests it under its topic.
 *
 * Its materials come along, because there is no other way to get them without
 * a request per section on every topic page. It carries no `subtopics` of its
 * own: the server serialises exactly one level and nothing deeper exists.
 */
interface ApiSubtopic {
  id: number;
  roadmap_id: number;
  parent_id: number;
  title: string;
  description: string | null;
  order: number;
  /**
   * Sent only where the server made the judgement: a student's nested sections
   * carry one, staff are sent none, and an older response has none to send.
   */
  status?: SubtopicStatus;
  materials?: ApiMaterial[];
}

interface ApiRoadmap {
  id: number;
  title: string;
  description: string;
  order: number;
  is_published: boolean;
  topics?: ApiTopic[];
}

interface ApiChallenge {
  id: number;
  title: string;
  description: string | null;
  kind?: Challenge["kind"];
  difficulty?: Challenge["difficulty"];
  config?: Challenge["config"];
  required_families?: string[];
  order: number;
}

interface ApiAttempt {
  id: number;
  challenge_id: number;
  passed: boolean;
  results: RequirementResult[] | null;
  status: Attempt["status"];
  started_at: string | null;
  completed_at: string | null;
  /** Sent by the endpoints that list or show an attempt, not by the rest. */
  challenge?: ApiChallenge;
}

interface ApiChallengeActivity {
  id: number;
  challenge_id: number;
  challenge_title: string | null;
  status: ChallengeActivity["status"];
  status_label: string;
  last_activity_at: string | null;
  completed_at: string | null;
}

function toTopic(topic: ApiTopic): Topic {
  return {
    id: topic.id,
    roadmapId: topic.roadmap_id,
    title: topic.title,
    description: topic.description,
    videoUrl: topic.ytube_link,
    order: topic.order,
    // A response from before subtopics existed says nothing here, and every
    // topic in one was a topic of its roadmap.
    parentId: topic.parent_id ?? null,
    // Left undefined when the key is absent, which is not the same as an empty
    // list: one means nobody asked, the other means there are none.
    subtopics: topic.subtopics?.map(toSubtopic),
  };
}

function toSubtopic(subtopic: ApiSubtopic): Subtopic {
  return {
    id: subtopic.id,
    roadmapId: subtopic.roadmap_id,
    parentId: subtopic.parent_id,
    title: subtopic.title,
    description: subtopic.description,
    order: subtopic.order,
    // Carried through exactly as it arrived, absence included: a response that
    // said nothing leaves this undefined rather than having a status guessed
    // for it here. What the server did not judge, this does not judge either.
    status: subtopic.status,
    // Read through the material service's own mapper, so a nested material and
    // one fetched from the materials endpoint are the same shape.
    materials: (subtopic.materials ?? []).map(toMaterial),
  };
}

function toChallenge(challenge: ApiChallenge): Challenge {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    kind: challenge.kind ?? "topology",
    // A response from before difficulty was authored says nothing; the gentlest
    // band is a better guess than the harshest, which is what the old
    // positional fallback used to hand out.
    difficulty: challenge.difficulty ?? "beginner",
    config: challenge.config ?? null,
    requiredFamilies: challenge.required_families ?? [],
    order: challenge.order,
  };
}

function toAttempt(attempt: ApiAttempt): Attempt {
  return {
    id: attempt.id,
    challengeId: attempt.challenge_id,
    challengeTitle: attempt.challenge?.title ?? null,
    passed: attempt.passed,
    results: attempt.results ?? null,
    status: attempt.status,
    startedAt: attempt.started_at,
    completedAt: attempt.completed_at,
  };
}

function toActivity(activity: ApiChallengeActivity): ChallengeActivity {
  return {
    id: activity.id,
    challengeId: activity.challenge_id,
    title: activity.challenge_title,
    status: activity.status,
    statusLabel: activity.status_label,
    at: activity.last_activity_at,
    completedAt: activity.completed_at,
  };
}

/** How many rows to ask for at once. The API caps it at 100. */
const PAGE_SIZE = 100;

function withQuery(path: string, query: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/**
 * Walks a paginated endpoint to the end. The lists here are small — tens of
 * rows — so the client would rather have all of it than manage page state.
 *
 * It asks for a large page, which normally makes this one request. If more
 * pages do come back they are fetched together rather than one after another,
 * so the wait is one round trip instead of a chain of them.
 */
async function fetchAll<T>(path: string): Promise<T[]> {
  const first = await api.get<Paginated<T>>(
    withQuery(path, `per_page=${PAGE_SIZE}`),
  );

  if (first.meta.last_page <= 1) {
    return first.data;
  }

  const rest = await Promise.all(
    Array.from({ length: first.meta.last_page - 1 }, (_, index) =>
      api.get<Paginated<T>>(
        withQuery(path, `per_page=${PAGE_SIZE}&page=${index + 2}`),
      ),
    ),
  );

  return [...first.data, ...rest.flatMap((page) => page.data)];
}

/**
 * Every published roadmap with its topics.
 *
 * `include=topics` nests them, so this is one request rather than a list
 * followed by a fetch per roadmap. Pass `withSubtopics` to nest each topic's
 * sections under it as well — the authoring tree needs them, a reading list
 * does not.
 */
export async function fetchRoadmaps(
  options: { withSubtopics?: boolean } = {},
): Promise<Roadmap[]> {
  // Opt-in, because the two callers want different things: the authoring tree
  // draws the hierarchy and needs the sections, the student's table of
  // contents lists the topics and would only be paying to ignore them.
  const include = options.withSubtopics ? "topics,subtopics" : "topics";
  const roadmaps = await fetchAll<ApiRoadmap>(`/roadmaps?include=${include}`);

  return roadmaps.map((roadmap) => ({
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description,
    order: roadmap.order,
    // The server decides who is shown a draft at all — students are never sent
    // one, so nothing here filters on this. Treated as published when the
    // field is absent, which is the safe reading: a response that does not say
    // must not have a roadmap silently marked as a draft nobody can see.
    isPublished: roadmap.is_published ?? true,
    topics: (roadmap.topics ?? []).map(toTopic),
  }));
}

/** One topic with everything its page shows. */
export interface TopicDetail {
  topic: Topic;
  roadmapTitle: string;
  /**
   * Every topic of the same roadmap in order, this one included — what the
   * page pages through with previous and next.
   *
   * Root topics only, which is the server's doing: a section is displayed
   * inside the topic holding it, never stepped into as though it were the next
   * topic.
   */
  siblings: Topic[];
  /** The sections inside this topic, each with its own materials. */
  subtopics: Subtopic[];
}

/**
 * One topic, with its challenges, the student's standing, and its siblings.
 *
 * The API nests all of it, so opening a topic is a single request.
 */
export async function fetchTopic(id: number): Promise<TopicDetail> {
  const { data } = await api.get<{ data: ApiTopic }>(`/topics/${id}`);

  return {
    topic: toTopic(data),
    roadmapTitle: data.roadmap?.title ?? "",
    siblings: (data.roadmap?.topics ?? []).map(toTopic),
    subtopics: (data.subtopics ?? []).map(toSubtopic),
  };
}

/** One section with everything its own page shows. */
export interface SubtopicDetail {
  /** The section itself, with its materials. */
  subtopic: Subtopic;
  /** The topic it is a section of — where "back" goes. */
  parent: Topic;
  roadmapTitle: string;
  /**
   * Every section of the same topic in order, this one included — what the
   * page pages through with previous and next.
   *
   * Sections of *this* topic, never the roadmap's topics: stepping out of a
   * topic is what the parent link is for, and offering it as "next" would walk
   * a student out of the topic they are reading without saying so.
   */
  siblings: Subtopic[];
}

/**
 * One section, with its materials, its topic and its fellow sections.
 *
 * Two requests, because a section only learns which topic holds it by being
 * asked for: the first names the parent, the second fetches it. The second is
 * where everything else comes from — the API nests a topic's sections with
 * their materials, so the parent's response already carries this section, the
 * rows to draw in it, and the siblings to page through. Asking the materials
 * endpoint as well would be a third request for rows already in hand.
 *
 * Null means the id does not name a section: either it is a topic of the
 * roadmap in its own right, which has a page of its own and is not this one, or
 * it has since been moved out of the topic that was holding it. A locked
 * roadmap is not this — the API refuses that with a 403, which is left to
 * throw so the caller can tell "shut" from "not a section".
 */
export async function fetchSubtopic(
  id: number,
): Promise<SubtopicDetail | null> {
  const { data } = await api.get<{ data: ApiTopic }>(`/topics/${id}`);

  if (data.parent_id === null) return null;

  const { data: parent } = await api.get<{ data: ApiTopic }>(
    `/topics/${data.parent_id}`,
  );

  const siblings = (parent.subtopics ?? []).map(toSubtopic);
  const subtopic = siblings.find((sibling) => sibling.id === id);

  if (!subtopic) return null;

  return {
    subtopic,
    parent: toTopic(parent),
    // Whichever response named it. Both load the roadmap, so in practice this
    // is the first one; the fallback is here so a section is not left with a
    // blank breadcrumb if only one of them ever stops nesting it.
    roadmapTitle: data.roadmap?.title ?? parent.roadmap?.title ?? "",
    siblings,
  };
}

/** The whole challenge catalogue. */
export async function fetchChallenges(): Promise<Challenge[]> {
  return (await fetchAll<ApiChallenge>("/challenges")).map(toChallenge);
}

/** The signed-in student's attempts. */
export async function fetchMyAttempts(): Promise<Attempt[]> {
  return (await fetchAll<ApiAttempt>("/attempts")).map(toAttempt);
}

/**
 * The signed-in student's standing on each challenge they have opened, newest
 * first.
 *
 * One row per challenge, decided and ordered by the server. Nothing here folds
 * or de-duplicates: the table it reads holds a single row per student and
 * challenge, so there is nothing left to fold.
 */
export async function fetchMyActivities(): Promise<ChallengeActivity[]> {
  return (await fetchAll<ApiChallengeActivity>("/activities")).map(toActivity);
}

/**
 * Opens an attempt, or returns the one already in progress — the server will
 * not create a second, so a double click is harmless.
 */
export async function startAttempt(challengeId: number): Promise<Attempt> {
  const response = await api.post<{ data: ApiAttempt }>("/attempts", {
    challenge_id: challengeId,
  });

  return toAttempt(response.data);
}

/** One attempt with everything the workspace needs to open it. */
export interface ActiveAttempt {
  attempt: Attempt;
  challenge: Challenge;
  /** The saved working topology, or the challenge's starting one. */
  topology: unknown;
}

/**
 * Loads an attempt the student owns. The API refuses someone else's with a
 * 403, so the workspace does not have to check ownership itself.
 */
export async function fetchAttempt(id: number): Promise<ActiveAttempt> {
  const { data } = await api.get<{
    data: ApiAttempt & {
      challenge: ApiChallenge & { initial_topology?: unknown };
      simulation?: { data: unknown };
    };
  }>(`/attempts/${id}`);

  return {
    attempt: toAttempt(data),
    challenge: toChallenge(data.challenge),
    // The simulation is created with the attempt, so it is normally there. The
    // challenge's starting topology is the fallback if it ever is not.
    topology: data.simulation?.data ?? data.challenge.initial_topology ?? null,
  };
}

/** Autosaves the working topology. Does not check it. */
export async function saveTopology(
  attemptId: number,
  data: TopologyDocument,
): Promise<void> {
  await api.put(`/attempts/${attemptId}/simulation`, { data });
}

/** Submits the work for checking and returns the marked attempt. */
export async function submitAttempt(
  attemptId: number,
  topology: TopologyDocument,
): Promise<Attempt> {
  const response = await api.post<{ data: ApiAttempt }>(
    `/attempts/${attemptId}/submit`,
    { topology },
  );

  return toAttempt(response.data);
}

/**
 * Submits work from a simulator that is not the network canvas — the PC build
 * or the cable terminator. Its shape is the simulator's own; the server knows
 * which to expect from the challenge's kind, and checks the work rather than
 * taking the page's word for it.
 */
export async function submitSimulation(
  attemptId: number,
  submission: unknown,
): Promise<Attempt> {
  const response = await api.post<{ data: ApiAttempt }>(
    `/attempts/${attemptId}/submit`,
    { submission },
  );

  return toAttempt(response.data);
}

/** Where a challenge of this kind is played. */
export function challengeRoute(challenge: Challenge, attemptId: number): string {
  const page = {
    topology: "/workspace",
    assembly: "/challenge/computer-assembly",
    cable_wiring: "/challenge/cable-wiring",
    motherboard_labels: "/challenge/motherboard-labels",
  }[challenge.kind];

  return `${page}?attempt=${attemptId}`;
}
