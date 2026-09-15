import { ApiError, api } from "@/services/api";

/**
 * Taking a pre-test or post-test, as a student.
 *
 * Deliberately apart from adminAssessmentService. The two read the same rows
 * for different people: an author is sent the answer key, the counts and
 * whether it is published; a student is sent the questions and their choices,
 * and never which choice is right. The types here have no field for any of
 * that, and the mapping copies only what it names — so a key the server should
 * not have sent still cannot reach a page through this module.
 *
 * Whether an assessment may be opened or submitted is the server's to say. A
 * draft is absent (404), a topic that has not been released or a post-test
 * that is not open yet is refused (403), and a second submission is refused
 * too (409). Nothing here re-decides any of it.
 *
 * Every route acts on the signed-in student's own attempt. No function takes a
 * student, and no request names one.
 */

export type StudentAssessmentType = "pre_test" | "post_test";

export const STUDENT_ASSESSMENT_TYPE_LABELS: Record<StudentAssessmentType, string> = {
  pre_test: "Pre-test",
  post_test: "Post-test",
};

export interface StudentAssessmentChoice {
  id: number;
  label: string;
  order: number;
}

export interface StudentAssessmentQuestion {
  id: number;
  prompt: string;
  /** What the question is worth — not what anyone was awarded for it. */
  points: number;
  order: number;
  choices: StudentAssessmentChoice[];
}

export interface StudentAssessment {
  id: number;
  topicId: number;
  type: StudentAssessmentType;
  title: string;
  description: string | null;
  /** In the order the server returned them. */
  questions: StudentAssessmentQuestion[];
}

/**
 * The student's own result: totals and the percentage between them.
 *
 * Nothing per question. Which answers were right is the answer key, and a
 * pre-test that gave it away would give away the post-test too.
 */
export interface AssessmentResult {
  id: number;
  assessmentId: number;
  earnedPoints: number;
  totalPoints: number;
  percent: number;
  submittedAt: string | null;
}

/** One answer: the choice picked for a question. The whole of a submission. */
export interface AssessmentAnswer {
  questionId: number;
  choiceId: number;
}

/** The answers picked so far, by question id. */
export type AssessmentSelections = Record<number, number>;

interface ApiChoice {
  id: number;
  label: string;
  order: number;
}

interface ApiQuestion {
  id: number;
  prompt: string;
  points: number;
  order: number;
  choices?: ApiChoice[];
}

interface ApiAssessment {
  id: number;
  topic_id: number;
  type: StudentAssessmentType;
  title: string;
  description: string | null;
  questions?: ApiQuestion[];
}

interface ApiAttempt {
  id: number;
  assessment_id: number;
  earned_points: number;
  total_points: number;
  percent: number | string;
  submitted_at: string | null;
}

function toChoice(row: ApiChoice): StudentAssessmentChoice {
  return { id: row.id, label: row.label, order: row.order };
}

function toQuestion(row: ApiQuestion): StudentAssessmentQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    points: row.points,
    order: row.order,
    choices: (row.choices ?? []).map(toChoice),
  };
}

function toAssessment(row: ApiAssessment): StudentAssessment {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    title: row.title,
    description: row.description,
    questions: (row.questions ?? []).map(toQuestion),
  };
}

function toResult(row: ApiAttempt): AssessmentResult {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    earnedPoints: row.earned_points,
    totalPoints: row.total_points,
    // A float on the wire, which JSON may carry as 80 or as "80.00".
    percent: Number(row.percent),
    submittedAt: row.submitted_at,
  };
}

/** The assessment as a student may see it: questions and choices, no key. */
export async function fetchStudentAssessment(
  assessmentId: number,
): Promise<StudentAssessment> {
  const { data } = await api.get<{ data: ApiAssessment }>(
    `/assessments/${assessmentId}`,
  );

  return toAssessment(data);
}

/**
 * The signed-in student's own result on this assessment, or null if they have
 * not taken it — which the server answers with 404.
 */
export async function fetchOwnAttempt(
  assessmentId: number,
): Promise<AssessmentResult | null> {
  try {
    const { data } = await api.get<{ data: ApiAttempt }>(
      `/assessments/${assessmentId}/attempt`,
    );

    return toResult(data);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;

    throw e;
  }
}

/**
 * Submits the student's answers, once, and hands back the score the server
 * worked out.
 *
 * Only the question and the choice go: the score, the points and whose attempt
 * it is are the server's, and it refuses them if sent.
 */
export async function submitAssessment(
  assessmentId: number,
  answers: AssessmentAnswer[],
): Promise<AssessmentResult> {
  const { data } = await api.post<{ data: ApiAttempt }>(
    `/assessments/${assessmentId}/attempts`,
    {
      answers: answers.map((answer) => ({
        question_id: answer.questionId,
        choice_id: answer.choiceId,
      })),
    },
  );

  return toResult(data);
}

/** The questions with no answer picked yet, in the order they were asked. */
export function unansweredQuestions(
  questions: StudentAssessmentQuestion[],
  selections: AssessmentSelections,
): StudentAssessmentQuestion[] {
  return questions.filter((question) => selections[question.id] === undefined);
}

/** The picked answers as a submission, in the order the questions were asked. */
export function answersFor(
  questions: StudentAssessmentQuestion[],
  selections: AssessmentSelections,
): AssessmentAnswer[] {
  return questions
    .filter((question) => selections[question.id] !== undefined)
    .map((question) => ({
      questionId: question.id,
      choiceId: selections[question.id],
    }));
}
