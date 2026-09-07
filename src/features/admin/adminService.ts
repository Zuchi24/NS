import { api } from "@/services/api";
import type {
  Analytics,
  ChallengePerformance,
  Overview,
  Rate,
  SectionState,
  Standing,
  Student,
  StudentChallenge,
  StudentDetail,
  Submission,
  YearLevelCohort,
} from "./types";

/**
 * The instructor endpoints.
 *
 * The monitoring half is read-only — every figure is derived from students'
 * attempts, so there is nothing there to write back. The two writes at the
 * bottom are the exception, and they are the whole of what an instructor may
 * change about enrolment: whether a section is open, and which section a
 * student is in. As with the rest of the app the API answers in snake_case, and
 * nothing outside this file has to know that.
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
  submissions: { total: number; passed: number; pass_rate: number };
  year_levels_breakdown: {
    id: number;
    code: string;
    name: string;
    students: number;
    challenge_completion: ApiRate;
  }[];
}

interface ApiChallengePerformance {
  id: number;
  title: string;
  kind: string;
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
    is_active: boolean;
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
    submissions: number;
    completion_percent: number;
    last_active_at: string | null;
    standing: Standing;
    standing_label: string;
  };
}

interface ApiStudentChallenge {
  id: number;
  title: string;
  description: string | null;
  kind: string;
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
      submissions: student.summary.submissions,
      completionPercent: student.summary.completion_percent,
      lastActiveAt: student.summary.last_active_at,
      standing: student.summary.standing,
      standingLabel: student.summary.standing_label,
    },
  };
}

function toChallengePerformance(
  challenge: ApiChallengePerformance,
): ChallengePerformance {
  return {
    id: challenge.id,
    title: challenge.title,
    kind: challenge.kind,
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
    })),
  };
}

/**
 * Where the cohort is getting stuck, per challenge.
 *
 * Only challenges. A topic holds reading and watching, and nothing records
 * whether a student has done either, so the API reports nothing about one.
 */
export async function fetchAnalytics(): Promise<Analytics> {
  const { data } = await api.get<{
    data: { challenges: ApiChallengePerformance[] };
  }>("/admin/analytics");

  return { challenges: data.challenges.map(toChallengePerformance) };
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
      isActive: section.is_active,
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

/** One student against the whole challenge catalogue, opened or not. */
export async function fetchStudent(studentId: number): Promise<StudentDetail> {
  const { data } = await api.get<{
    data: {
      student: ApiStudent;
      challenges: ApiStudentChallenge[];
    };
  }>(`/admin/students/${studentId}`);

  return {
    student: toStudent(data.student),
    challenges: data.challenges.map(toStudentChallenge),
  };
}

function toStudentChallenge(challenge: ApiStudentChallenge): StudentChallenge {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    kind: challenge.kind,
    attempts: challenge.attempts,
    submissions: challenge.submissions,
    passed: challenge.passed,
    passedAt: challenge.passed_at,
    lastAttemptAt: challenge.last_attempt_at,
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

/**
 * The section state as the server left it, which is what the caller redraws
 * from rather than assuming the move went the way it asked.
 */
interface ApiSection {
  id: number;
  name: string;
  capacity: number | null;
  is_active: boolean;
}

function toSectionState(section: ApiSection): SectionState {
  return {
    id: section.id,
    name: section.name,
    capacity: section.capacity,
    isActive: section.is_active,
  };
}

/**
 * Reopens a section to new sign-ups.
 *
 * Nothing about the students in it changes — they never left. Its own route
 * rather than a field on an edit, because opening a section is a decision about
 * a term rather than a correction.
 */
export async function activateSection(
  sectionId: number,
): Promise<SectionState> {
  const { data } = await api.post<{ data: ApiSection }>(
    `/admin/sections/${sectionId}/activate`,
    {},
  );

  return toSectionState(data);
}

/**
 * Closes a section to new sign-ups.
 *
 * The roster stays, and so does everything its students have done: the only
 * thing that changes is whether the sign-up form offers it. Reversible, which
 * is why this needs no confirmation of the kind retiring an achievement does.
 */
export async function deactivateSection(
  sectionId: number,
): Promise<SectionState> {
  const { data } = await api.post<{ data: ApiSection }>(
    `/admin/sections/${sectionId}/deactivate`,
    {},
  );

  return toSectionState(data);
}

/**
 * Moves a student into another open section.
 *
 * The one thing an instructor writes about a student, and it exists because a
 * student picks their own section at sign-up and can pick wrong. Only the
 * section is sent: nothing else about an account is an instructor's to change.
 *
 * The server refuses a closed or missing section with a 422, and the message it
 * gives is the one worth showing — it says the section is not open for
 * enrolment, which is what the instructor needs to know.
 */
export async function moveStudentToSection(
  studentId: number,
  sectionId: number,
): Promise<StudentDetail> {
  const { data } = await api.put<{
    data: {
      student: ApiStudent;
      challenges: ApiStudentChallenge[];
    };
  }>(`/admin/students/${studentId}`, { section_id: sectionId });

  return {
    student: toStudent(data.student),
    challenges: data.challenges.map(toStudentChallenge),
  };
}
