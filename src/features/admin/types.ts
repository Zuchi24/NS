/**
 * What the instructor side reports. Every figure here is derived by the API
 * from students' own attempts — nothing on these pages is illustrative.
 */

/** A share, with the counts it came from so a page can show its working. */
export interface Rate {
  count: number;
  possible: number;
  percent: number;
}

export interface YearLevelCompletion {
  id: number;
  code: string;
  name: string;
  students: number;
  challengeCompletion: Rate;
  roadmapCompletion: Rate;
}

export interface Overview {
  students: number;
  /**
   * Students belonging to no section.
   *
   * Reported rather than filtered out. Every other figure on this page is
   * organised by section, so these students appear in no roster, no cohort
   * head count and no year-level breakdown — and the dashboard has to say so,
   * or `students` and the cohort counts silently disagree. Registration now
   * requires a section, so this only ever holds accounts made before that.
   */
  unassignedStudents: number;
  topics: number;
  challenges: number;
  sections: number;
  yearLevels: number;
  /** Students who have worked on something within the window below. */
  activeStudents: number;
  activeWithinDays: number;
  challengeCompletion: Rate;
  roadmapCompletion: Rate;
  submissions: { total: number; passed: number; passRate: number };
  byYearLevel: YearLevelCompletion[];
}

export interface TopicEngagement {
  id: number;
  title: string;
  roadmap: string | null;
  challenges: number;
  /** Students for whom the topic is open, whether or not they have started. */
  studentsReached: number;
  studentsInProgress: number;
  studentsCompleted: number;
  studentsTotal: number;
  completionPercent: number;
  /** Null when nobody has finished any work in it — not zero. */
  averageMinutes: number | null;
}

export interface ChallengePerformance {
  id: number;
  title: string;
  kind: string;
  topics: string[];
  submissions: number;
  passedSubmissions: number;
  /** Of the submissions made, the share that satisfied every rule. */
  passRate: number;
  studentsAttempted: number;
  studentsPassed: number;
  /** Of the students who took it on, the share that got there. */
  studentPassRate: number;
  averageMinutes: number | null;
}

export interface Analytics {
  topics: TopicEngagement[];
  challenges: ChallengePerformance[];
}

export interface SectionSummary {
  id: number;
  name: string;
  capacity: number | null;
  studentsCount: number;
}

export interface YearLevelCohort {
  id: number;
  code: string;
  name: string;
  studentsCount: number;
  sections: SectionSummary[];
}

/** The bands the API puts a student in, from their own completion figure. */
export type Standing =
  | "not_started"
  | "needs_support"
  | "progressing"
  | "on_track";

export interface StudentSummary {
  challengesPassed: number;
  challengesTotal: number;
  topicsCompleted: number;
  topicsTotal: number;
  /** Attempts submitted, right or wrong. */
  submissions: number;
  completionPercent: number;
  lastActiveAt: string | null;
  standing: Standing;
  standingLabel: string;
}

export interface Student {
  id: number;
  studentId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  section: { id: number; name: string; yearLevel: string } | null;
  summary: StudentSummary;
}

export type TopicStatus = "locked" | "unlocked" | "in_progress" | "completed";

export interface StudentTopic {
  id: number;
  title: string;
  roadmap: string | null;
  status: TopicStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface StudentChallenge {
  id: number;
  title: string;
  description: string | null;
  kind: string;
  topics: string[];
  attempts: number;
  submissions: number;
  passed: boolean;
  passedAt: string | null;
  lastAttemptAt: string | null;
}

export interface StudentDetail {
  student: Student;
  /** Every topic in the catalogue, including ones they have not reached. */
  topics: StudentTopic[];
  challenges: StudentChallenge[];
}

/** One requirement of a challenge, and whether the submission met it. */
export interface RequirementResult {
  requirement: string;
  passed: boolean;
}

/** A handed-in attempt, as the cross-cohort feed reports it. */
export interface Submission {
  id: number;
  student: {
    id: number;
    fullName: string;
    studentId: string | null;
    section: string | null;
  };
  challenge: { id: number; title: string; kind: string };
  passed: boolean;
  /** Per-requirement feedback, when the grader recorded it. */
  requirements: RequirementResult[] | null;
  submittedAt: string | null;
}
