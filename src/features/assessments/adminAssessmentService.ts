import { api } from "@/services/api";
import type { Paginated } from "@/features/content/types";

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
 * - A topic's pre-test (and its post-test) is a slot of versions, each an
 *   assessment with its own id. At most one version is published; publishing
 *   another retires it. A new version is a copy of an existing one, and is how
 *   a taken assessment changes. Archiving puts an unpublished version out of
 *   use without deleting anything; restoring brings it back unpublished.
 * - What a version is — its topic, its type and its number — is fixed when it
 *   is created. Its questions are editable only while it is unpublished,
 *   untaken and unarchived: a published one is refused with 422 and
 *   unpublishing lifts it; a taken one is refused with 409 and nothing lifts
 *   it; an archived one is refused with 409 until it is restored. Its title and
 *   description follow the same rule, except that publishing does not lock
 *   them. lockStateOf() and detailsEditable() are how a page tells these apart
 *   before asking.
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

/**
 * Where each one sits in the topic, in the words an author would use.
 *
 * Beside the labels rather than in the panel that first needed it: two screens
 * now offer these slots — the topic's own assessments panel, and the Add Topic
 * dialog while the topic is still being written — and describing them
 * differently in the two would be two answers to one question.
 */
export const ASSESSMENT_SLOT_CAPTIONS: Record<AssessmentType, string> = {
  pre_test: "Taken before the subtopics, as a diagnostic.",
  post_test: "Taken after the subtopics.",
};

export interface AssessmentChoice {
  id: number;
  label: string;
  order: number;
  /** The answer key. Only staff are sent it, and these endpoints are staff's. */
  isCorrect: boolean;
}

/**
 * How a question is answered: by picking one of its choices, or by typing one
 * of its accepted answers. Fixed once the question exists.
 */
export type QuestionType = "multiple_choice" | "fill_in_blank";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  fill_in_blank: "Fill in the blank",
};

export interface AssessmentQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  points: number;
  /** Seconds a student has once the question is shown, or null for no timer. */
  timeLimitSeconds: number | null;
  order: number;
  choices: AssessmentChoice[];
  /**
   * A fill-in-the-blank question's answer key, as the author typed it; empty
   * for multiple choice. Only staff are sent it, and these endpoints are staff's.
   */
  acceptedAnswers: string[];
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
  /** Its number within the slot, from 1. */
  version: number;
  title: string;
  description: string | null;
  /** The version students are offered. At most one per slot. */
  isPublished: boolean;
  /** When it was archived, or null while it is in use. */
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  type?: QuestionType;
  prompt: string;
  points: number;
  time_limit_seconds?: number | null;
  order: number;
  choices?: ApiAssessmentChoice[];
  accepted_answers?: string[] | null;
}

interface ApiAssessment {
  id: number;
  topic_id: number;
  type: AssessmentType;
  version?: number;
  title: string;
  description: string | null;
  is_published?: boolean;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
    // A response from before fill in the blank existed says nothing here, and
    // every question in one was multiple choice.
    type: row.type ?? "multiple_choice",
    prompt: row.prompt,
    points: row.points,
    timeLimitSeconds: row.time_limit_seconds ?? null,
    order: row.order,
    choices: (row.choices ?? []).map(toChoice),
    acceptedAnswers: row.accepted_answers ?? [],
  };
}

function toAssessment(row: ApiAssessment): Assessment {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    version: row.version ?? 1,
    title: row.title,
    description: row.description,
    isPublished: row.is_published === true,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
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
 * - `archived`: out of use and read-only (409). Restoring it lifts the lock —
 *   unless it was also taken, which is reported as `taken`, the lock that
 *   never lifts.
 *
 * Title and description have a rule of their own: see detailsEditable().
 */
export type AssessmentLockState =
  | "editable"
  | "published"
  | "taken"
  | "published_and_taken"
  | "archived";

/**
 * Which of these a version is in.
 *
 * An uncounted attempt total is read as untaken. Every response for a single
 * assessment and the listing both count attempts, so that only arises for an
 * assessment built by hand — and the server checks the lock again on every
 * write, so the worst case is a refusal it explains.
 */
export function lockStateOf(
  assessment: Pick<Assessment, "isPublished" | "attemptsCount"> &
    Partial<Pick<Assessment, "archivedAt">>,
): AssessmentLockState {
  const taken = (assessment.attemptsCount ?? 0) > 0;

  if (assessment.isPublished) {
    return taken ? "published_and_taken" : "published";
  }

  if (taken) return "taken";

  return assessment.archivedAt ? "archived" : "editable";
}

/**
 * Whether a version's title and description can still be changed: nobody has
 * taken it and it is not archived. Publishing alone does not settle them.
 */
export function detailsEditable(
  assessment: Pick<Assessment, "attemptsCount"> & Partial<Pick<Assessment, "archivedAt">>,
): boolean {
  return (assessment.attemptsCount ?? 0) === 0 && !assessment.archivedAt;
}

/** "V2" — how a version is named wherever versions sit side by side. */
export function versionLabel(assessment: Pick<Assessment, "version">): string {
  return `V${assessment.version}`;
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
 * The choices are always sent as the whole set — two to six of them, one
 * correct — on a create or an edit; the server takes them no other way. While
 * the author is still writing, the draft may hold fewer: a new question starts
 * with one row, and validateQuestionDraft refuses it until there are two.
 *
 * A fill-in-the-blank question has accepted answers instead — one to ten,
 * sent as the whole list — and no choices. Which one the draft is, is `type`,
 * chosen on a new question and fixed after that.
 *
 * The timer is picked from QUESTION_TIMER_PRESETS, so it is never half-typed:
 * a number of seconds, or null for no timer.
 */
export interface AssessmentQuestionDraft {
  type: QuestionType;
  prompt: string;
  points: string;
  timeLimitSeconds: number | null;
  choices: AssessmentChoiceDraft[];
  acceptedAnswers: string[];
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

/**
 * The fewest and most choices a question may be saved with — the server's
 * StoreAssessmentQuestionRequest::MIN_CHOICES and MAX_CHOICES. A true/false
 * question is two choices.
 */
export const QUESTION_CHOICE_MIN = 2;
export const QUESTION_CHOICE_MAX = 6;

/**
 * The fewest and most accepted answers a fill-in-the-blank question may be
 * saved with, and the longest any one may be — the server's
 * StoreAssessmentQuestionRequest::MAX_ACCEPTED_ANSWERS and
 * ANSWER_MAX_CHARACTERS.
 */
export const ACCEPTED_ANSWER_MIN = 1;
export const ACCEPTED_ANSWER_MAX = 10;
export const ACCEPTED_ANSWER_MAX_LENGTH = 255;

/**
 * A blank question: one empty choice row to start from, which the author adds
 * to. Its choices array is shared, so update a draft by copying it — as React
 * state is updated anyway — rather than writing into it.
 */
export const EMPTY_QUESTION_DRAFT: AssessmentQuestionDraft = {
  type: "multiple_choice",
  prompt: "",
  points: "1",
  timeLimitSeconds: null,
  choices: [{ label: "", isCorrect: false }],
  acceptedAnswers: [""],
};

export function draftOfQuestion(
  question: AssessmentQuestion,
): AssessmentQuestionDraft {
  return {
    type: question.type,
    prompt: question.prompt,
    points: String(question.points),
    timeLimitSeconds: question.timeLimitSeconds,
    choices: question.choices.map((choice) => ({
      label: choice.label,
      isCorrect: choice.isCorrect,
    })),
    acceptedAnswers:
      question.acceptedAnswers.length > 0 ? [...question.acceptedAnswers] : [""],
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
 *
 * The answer key goes as its type has it: choices for multiple choice,
 * accepted answers for fill in the blank — never both, which the server
 * refuses. The type itself goes only on a create; an edit refuses one, because
 * a question's type is fixed.
 */
function questionPayload(
  draft: AssessmentQuestionDraft,
  { isNew }: { isNew: boolean },
): Record<string, unknown> {
  const common = {
    prompt: draft.prompt.trim(),
    points: Number(draft.points.trim()),
    time_limit_seconds: draft.timeLimitSeconds,
  };

  const key =
    draft.type === "fill_in_blank"
      ? { accepted_answers: draft.acceptedAnswers.map((answer) => answer.trim()) }
      : {
          choices: draft.choices.map((choice) => ({
            label: choice.label.trim(),
            is_correct: choice.isCorrect,
          })),
        };

  return isNew ? { type: draft.type, ...common, ...key } : { ...common, ...key };
}

/*
|--------------------------------------------------------------------------
| Assessments
|--------------------------------------------------------------------------
*/

/**
 * A topic's pre-test and post-test versions, drafts included — pre-tests
 * first, each slot in version order. Archived versions only when asked for.
 *
 * Counts rather than content: the questions come from fetchAssessment for the
 * one being edited. Refused with 422 for a subtopic, which cannot own one.
 */
export async function fetchTopicAssessments(
  topicId: number,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Assessment[]> {
  const { data } = await api.get<{ data: ApiAssessment[] }>(
    `/admin/topics/${topicId}/assessments${includeArchived ? "?include_archived=1" : ""}`,
  );

  return data.map(toAssessment);
}

/** Every version of this one's slot, archived ones included, oldest first. */
export async function fetchAssessmentVersions(
  assessmentId: number,
): Promise<Assessment[]> {
  const { data } = await api.get<{ data: ApiAssessment[] }>(
    `/admin/assessments/${assessmentId}/versions`,
  );

  return data.map(toAssessment);
}

/**
 * A new draft version of the slot, copied from this one — its title,
 * description, questions, timers and choices, and none of its attempts.
 * Numbered after the highest version the slot has. 409 if another author
 * created one at the same moment.
 */
export async function createAssessmentVersion(
  assessmentId: number,
): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}/versions`,
  );

  return toAssessment(data);
}

/**
 * Puts an unpublished version out of use. Nothing is deleted: its questions and
 * every result on it stay, and students' reviews still open. Refused with 409
 * for the published version.
 */
export async function archiveAssessment(assessmentId: number): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}/archive`,
  );

  return toAssessment(data);
}

/** Brings an archived version back — unpublished. Publishing it is its own step. */
export async function restoreAssessment(assessmentId: number): Promise<Assessment> {
  const { data } = await api.post<{ data: ApiAssessment }>(
    `/admin/assessments/${assessmentId}/restore`,
  );

  return toAssessment(data);
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
 * the server refuses both if sent. This is version 1 of its slot: a slot that
 * already has a version is refused with 422, and grows with
 * createAssessmentVersion instead.
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
 * refuses the field outright rather than ignoring it. Refused with 409 once the
 * version has been taken, or while it is archived — see detailsEditable().
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
 * Makes this the version students are offered, retiring whichever version of
 * the slot was — which keeps its results, unpublished, until it is archived.
 *
 * Refused with 422 until it has at least one question and every question is
 * complete; the server names the one that is not, so callers show that. 409
 * while it is archived. Publishing the published version is not an error.
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
 * are students' results. That version is unpublished or archived instead.
 */
export async function deleteAssessment(
  assessmentId: number,
  /**
   * `expected: "archived"` asks the server to delete it only if it is still
   * archived — for a caller acting on what it last saw in the archive. If
   * another author restored it since, the answer is 409 and nothing goes.
   */
  { expected }: { expected?: "archived" } = {},
): Promise<void> {
  await api.delete(
    `/admin/assessments/${assessmentId}${expected ? `?expected=${expected}` : ""}`,
  );
}

/*
|--------------------------------------------------------------------------
| Questions
|--------------------------------------------------------------------------
|
| Each of these is refused while the assessment is locked — 422 while it is
| published, 409 once it has been taken. See lockStateOf().
*/

/** Adds a question with its answer key, at the end. */
export async function createQuestion(
  assessmentId: number,
  draft: AssessmentQuestionDraft,
): Promise<AssessmentQuestion> {
  const { data } = await api.post<{ data: ApiAssessmentQuestion }>(
    `/admin/assessments/${assessmentId}/questions`,
    questionPayload(draft, { isNew: true }),
  );

  return toQuestion(data);
}

/**
 * Rewrites a question.
 *
 * The whole draft goes, choices included, because the form holds every field
 * and the server takes choices only as the complete set. Slots still in use
 * keep their ids and take the new labels and answer; any past the new last
 * choice are removed.
 */
export async function updateQuestion(
  questionId: number,
  draft: AssessmentQuestionDraft,
): Promise<AssessmentQuestion> {
  const { data } = await api.put<{ data: ApiAssessmentQuestion }>(
    `/admin/questions/${questionId}`,
    questionPayload(draft, { isNew: false }),
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
  | `choices.${number}.label`
  | "accepted_answers"
  | `accepted_answers.${number}`;

/**
 * A typed answer as the server compares it (App\Support\AnswerText): NFKC,
 * lower case, hyphens and underscores to spaces, whitespace collapsed and
 * trimmed. Used here only to tell an author an answer folds to nothing; the
 * server does the marking.
 */
export function foldAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

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

  if (draft.type === "fill_in_blank") {
    if (
      draft.acceptedAnswers.length < ACCEPTED_ANSWER_MIN ||
      draft.acceptedAnswers.length > ACCEPTED_ANSWER_MAX
    ) {
      errors.accepted_answers = `A question has between ${ACCEPTED_ANSWER_MIN} and ${ACCEPTED_ANSWER_MAX} accepted answers.`;
    } else {
      draft.acceptedAnswers.forEach((answer, index) => {
        if (foldAnswer(answer) === "") {
          errors[`accepted_answers.${index}`] =
            "Each accepted answer needs some letters or numbers, not just spaces, hyphens or underscores.";
        } else if (characterLength(answer) > ACCEPTED_ANSWER_MAX_LENGTH) {
          errors[`accepted_answers.${index}`] =
            `Keep each accepted answer to ${ACCEPTED_ANSWER_MAX_LENGTH} characters or fewer.`;
        }
      });
    }

    return errors;
  }

  if (
    draft.choices.length < QUESTION_CHOICE_MIN ||
    draft.choices.length > QUESTION_CHOICE_MAX
  ) {
    errors.choices = `A question has between ${QUESTION_CHOICE_MIN} and ${QUESTION_CHOICE_MAX} choices.`;
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
      errors.choices = "Mark exactly one choice as correct.";
    }
  }

  return errors;
}

/*
|--------------------------------------------------------------------------
| The archive
|--------------------------------------------------------------------------
|
| Archived versions of one type, across every topic. Read here; archived,
| restored and deleted through the calls above — restoreAssessment, and
| deleteAssessment with `expected: "archived"`.
*/

/**
 * One archived version, as the archive lists it.
 *
 * Addressed by its own id: results belong to the exact version they were
 * taken on, so nothing here is keyed by the slot.
 */
export interface ArchivedAssessment {
  id: number;
  type: AssessmentType;
  version: number;
  title: string;
  archivedAt: string;
  createdAt: string | null;
  updatedAt: string | null;
  attemptsCount: number;
  questionsCount: number;
  topic: { id: number; title: string };
  roadmap: { id: number; title: string };
  /**
   * The scheduled purge's own answer. `eligibleAt` is null for a version
   * somebody has taken: it is kept for good. Eligible is not deleted — only
   * the scheduled purge deletes, and only while the server runs it.
   */
  purge: { eligible: boolean; eligibleAt: string | null };
}

/** One page of the archive, and where it sits among the rest. */
export interface ArchivedAssessmentPage {
  items: ArchivedAssessment[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface ArchiveQuery {
  type: AssessmentType;
  topicId?: number;
  /** true: taken by somebody; false: never taken; absent: both. */
  taken?: boolean;
  page?: number;
  perPage?: number;
}

interface ApiArchivedAssessment {
  id: number;
  type: AssessmentType;
  version: number;
  title: string;
  archived_at: string;
  created_at?: string | null;
  updated_at?: string | null;
  attempts_count: number;
  questions_count: number;
  topic: { id: number; title: string };
  roadmap: { id: number; title: string };
  purge: { eligible: boolean; eligible_at: string | null };
}

function toArchived(row: ApiArchivedAssessment): ArchivedAssessment {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    title: row.title,
    archivedAt: row.archived_at,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    attemptsCount: row.attempts_count,
    questionsCount: row.questions_count,
    topic: { id: row.topic.id, title: row.topic.title },
    roadmap: { id: row.roadmap.id, title: row.roadmap.title },
    purge: { eligible: row.purge.eligible, eligibleAt: row.purge.eligible_at },
  };
}

/**
 * One page of archived versions of `type`, most recently archived first.
 *
 * Only what was asked is sent: an absent filter means "all", and the server
 * reads an absent `taken` that way too.
 */
export async function fetchArchivedAssessments(
  query: ArchiveQuery,
): Promise<ArchivedAssessmentPage> {
  const params = new URLSearchParams({ type: query.type });

  if (query.topicId !== undefined) params.set("topic_id", String(query.topicId));
  if (query.taken !== undefined) params.set("taken", query.taken ? "true" : "false");
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.perPage !== undefined) params.set("per_page", String(query.perPage));

  const { data, meta } = await api.get<Paginated<ApiArchivedAssessment>>(
    `/admin/archive/assessments?${params.toString()}`,
  );

  return {
    items: data.map(toArchived),
    page: meta.current_page,
    lastPage: meta.last_page,
    perPage: meta.per_page,
    total: meta.total,
  };
}
