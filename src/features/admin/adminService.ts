import { api } from "@/services/api";
import type {
  Analytics,
  ChallengePerformance,
  Overview,
  Rate,
  Standing,
  Student,
  StudentChallenge,
  StudentDetail,
  StudentTopic,
  Submission,
  TopicEngagement,
  TopicStatus,
  YearLevelCohort,
} from "./types";

/**
 * Reads the instructor endpoints.
 *
 * They are read-only — every figure is derived from students' attempts, so
 * there is nothing here to write back. As with the rest of the app the API
 * answers in snake_case, and nothing outside this file has to know that.
 */

interface ApiRate {
  count: number;
  possible: number;
  percent: number;
}

interface ApiOverview {
  students: number;
  unassigned_students: number;
  topics: number;
  challenges: number;
  sections: number;
  year_levels: number;
  active_students: number;
  active_within_days: number;
  challenge_completion: ApiRate;
  roadmap_completion: ApiRate;
  submissions: { total: number; passed: number; pass_rate: number };
  year_levels_breakdown: {
    id: number;
    code: string;
    name: string;
    students: number;
    challenge_completion: ApiRate;
    roadmap_completion: ApiRate;
  }[];
}

interface ApiTopicEngagement {
  id: number;
  title: string;
  roadmap: string | null;
  challenges: number;
  students_reached: number;
  students_in_progress: number;
  students_completed: number;
  students_total: number;
  completion_percent: number;
  average_minutes: number | null;
}

interface ApiChallengePerformance {
  id: number;
  title: string;
  kind: string;
  topics: string[];
  submissions: number;
  passed_submissions: number;
  pass_rate: number;
  students_attempted: number;
  students_passed: number;
  student_pass_rate: number;
  average_minutes: number | null;
}

interface ApiYearLevel {
  id: number;
  code: string;
  name: string;
  students_count: number;
  sections: {
    id: number;
    name: string;
    capacity: number | null;
    students_count: number;
  }[];
}

interface ApiStudent {
  id: number;
  student_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  section?: {
    id: number;
    name: string;
    year_level: { id: number; name: string };
  };
  summary: {
    challenges_passed: number;
    challenges_total: number;
    topics_completed: number;
    topics_total: number;
    submissions: number;
    completion_percent: number;
    last_active_at: string | null;
    standing: Standing;
    standing_label: string;
  };
}

interface ApiStudentTopic {
  id: number;
  title: string;
  roadmap: string | null;
  status: TopicStatus;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
}

interface ApiStudentChallenge {
  id: number;
  title: string;
  description: string | null;
  kind: string;
  topics: string[];
  attempts: number;
  submissions: number;
  passed: boolean;
  passed_at: string | null;
  last_attempt_at: string | null;
}

interface ApiSubmission {
  id: number;
  student: {
    id: number;
    full_name: string;
    student_id: string | null;
    section: string | null;
  };
  challenge: { id: number; title: string; kind: string };
  passed: boolean;
  requirements: { requirement: string; passed: boolean }[] | null;
  submitted_at: string | null;
}

function toRate(rate: ApiRate): Rate {
  return { count: rate.count, possible: rate.possible, percent: rate.percent };
}

function toStudent(student: ApiStudent): Student {
  return {
    id: student.id,
    studentId: student.student_id,
    firstName: student.first_name,
    lastName: student.last_name,
    fullName: student.full_name,
    email: student.email,
    section: student.section
      ? {
          id: student.section.id,
          name: student.section.name,
          yearLevel: student.section.year_level.name,
        }
      : null,
    summary: {
      challengesPassed: student.summary.challenges_passed,
      challengesTotal: student.summary.challenges_total,
      topicsCompleted: student.summary.topics_completed,
      topicsTotal: student.summary.topics_total,
      submissions: student.summary.submissions,
      completionPercent: student.summary.completion_percent,
      lastActiveAt: student.summary.last_active_at,
      standing: student.summary.standing,
      standingLabel: student.summary.standing_label,
    },
  };
}

function toTopicEngagement(topic: ApiTopicEngagement): TopicEngagement {
  return {
    id: topic.id,
    title: topic.title,
    roadmap: topic.roadmap,
    challenges: topic.challenges,
    studentsReached: topic.students_reached,
    studentsInProgress: topic.students_in_progress,
    studentsCompleted: topic.students_completed,
    studentsTotal: topic.students_total,
    completionPercent: topic.completion_percent,
    averageMinutes: topic.average_minutes,
  };
}

function toChallengePerformance(
  challenge: ApiChallengePerformance,
): ChallengePerformance {
  return {
    id: challenge.id,
    title: challenge.title,
    kind: challenge.kind,
    topics: challenge.topics,
    submissions: challenge.submissions,
    passedSubmissions: challenge.passed_submissions,
    passRate: challenge.pass_rate,
    studentsAttempted: challenge.students_attempted,
    studentsPassed: challenge.students_passed,
    studentPassRate: challenge.student_pass_rate,
    averageMinutes: challenge.average_minutes,
  };
}

/** The dashboard's figures: platform totals and cohort completion. */
export async function fetchOverview(): Promise<Overview> {
  const { data } = await api.get<{ data: ApiOverview }>("/admin/overview");

  return {
    students: data.students,
    unassignedStudents: data.unassigned_students,
    topics: data.topics,
    challenges: data.challenges,
    sections: data.sections,
    yearLevels: data.year_levels,
    activeStudents: data.active_students,
    activeWithinDays: data.active_within_days,
    challengeCompletion: toRate(data.challenge_completion),
    roadmapCompletion: toRate(data.roadmap_completion),
    submissions: {
      total: data.submissions.total,
      passed: data.submissions.passed,
      passRate: data.submissions.pass_rate,
    },
    byYearLevel: data.year_levels_breakdown.map((year) => ({
      id: year.id,
      code: year.code,
      name: year.name,
      students: year.students,
      challengeCompletion: toRate(year.challenge_completion),
      roadmapCompletion: toRate(year.roadmap_completion),
    })),
  };
}

/** Where the cohort is getting stuck, per topic and per challenge. */
export async function fetchAnalytics(): Promise<Analytics> {
  const { data } = await api.get<{
    data: { topics: ApiTopicEngagement[]; challenges: ApiChallengePerformance[] };
  }>("/admin/analytics");

  return {
    topics: data.topics.map(toTopicEngagement),
    challenges: data.challenges.map(toChallengePerformance),
  };
}

/**
 * The whole year-level and section tree with head counts. It is four year
 * levels of a handful of sections, so the drilldown and the sidebar both read
 * it once rather than a level at a time.
 */
export async function fetchCohorts(): Promise<YearLevelCohort[]> {
  const { data } = await api.get<{ data: ApiYearLevel[] }>("/admin/cohorts");

  return data.map((year) => ({
    id: year.id,
    code: year.code,
    name: year.name,
    studentsCount: year.students_count,
    sections: year.sections.map((section) => ({
      id: section.id,
      name: section.name,
      capacity: section.capacity,
      studentsCount: section.students_count,
    })),
  }));
}

/** One section's roster. A section is a class, so this is all of it. */
export async function fetchSectionStudents(
  sectionId: number,
): Promise<Student[]> {
  const { data } = await api.get<{ data: ApiStudent[] }>(
    `/admin/sections/${sectionId}/students`,
  );

  return data.map(toStudent);
}

/** One student against the whole catalogue, reached or not. */
export async function fetchStudent(studentId: number): Promise<StudentDetail> {
  const { data } = await api.get<{
    data: {
      student: ApiStudent;
      topics: ApiStudentTopic[];
      challenges: ApiStudentChallenge[];
    };
  }>(`/admin/students/${studentId}`);

  return {
    student: toStudent(data.student),
    topics: data.topics.map(
      (topic): StudentTopic => ({
        id: topic.id,
        title: topic.title,
        roadmap: topic.roadmap,
        status: topic.status,
        progressPercent: topic.progress_percent,
        startedAt: topic.started_at,
        completedAt: topic.completed_at,
      }),
    ),
    challenges: data.challenges.map(
      (challenge): StudentChallenge => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        kind: challenge.kind,
        topics: challenge.topics,
        attempts: challenge.attempts,
        submissions: challenge.submissions,
        passed: challenge.passed,
        passedAt: challenge.passed_at,
        lastAttemptAt: challenge.last_attempt_at,
      }),
    ),
  };
}

/**
 * What has just been handed in, newest first, across every section — the one
 * instructor view that is not scoped to a cohort.
 */
export async function fetchRecentSubmissions(limit = 20): Promise<Submission[]> {
  const { data } = await api.get<{ data: ApiSubmission[] }>(
    `/admin/submissions?limit=${limit}`,
  );

  return data.map((submission) => ({
    id: submission.id,
    student: {
      id: submission.student.id,
      fullName: submission.student.full_name,
      studentId: submission.student.student_id,
      section: submission.student.section,
    },
    challenge: submission.challenge,
    passed: submission.passed,
    requirements: submission.requirements,
    submittedAt: submission.submitted_at,
  }));
}
