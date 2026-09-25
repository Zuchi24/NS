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
 * One reply is the exception, and only ever after the fact: the review of an
 * attempt the student has already submitted, which carries what was picked and
 * what was right because by then there is nothing left to give away. It has its
 * own types (AssessmentReview) rather than fields added to the ones above, so
 * that what the taking page reads still has nowhere to put a key — see
 * fetchOwnAttemptReview.
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
  /**
   * Seconds to answer once the question is shown, or null for no timer. The
   * countdown is this browser's; running out leaves the question unanswered.
   */
  timeLimitSeconds: number | null;
  order: number;
  choices: StudentAssessmentChoice[];
}

export interface StudentAssessment {
  id: number;
  topicId: number;
  type: StudentAssessmentType;
  /** Which version of the topic's pre-test or post-test this is. */
  version: number;
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

/**
 * The assessment a review belongs to: enough to title the page it is drawn on.
 *
 * Its own type rather than StudentAssessment, because the server sends no
 * questions here — the reviewed questions are the attempt's, below, and a
 * second set beside them could only disagree with them.
 */
export interface ReviewedAssessment {
  id: number;
  topicId: number;
  type: StudentAssessmentType;
  /** The version the attempt was taken on — not necessarily the one offered now. */
  version: number;
  title: string;
  description: string | null;
}

/**
 * One question of a submitted attempt: what was asked, what was picked, and
 * what was right.
 *
 * Apart from StudentAssessmentQuestion on purpose. That one is what a student
 * is sent before they answer and has no field a key could land in; this one is
 * only ever built from a review of an attempt already submitted.
 *
 * The three fields the scorer wrote — `selectedChoiceId`, `isCorrect` and
 * `pointsAwarded` — are read as it wrote them and never worked out again here:
 * the score a student was given is the score they are shown. `correctChoiceId`
 * comes from the assessment instead, which is the authority on it.
 *
 * All four are nullable because the server carries them so, for a question with
 * no stored answer. Nothing a student can reach produces one — every question of
 * a taken assessment has exactly one answer — so a null is a gap to show rather
 * than a case to reason about.
 */
export interface AssessmentReviewQuestion {
  id: number;
  prompt: string;
  /** What the question was worth. What was awarded for it is below. */
  points: number;
  order: number;
  /**
   * The choices as they were offered, in the order they were offered. The same
   * shape the taking page reads, and still with no correctness on a choice: the
   * key is one field on the question, not a flag on four choices.
   */
  choices: StudentAssessmentChoice[];
  selectedChoiceId: number | null;
  correctChoiceId: number | null;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
}

/**
 * The student's own submitted attempt, question by question.
 *
 * A superset of AssessmentResult — the same totals, from the same fields — with
 * the assessment it was taken on and every question reviewed. The server sends
 * it for the signed-in student's own attempt and for no other, so nothing here
 * says whose it is.
 */
export interface AssessmentReview {
  id: number;
  assessmentId: number;
  earnedPoints: number;
  totalPoints: number;
  percent: number;
  submittedAt: string | null;
  assessment: ReviewedAssessment;
  /** In the order the server returned them, which is the order asked. */
  questions: AssessmentReviewQuestion[];
}

/**
 * One answer: the choice picked for a question. The whole of a submission.
 *
 * `choiceId` is null only for a timed question whose time ran out with nothing
 * picked. The server accepts that for a timed question and nothing else, and
 * scores it as incorrect.
 */
export interface AssessmentAnswer {
  questionId: number;
  choiceId: number | null;
}

/**
 * The questions settled so far, by question id: the choice picked, or null for
 * a timed question whose time ran out. A question not yet reached is absent.
 */
export type AssessmentSelections = Record<number, number | null>;

interface ApiChoice {
  id: number;
  label: string;
  order: number;
}

interface ApiQuestion {
  id: number;
  prompt: string;
  points: number;
  time_limit_seconds?: number | null;
  order: number;
  choices?: ApiChoice[];
}

interface ApiAssessment {
  id: number;
  topic_id: number;
  type: StudentAssessmentType;
  version: number;
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

interface ApiReviewQuestion extends ApiQuestion {
  selected_choice_id: number | null;
  correct_choice_id: number | null;
  is_correct: boolean | null;
  points_awarded: number | null;
}

/**
 * The review as it comes off the wire: the attempt's own fields, and then two
 * things a submission's reply does not carry.
 */
interface ApiReview extends ApiAttempt {
  assessment: Omit<ApiAssessment, "questions">;
  questions?: ApiReviewQuestion[];
}

function toChoice(row: ApiChoice): StudentAssessmentChoice {
  return { id: row.id, label: row.label, order: row.order };
}

function toQuestion(row: ApiQuestion): StudentAssessmentQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    points: row.points,
    timeLimitSeconds: row.time_limit_seconds ?? null,
    order: row.order,
    choices: (row.choices ?? []).map(toChoice),
  };
}

function toAssessment(row: ApiAssessment): StudentAssessment {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    version: row.version,
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

function toReviewQuestion(row: ApiReviewQuestion): AssessmentReviewQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    points: row.points,
    order: row.order,
    // The same choices the taking page reads, mapped the same way, so a key
    // smuggled onto a choice is dropped here as it is dropped there.
    choices: (row.choices ?? []).map(toChoice),
    selectedChoiceId: row.selected_choice_id ?? null,
    correctChoiceId: row.correct_choice_id ?? null,
    isCorrect: row.is_correct ?? null,
    pointsAwarded: row.points_awarded ?? null,
  };
}

function toReview(row: ApiReview): AssessmentReview {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    earnedPoints: row.earned_points,
    totalPoints: row.total_points,
    // Read the one way it is read everywhere else, from the one field the
    // server derives it in: two roundings of one score would drift apart.
    percent: Number(row.percent),
    submittedAt: row.submitted_at,
    assessment: {
      id: row.assessment.id,
      topicId: row.assessment.topic_id,
      type: row.assessment.type,
      version: row.assessment.version,
      title: row.assessment.title,
      description: row.assessment.description,
    },
    questions: (row.questions ?? []).map(toReviewQuestion),
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
 * The same attempt read in full: the totals, the assessment and every question
 * with what was picked and what was right. Null when they have not taken it,
 * which the server answers with 404, exactly as above.
 *
 * The same route as fetchOwnAttempt, which reads the totals out of the same
 * reply and nothing else. Whether a page wants the score alone or the whole
 * review is the page's to say, and each mapping copies only what it names.
 *
 * The server decides whose this is and sends nobody else's: the attempt is
 * found from the signed-in student, so this takes no student and names none.
 * What an author later does to the assessment does not reach it — a result
 * stays readable after the assessment is unpublished or its roadmap withdrawn,
 * while both still refuse a new attempt.
 */
export async function fetchOwnAttemptReview(
  assessmentId: number,
): Promise<AssessmentReview | null> {
  try {
    const { data } = await api.get<{ data: ApiReview }>(
      `/assessments/${assessmentId}/attempt`,
    );

    return toReview(data);
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

/**
 * The questions not settled yet, in the order they were asked. A timed-out
 * question is settled — with no choice — and is not among them.
 */
export function unansweredQuestions(
  questions: StudentAssessmentQuestion[],
  selections: AssessmentSelections,
): StudentAssessmentQuestion[] {
  return questions.filter((question) => selections[question.id] === undefined);
}

/**
 * The settled questions as a submission, in the order they were asked: the
 * choice picked, or null for a timed question whose time ran out.
 */
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
