import { api } from "@/services/api";
import type { SubtopicStatus } from "./types";

/**
 * A student's way through one root topic: its pre-test, the subtopics inside
 * it in order, and its post-test.
 *
 * Every judgement here is the server's. Whether the pre-test is still asked
 * for, which subtopic is open, whether the post-test may be taken and why not —
 * TopicProgression works each of those out, and this module only carries the
 * answer. It does not decide anything a second time, so a page reading it can
 * never disagree with the policy that refuses a request.
 *
 * Always the signed-in student's own. No function takes a student and no
 * request names one; there is nothing to change to read someone else's.
 */

/**
 * A subtopic, as the server sees this student's standing on it.
 *
 * Declared with the rest of the content types, because the roadmap carries the
 * same judgement on its own nested sections and the two must be the one type
 * rather than two unions that happen to agree. Re-exported here so that a page
 * reading a progression still takes it from the service it came from.
 */
export type { SubtopicStatus };

/**
 * A submitted assessment's totals — nothing about which answers were right.
 *
 * With the version it was taken on. That is where its review is read from,
 * and it can be older than the version the step offers now: a student who took
 * version 1 keeps that result, and is not asked to take version 2.
 */
export interface ProgressionResult {
  /** The version the student took — the id its review is read from. */
  assessmentId: number;
  version: number;
  earnedPoints: number;
  totalPoints: number;
  percent: number;
  submittedAt: string | null;
}

export interface ProgressionPreTest {
  /** The version on offer now. */
  id: number;
  version: number;
  title: string;
  submitted: boolean;
  /** Not asked of this student: they were already under way before it existed. */
  waived: boolean;
  /** Still to be taken before any subtopic opens. */
  required: boolean;
  result: ProgressionResult | null;
}

export interface ProgressionSubtopic {
  id: number;
  title: string;
  order: number;
  status: SubtopicStatus;
}

export interface ProgressionPostTest {
  /** The version on offer now. */
  id: number;
  version: number;
  title: string;
  available: boolean;
  submitted: boolean;
  /** Why it cannot be taken yet, in the server's words — null once it can, or once taken. */
  lockedReason: string | null;
  result: ProgressionResult | null;
}

/**
 * Where the student stands on a root topic.
 *
 * Only published assessments appear: a draft pre-test is not here at all, so
 * it gates nothing, and the same goes for a draft post-test.
 */
/**
 * A result the student holds on an assessment this topic no longer offers.
 *
 * Read only. Deliberately not shaped like the pre-test and post-test above:
 * those say what may be taken and under what conditions, and this says what was
 * already done. There is nothing here to open, so there is no `available`, no
 * `required` and no reason it is locked — an assessment that has been withdrawn
 * is not locked, it is simply not on offer any more.
 */
export interface ProgressionPastResult {
  assessmentId: number;
  version: number;
  type: "pre_test" | "post_test";
  title: string;
  result: ProgressionResult;
}

export interface TopicProgression {
  topicId: number;
  preTest: ProgressionPreTest | null;
  /** In their author's order. */
  subtopics: ProgressionSubtopic[];
  /** The first subtopic not yet completed, whether or not it is open yet. */
  nextSubtopicId: number | null;
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  postTest: ProgressionPostTest | null;
  /** The student's own results on assessments the topic no longer offers. */
  pastResults: ProgressionPastResult[];
}

interface ApiResult {
  assessment_id: number;
  version: number;
  earned_points: number;
  total_points: number;
  percent: number | string;
  submitted_at: string | null;
}

interface ApiProgression {
  topic_id: number;
  pre_test: {
    id: number;
    version: number;
    title: string;
    submitted: boolean;
    waived: boolean;
    required: boolean;
    result: ApiResult | null;
  } | null;
  subtopics: { id: number; title: string; order: number; status: SubtopicStatus }[];
  next_subtopic_id: number | null;
  completed_count: number;
  total_count: number;
  remaining_count: number;
  post_test: {
    id: number;
    version: number;
    title: string;
    available: boolean;
    submitted: boolean;
    locked_reason: string | null;
    result: ApiResult | null;
  } | null;
  past_results?: (Omit<ApiResult, "assessment_id" | "version"> & {
    assessment_id: number;
    version: number;
    type: "pre_test" | "post_test";
    title: string;
  })[];
}

function toResult(row: ApiResult | null): ProgressionResult | null {
  return row === null
    ? null
    : {
        assessmentId: row.assessment_id,
        version: row.version,
        earnedPoints: row.earned_points,
        totalPoints: row.total_points,
        percent: Number(row.percent),
        submittedAt: row.submitted_at,
      };
}

function toProgression(row: ApiProgression): TopicProgression {
  return {
    topicId: row.topic_id,
    preTest:
      row.pre_test === null
        ? null
        : {
            id: row.pre_test.id,
            version: row.pre_test.version,
            title: row.pre_test.title,
            submitted: row.pre_test.submitted,
            waived: row.pre_test.waived,
            required: row.pre_test.required,
            result: toResult(row.pre_test.result),
          },
    subtopics: row.subtopics.map((subtopic) => ({
      id: subtopic.id,
      title: subtopic.title,
      order: subtopic.order,
      status: subtopic.status,
    })),
    nextSubtopicId: row.next_subtopic_id,
    completedCount: row.completed_count,
    totalCount: row.total_count,
    remainingCount: row.remaining_count,
    postTest:
      row.post_test === null
        ? null
        : {
            id: row.post_test.id,
            version: row.post_test.version,
            title: row.post_test.title,
            available: row.post_test.available,
            submitted: row.post_test.submitted,
            lockedReason: row.post_test.locked_reason,
            result: toResult(row.post_test.result),
          },
    // The totals come back on the row itself, the way the server sends them:
    // what it is a result of, and what it came to. Nothing per question — the
    // review is the only reply that carries that, and it is its own request.
    pastResults: (row.past_results ?? []).map((past) => ({
      assessmentId: past.assessment_id,
      version: past.version,
      type: past.type,
      title: past.title,
      result: {
        assessmentId: past.assessment_id,
        version: past.version,
        earnedPoints: past.earned_points,
        totalPoints: past.total_points,
        percent: Number(past.percent),
        submittedAt: past.submitted_at,
      },
    })),
  };
}

/** The signed-in student's progression through a root topic. */
export async function fetchTopicProgression(
  topicId: number,
): Promise<TopicProgression> {
  const { data } = await api.get<{ data: ApiProgression }>(
    `/topics/${topicId}/progression`,
  );

  return toProgression(data);
}

/**
 * "Mark as Complete" on a subtopic.
 *
 * Nothing is sent: whose completion it is and whether it is allowed are both
 * the server's. It answers with the progression as it now stands, which is
 * what the page shows next — the server's word on what opened, not a guess.
 * A subtopic that is not next is refused with 403.
 */
export async function completeSubtopic(
  subtopicId: number,
): Promise<TopicProgression> {
  const { data } = await api.post<{ data: ApiProgression }>(
    `/topics/${subtopicId}/completion`,
  );

  return toProgression(data);
}

/** The server's status for one subtopic, or null if it is not in this progression. */
export function subtopicStatus(
  progression: TopicProgression | null,
  subtopicId: number,
): SubtopicStatus | null {
  return (
    progression?.subtopics.find((subtopic) => subtopic.id === subtopicId)?.status ??
    null
  );
}

/** The next subtopic, but only if the server has opened it. */
export function openNextSubtopic(
  progression: TopicProgression | null,
): ProgressionSubtopic | null {
  if (progression === null || progression.nextSubtopicId === null) return null;

  return (
    progression.subtopics.find(
      (subtopic) =>
        subtopic.id === progression.nextSubtopicId && subtopic.status === "available",
    ) ?? null
  );
}
