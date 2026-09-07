import {
  fetchChallenges,
  fetchMyActivities,
  fetchMyAttempts,
  fetchRoadmaps,
} from "./contentService";
import type {
  Attempt,
  Challenge,
  ChallengeActivity,
  Roadmap,
} from "./types";

/**
 * The signed-in student's own standing, from the endpoints that already serve
 * them.
 *
 * Scoping is the server's: `/attempts` and `/activities` return only the
 * caller's, and `/roadmaps` attaches only the caller's topic progress, so there
 * is no student id to pass and no way for this to read anyone else's work.
 *
 * The judgements stay on the server too — whether a submission passed, whether
 * a topic is finished, where a student stands on a challenge — and this only
 * counts what comes back. Nothing here re-decides anything the API has already
 * decided.
 */

export interface StudentProgress {
  /** Distinct challenges passed — a challenge passed twice still counts once. */
  challengesPassed: number;
  challengesTotal: number;
  /** Challenges with an attempt still open. */
  challengesInProgress: number;
  /** How much reading the catalogue holds. Nothing records whether it is done. */
  topicsTotal: number;
  /**
   * Where the student stands on each challenge they have opened, newest first.
   *
   * One row per challenge, not one per attempt: the server keeps a single
   * record per student and challenge and updates it, so a challenge that was
   * opened, missed and finally finished appears once, as finished. The blow-by-
   * blow is the attempts list, which is left alone as the history it is.
   */
  activity: ChallengeActivity[];
}

function countDistinctChallenges(attempts: Attempt[]): number {
  return new Set(attempts.map((attempt) => attempt.challengeId)).size;
}

/**
 * Only the attempts on challenges the catalogue still offers.
 *
 * A retired challenge is soft-deleted on the server: it leaves `/challenges`,
 * it leaves its topic, and it leaves the activity list — but the attempts made
 * on it stay, because that is the student's own history and `/attempts` is
 * where it is read. Everything below counts work *against the catalogue*, so
 * it has to be measured on the same set the catalogue holds.
 *
 * Without this the two halves of every ratio come from different places and
 * disagree: eleven passes counted from attempts, ten challenges counted from
 * the catalogue, and a dashboard reading "11/10". Filtering here makes
 * `challengesPassed <= challengesTotal` true by construction rather than by
 * luck, and stops a challenge withdrawn under an open attempt still being
 * reported as work in progress.
 */
function inCatalogue(attempts: Attempt[], challenges: Challenge[]): Attempt[] {
  const live = new Set(challenges.map((challenge) => challenge.id));

  return attempts.filter((attempt) => live.has(attempt.challengeId));
}

/**
 * Folds the payloads into one summary. Pure, so what the dashboard shows is a
 * function of what the API returned and nothing else.
 */
export function deriveStudentProgress(
  attempts: Attempt[],
  challenges: Challenge[],
  roadmaps: Roadmap[],
  activities: ChallengeActivity[] = [],
): StudentProgress {
  const topics = roadmaps.flatMap((roadmap) => roadmap.topics);
  const counted = inCatalogue(attempts, challenges);

  return {
    challengesPassed: countDistinctChallenges(
      counted.filter(
        (attempt) => attempt.status === "completed" && attempt.passed,
      ),
    ),
    challengesTotal: challenges.length,
    challengesInProgress: countDistinctChallenges(
      counted.filter((attempt) => attempt.status === "in_progress"),
    ),
    topicsTotal: topics.length,
    // Already ordered by the server, and already one per challenge. Copied so
    // the caller's array is never handed out to be mutated.
    activity: [...activities],
  };
}

/** Loads everything the summary needs, in one round trip. */
export async function fetchStudentProgress(): Promise<StudentProgress> {
  const [attempts, challenges, roadmaps, activities] = await Promise.all([
    fetchMyAttempts(),
    fetchChallenges(),
    fetchRoadmaps(),
    fetchMyActivities(),
  ]);

  return deriveStudentProgress(attempts, challenges, roadmaps, activities);
}

/** A share of a total, guarding the empty catalogue. */
export function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}
