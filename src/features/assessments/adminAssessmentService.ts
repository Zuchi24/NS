import { api } from "@/services/api";

/**
 * Authoring a topic's pre-test and post-test.
 *
 * Writes and the author's read, against the admin endpoints the student side
 * never touches. Access is the server's decision: the API refuses anyone
 * without canManageContent(), so nothing here re-decides it.
 *
 * Three rules run through all of it. They are the server's, restated here only
 * so an author is not offered a button that would be refused:
 *
 * - An assessment is written as a draft and published afterwards. There is no
 *   publish flag on the create or the edit; publishing is its own call, and the
 *   server refuses it until every question is complete.
 * - What an assessment is — its topic and its type — is fixed when it is
 *   created. Its title and description stay editable for its whole life.
 * - Its questions are editable only while it is unpublished and untaken. A
 *   published one is refused with 422 and unpublishing lifts it; a taken one is
 *   refused with 409 and nothing lifts it. lockStateOf() is how a page tells the
 *   two apart before asking.
 */

export type AssessmentType = "pre_test" | "post_test";

export const ASSESSMENT_TYPES: readonly AssessmentType[] = [
  "pre_test",
  "post_test",
];

/** The server's own labels for the two — AssessmentType::label(). */
export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  pre_test: "Pre-test",
  post_test: "Post-test",
};

export interface AssessmentChoice {
  id: number;
  label: string;
  order: number;
  /** The answer key. Only staff are sent it, and these endpoints are staff's. */
  isCorrect: boolean;
}

export interface AssessmentQuestion {
  id: number;
  prompt: string;
  points: number;
  /** Seconds a student has once the question is shown, or null for no timer. */
  timeLimitSeconds: number | null;
  order: number;
  choices: AssessmentChoice[];
}

/**
 * One assessment as its author sees it.
 *
 * The counts are only there when the server counted them, and null otherwise
 * rather than a zero that would claim nobody has taken it. The listing counts
 * both and loads no questions; every single-assessment response loads the
 * questions and counts the attempts. `questions` is null in the listing for
 * the same reason — an empty array would read as "has no questions".
 */
export interface Assessment {
  id: number;
  topicId: number;
  type: AssessmentType;
  title: string;
  description: string | null;
  isPublished: boolean;
  attemptsCount: number | null;
  questionsCount: number | null;
  questions: AssessmentQuestion[] | null;
}

/**
 * One student's result on an assessment, as their instructor reads it.
 *
 * Who took it, what they scored and when — and nothing about how. Which
 * choices were picked is the answer key seen from the other side, and the
 * server does not send it here.
 */
export interface AssessmentResult {
  /** The attempt's own id, which is what makes a row unique. */
  id: number;
  student: {
    id: number;
    /** The school's id for them, as the roster pages show it. */
    studentId: string | null;
    fullName: string;
  };
  earnedPoints: number;
  totalPoints: number;
  /** Earned over total, rounded by the server. Never recomputed here. */
  percent: number;
  submittedAt: string | null;
}

interface ApiAssessmentResult {
  id: number;
  student: {
    id: number;
    student_id: string | null;
    full_name: string;
  };
  earned_points: number;
  total_points: number;
  percent: number | string;
  submitted_at: string | null;
}

interface ApiAssessmentChoice {
  id: number;
  label: string;
  order: number;
  is_correct?: boolean;
}

interface ApiAssessmentQuestion {
  id: number;
  prompt: string;
  points: number;
  time_limit_seconds?: number | null;
  order: number;
  choices?: ApiAssessmentChoice[];
}

interface ApiAssessment {
  id: number;
  topic_id: number;
  type: AssessmentType;
  title: string;
  description: string | null;
  is_published?: boolean;
  attempts_count?: number;
  questions_count?: number;
  questions?: ApiAssessmentQuestion[];
}

function toChoice(row: ApiAssessmentChoice): AssessmentChoice {
  return {
    id: row.id,
    label: row.label,
    order: row.order,
    isCorrect: row.is_correct === true,
  };
}

function toQuestion(row: ApiAssessmentQuestion): AssessmentQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    points: row.points,
    timeLimitSeconds: row.time_limit_seconds ?? null,
    order: row.order,
    choices: (row.choices ?? []).map(toChoice),
  };
}

function toAssessment(row: ApiAssessment): Assessment {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    title: row.title,
    description: row.description,
    isPublished: row.is_published === true,
    attemptsCount: row.attempts_count ?? null,
    questionsCount: row.questions_count ?? null,
    questions: row.questions ? row.questions.map(toQuestion) : null,
  };
}

/**
 * How settled an assessment's questions are.
 *
 * - `editable`: a draft nobody has taken. Questions can be written freely.
 * - `published`: students can open it, so its questions are refused (422).
 *   Unpublishing it lifts the lock.
 * - `taken`: unpublished, but a student has submitted it, so its questions are
 *   refused (409) for good — the attempts were scored against them.
 * - `published_and_taken`: both. Unpublishing it would not help.
 *
 * Title and description are editable in every one of these.
 */
export type AssessmentLockState =
  | "editable"
  | "published"
  | "taken"
  | "published_and_taken";

/**
 * Which of the four an assessment is in.
 *
 * An uncounted attempt total is read as untaken. Every response for a single
 * assessment and the listing both count attempts, so that only arises for an
 * assessment built by hand — and the server checks the lock again on every
 * write, so the worst case is a refusal it explains.
 */
export function lockStateOf(
  assessment: Pick<Assessment, "isPublished" | "attemptsCount">,
): AssessmentLockState {
  const taken = (assessment.attemptsCount ?? 0) > 0;

  if (assessment.isPublished) {
    return taken ? "published_and_taken" : "published";
  }

  return taken ? "taken" : "editable";
}

/*
|--------------------------------------------------------------------------
| Drafts
|--------------------------------------------------------------------------
*/

/**
 * What the author is filling in for the assessment itself.
 *
 * `type` is only sent when creating. The server refuses it on an edit, so the
 * form shows it locked once the assessment exists.
 */
export interface AssessmentDraft {
  type: AssessmentType;
  title: string;
  description: string;
}

export const EMPTY_ASSESSMENT_DRAFT: AssessmentDraft = {
  type: "pre_test",
  title: "",
  description: "",
};

export function draftOfAssessment(assessment: Assessment): AssessmentDraft {
  return {
    type: assessment.type,
    title: assessment.title,
    description: assessment.description ?? "",
  };
}

export interface AssessmentChoiceDraft {
  label: string;
  isCorrect: boolean;
}

/**
 * What the author is filling in for one question.
 *
 * `points` is held as a string because it comes from a text box, and a
 * half-typed number is a string rather than NaN. It becomes an integer on the
 * way out, and validateQuestionDraft is what stands between the two.
 *
 * The choices are always the whole set of four: the server takes them no other
 * way, on a create or an edit.
 *
 * The timer is picked from QUESTION_TIMER_PRESETS, so it is never half-typed:
 * a number of seconds, or null for no timer.
 */
export interface AssessmentQuestionDraft {
  prompt: string;
  points: string;
  timeLimitSeconds: number | null;
  choices: AssessmentChoiceDraft[];
}

/**
 * The time limits an author can give a question, in seconds — the same list
 * the server accepts (StoreAssessmentQuestionRequest::TIMER_PRESETS). No timer
 * is null, not one of these.
 */
export const QUESTION_TIMER_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

export function isTimerPreset(seconds: number): boolean {
  return (QUESTION_TIMER_PRESETS as readonly number[]).includes(seconds);
}

/** How many choices a question has — exactly this many, no more and no fewer. */
export const QUESTION_CHOICE_COUNT = 4;

/**
 * A blank question. Its choices array is shared, so update a draft by copying
 * it — as React state is updated anyway — rather than writing into it.
 */
export const EMPTY_QUESTION_DRAFT: AssessmentQuestionDraft = {
  prompt: "",
  points: "1",
  timeLimitSeconds: null,
  choices: Array.from({ length: QUESTION_CHOICE_COUNT }, () => ({
    label: "",
    isCorrect: false,
  })),
};

export function draftOfQuestion(
  question: AssessmentQuestion,
): AssessmentQuestionDraft {
  return {
    prompt: question.prompt,
    points: String(question.points),
    timeLimitSeconds: question.timeLimitSeconds,
    choices: question.choices.map((choice) => ({
      label: choice.label,
      isCorrect: choice.isCorrect,
    })),
  };
}

function detailPayload(draft: AssessmentDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    // An empty box means "no description" rather than "an empty description",
    // and null is what the API reads as clearing it.
    description: draft.description.trim() || null,
  };
}

/**
 * Packs a question for the API.
 *
 * No order and no assessment id: both are refused if sent. A new question is
 * appended, and moving one is reorderQuestions.
 *
 * The timer always goes, null included: on an edit, null is what clears it.
 */
function questionPayload(draft: AssessmentQuestionDraft): Record<string, unknown> {
  return {
    prompt: draft.prompt.trim(),
    points: Number(draft.points.trim()),
    time_limit_seconds: draft.timeLimitSeconds,
    choices: draft.choices.map((choice) => ({
      label: choice.label.trim(),
      is_correct: choice.isCorrect,
    })),
  };
}

/*
|--------------------------------------------------------------------------
| Assessments
|--------------------------------------------------------------------------
*/

/**
 * A topic's pre-test and post-test, drafts included, pre-test first.
 *
 * Counts rather than content: the questions come from fetchAssessment for the
 * one being edited. Refused with 422 for a subtopic, which cannot own one.
 */
export async function fetchTopicAssessments(
  topicId: number,
): Promise<Assessment[]> {
  const { data } = await api.get<{ data: ApiAssessment[] }>(
    `/admin/topics/${topicId}/assessments`,
  );

  return data.map(toAssessment);
}

/** The whole assessment, its questions and answer key included. */
export async function fetchAssessment(assessmentId: number): Promise<Assessment> {
  const { data } = await api.get<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}`,
  );

  return toAssessment(data);
}

function toResult(row: ApiAssessmentResult): AssessmentResult {
  return {
    id: row.id,
    student: {
      id: row.student.id,
      studentId: row.student.student_id,
      fullName: row.student.full_name,
    },
    earnedPoints: row.earned_points,
    totalPoints: row.total_points,
    // Carried as the server rounded it. A second rounding here is how an
    // instructor and a student end up reading different scores.
    percent: Number(row.percent),
    submittedAt: row.submitted_at,
  };
}

/**
 * Who has taken one assessment, and what they scored.
 *
 * Newest submission first, as the server orders it. Empty means nobody has
 * taken it yet, which is an answer rather than an error — there is no 404 for
 * an assessment awaiting its first student.
 */
export async function fetchAssessmentResults(
  assessmentId: number,
): Promise<AssessmentResult[]> {
  const { data } = await api.get<{ data: ApiAssessmentResult[] }>(
    `/admin/assessments/${assessmentId}/results`,
  );

  return data.map(toResult);
}

/**
 * Writes a new assessment down, as a draft.
 *
 * The topic is the address and never a field, and there is no publish flag —
 * the server refuses both if sent. A topic holds at most one of each type, and
 * a second is refused with 422.
 */
export async function createAssessment(
  topicId: number,
  draft: AssessmentDraft,
): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/topics/${topicId}/assessments`,
    { type: draft.type, ...detailPayload(draft) },
  );

  return toAssessment(data);
}

/**
 * Rewrites an assessment's title and description.
 *
 * The type is never sent: a pre-test cannot become a post-test, and the server
 * refuses the field outright rather than ignoring it.
 */
export async function updateAssessment(
  assessmentId: number,
  draft: AssessmentDraft,
): Promise<Assessment> {
  const { data } = await api.put<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}`,
    detailPayload(draft),
  );

  return toAssessment(data);
}

/**
 * Puts it in front of students.
 *
 * Refused with 422 until it has at least one question and every question is
 * complete; the server names the one that is not, so callers show that.
 * Publishing a published assessment is not an error.
 */
export async function publishAssessment(
  assessmentId: number,
): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}/publish`,
  );

  return toAssessment(data);
}

/**
 * Withdraws it from students. Allowed at any time; nothing a student submitted
 * is touched, and a taken assessment's questions stay locked.
 */
export async function unpublishAssessment(
  assessmentId: number,
): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}/unpublish`,
  );

  return toAssessment(data);
}

/**
 * Destroys it with its questions and choices.
 *
 * Refused with 409 once anyone has taken it, published or not — the attempts
 * are students' results. That assessment is unpublished instead.
 */
export async function deleteAssessment(assessmentId: number): Promise<void> {
  await api.delete(`/admin/assessments/${assessmentId}`);
}

/*
|--------------------------------------------------------------------------
| Questions
|--------------------------------------------------------------------------
|
| Each of these is refused while the assessment is locked — 422 while it is
| published, 409 once it has been taken. See lockStateOf().
*/

/** Adds a question with its four choices, at the end. */
export async function createQuestion(
  assessmentId: number,
  draft: AssessmentQuestionDraft,
): Promise<AssessmentQuestion> {
  const { data } = await api.post<{ data: ApiAssessmentQuestion }>(
    `/admin/assessments/${assessmentId}/questions`,
    questionPayload(draft),
  );

  return toQuestion(data);
}

/**
 * Rewrites a question.
 *
 * The whole draft goes, choices included, because the form holds every field
 * and the server takes choices only as the complete set. The four slots keep
 * their ids and take the new labels and answer.
 */
export async function updateQuestion(
  questionId: number,
  draft: AssessmentQuestionDraft,
): Promise<AssessmentQuestion> {
  const { data } = await api.put<{ data: ApiAssessmentQuestion }>(
    `/admin/questions/${questionId}`,
    questionPayload(draft),
  );

  return toQuestion(data);
}

/** Removes a question. The server closes the gap in the order. */
export async function deleteQuestion(questionId: number): Promise<void> {
  await api.delete(`/admin/questions/${questionId}`);
}

/**
 * Stores a new running order.
 *
 * The whole list is sent, as topics are — the server refuses a partial list,
 * or one naming another assessment's question, with 422.
 */
export async function reorderQuestions(
  assessmentId: number,
  questionIds: number[],
): Promise<AssessmentQuestion[]> {
  const { data } = await api.put<{ data: ApiAssessmentQuestion[] }>(
    `/admin/assessments/${assessmentId}/questions/order`,
    { question_ids: questionIds },
  );

  return data.map(toQuestion);
}

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
|
| The server validates all of it again and has the final say. These exist so
| an author is told which box to fix without a round trip, and the limits are
| the ones the API enforces — StoreAssessmentRequest and
| StoreAssessmentQuestionRequest — rather than a looser guess at them.
*/

export const ASSESSMENT_TITLE_MAX = 255;
export const ASSESSMENT_DESCRIPTION_MAX = 2000;
export const QUESTION_PROMPT_MAX = 2000;
export const QUESTION_POINTS_MIN = 1;
export const QUESTION_POINTS_MAX = 100;
export const CHOICE_LABEL_MAX = 255;

/**
 * How long a piece of text is, counted the way the server counts it.
 *
 * Laravel's `max` rule counts characters with mb_strlen, where `String.length`
 * counts UTF-16 units and reads an emoji as two. Spreading the string counts
 * code points, which is what mb_strlen counts. Trimmed first, because that is
 * what is sent and what Laravel validates.
 */
export function characterLength(text: string): number {
  return [...text.trim()].length;
}

export type AssessmentDraftField = keyof AssessmentDraft;

export function validateAssessmentDraft(
  draft: AssessmentDraft,
): Partial<Record<AssessmentDraftField, string>> {
  const errors: Partial<Record<AssessmentDraftField, string>> = {};

  if (!ASSESSMENT_TYPES.includes(draft.type)) {
    errors.type = "Choose whether this is the pre-test or the post-test.";
  }

  const title = characterLength(draft.title);

  if (title === 0) {
    errors.title = "Give the assessment a title.";
  } else if (title > ASSESSMENT_TITLE_MAX) {
    errors.title = `Keep the title to ${ASSESSMENT_TITLE_MAX} characters or fewer.`;
  }

  const description = characterLength(draft.description);

  if (description > ASSESSMENT_DESCRIPTION_MAX) {
    errors.description =
      `Keep the instructions to ${ASSESSMENT_DESCRIPTION_MAX} characters or fewer. ` +
      `Those are ${description}.`;
  }

  return errors;
}

/**
 * The fields a question's errors are keyed by — the same keys Laravel's 422
 * uses, so a page can show either kind of error in the same place.
 */
export type QuestionDraftField =
  | "prompt"
  | "points"
  | "time_limit_seconds"
  | "choices"
  | `choices.${number}.label`;

export function validateQuestionDraft(
  draft: AssessmentQuestionDraft,
): Partial<Record<QuestionDraftField, string>> {
  const errors: Partial<Record<QuestionDraftField, string>> = {};

  const prompt = characterLength(draft.prompt);

  if (prompt === 0) {
    errors.prompt = "Write the question.";
  } else if (prompt > QUESTION_PROMPT_MAX) {
    errors.prompt =
      `Keep the question to ${QUESTION_PROMPT_MAX} characters or fewer. ` +
      `That one is ${prompt}.`;
  }

  const points = draft.points.trim();

  if (points === "") {
    errors.points = "Say what the question is worth.";
  } else if (!/^\d+$/.test(points)) {
    errors.points = "Points have to be a whole number.";
  } else if (Number(points) < QUESTION_POINTS_MIN) {
    errors.points = `A question is worth at least ${QUESTION_POINTS_MIN} point.`;
  } else if (Number(points) > QUESTION_POINTS_MAX) {
    errors.points = `A question is worth at most ${QUESTION_POINTS_MAX} points.`;
  }

  if (draft.timeLimitSeconds !== null && !isTimerPreset(draft.timeLimitSeconds)) {
    errors.time_limit_seconds = "Choose one of the timer settings, or no timer.";
  }

  if (draft.choices.length !== QUESTION_CHOICE_COUNT) {
    errors.choices = `A question has exactly ${QUESTION_CHOICE_COUNT} choices.`;
  } else {
    draft.choices.forEach((choice, index) => {
      const label = characterLength(choice.label);

      if (label === 0) {
        errors[`choices.${index}.label`] = "Every choice needs a label.";
      } else if (label > CHOICE_LABEL_MAX) {
        errors[`choices.${index}.label`] =
          `Keep the choice to ${CHOICE_LABEL_MAX} characters or fewer.`;
      }
    });

    if (draft.choices.filter((choice) => choice.isCorrect).length !== 1) {
      errors.choices = "Mark exactly one of the four choices as correct.";
    }
  }

  return errors;
}
