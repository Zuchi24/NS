import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import {
  STUDENT_ASSESSMENT_TYPE_LABELS,
  answersFor,
  fetchOwnAttemptReview,
  fetchStudentAssessment,
  submitAssessment,
  unansweredQuestions,
} from "@/features/assessments/studentAssessmentService";
import type {
  AssessmentResult,
  AssessmentReview,
  AssessmentSelections,
  StudentAssessment,
} from "@/features/assessments/studentAssessmentService";
import { AssessmentAnswerReview } from "./AssessmentReview";
import {
  fetchTopicProgression,
  openNextSubtopic,
} from "@/features/content/progressionService";
import { ApiError } from "@/services/api";
import { shortDate } from "@/services/time";
import { useAsync } from "@/services/useAsync";

/**
 * Taking a pre-test or post-test.
 *
 * The questions, one answer each, and a single submission — after which the
 * page shows the score the server worked out, the review of what was answered,
 * and never the form again. A student who has already taken it lands on that
 * review directly.
 *
 * Everything that matters is the server's. Whether the assessment may be
 * opened at all: a draft is absent and a topic that has not been released is
 * refused, and the page shows those states rather than any contents. Whether it
 * may be submitted: once only, and a second tab that got there first wins. And
 * the score: the page is never sent which choices were right until there is an
 * attempt to review, so while the form is up it has nothing to work one out
 * from, and it shows the server's numbers as they come.
 *
 * The two halves are asked for in that order, and deliberately. What a student
 * already did outlasts what the catalogue offers: the server keeps a submitted
 * attempt readable after its assessment is unpublished or its roadmap
 * withdrawn, and the review carries the assessment's own title and topic for
 * exactly that case. So the review is read first and the assessment is only
 * asked about when there is no review — a refusal on what is offered now is not
 * a refusal on what was done then.
 */

/** The id in the address, or null when the address names no assessment. */
function parseAssessmentId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);

  return id > 0 ? id : null;
}

/** What the loader hands back. A refusal is a state to show, not a failure. */
type AssessmentView =
  /** 404: a draft, or nothing there at all. The two look the same on purpose. */
  | { kind: "missing" }
  /** 403: the topic has not been released, or the post-test is not open yet. */
  | { kind: "withheld"; message: string }
  /** Taken. The review is the page, and it carries its own assessment. */
  | { kind: "reviewed"; review: AssessmentReview }
  /** Not taken, and open to be: the assessment as it is offered now. */
  | { kind: "open"; assessment: StudentAssessment };

async function loadView(assessmentId: number): Promise<AssessmentView> {
  // What the student already did, asked for on its own terms. Null means they
  // have not taken it — not that anything was refused.
  const review = await fetchOwnAttemptReview(assessmentId);

  if (review !== null) return { kind: "reviewed", review };

  try {
    // Only now does what the catalogue offers today matter, because only now is
    // there a form to put up.
    return { kind: "open", assessment: await fetchStudentAssessment(assessmentId) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { kind: "missing" };
    if (e instanceof ApiError && e.status === 403) {
      return { kind: "withheld", message: e.message };
    }

    throw e;
  }
}

/** Up to two places, without trailing zeros: 80, 66.67, 12.5. */
function formatPercent(percent: number): string {
  return String(Math.round(percent * 100) / 100);
}

export function AssessmentPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const id = parseAssessmentId(assessmentId);

  // An address with no usable id is not worth a request: it can only 404.
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : loadView(id)),
    [id],
  );
  const { data, error, loading, reload } = useAsync(load, [id]);

  /**
   * The assessment submitted from this page, if one was.
   *
   * The score and the review are read back from the server rather than made
   * here — the submission's own reply carries the totals and not the answers —
   * so what is kept is only which assessment it was. That decides whether the
   * review appearing is news worth moving focus to, and whether a failure to
   * read it back needs saying that the answers still went in. Held by id so it
   * cannot carry over to another assessment opened in the same page.
   */
  const [submittedFor, setSubmittedFor] = useState<number | null>(null);
  const justSubmitted = submittedFor !== null && submittedFor === id;

  /**
   * Why the page was read again under the student — another tab submitted
   * first, or the assessment was withdrawn. Kept here rather than in the form,
   * which the reload takes down, so it is still there to be read afterwards.
   */
  const [notice, setNotice] = useState<string | null>(null);

  // Where Back leads. The topic is the server's to name, and a review names it
  // as well as an assessment does — so a result stays reachable from its topic
  // even once the assessment itself is no longer offered.
  const topicId =
    data?.kind === "open"
      ? data.assessment.topicId
      : data?.kind === "reviewed"
        ? data.review.assessment.topicId
        : null;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(topicId === null ? "/roadmap" : `/topic/${topicId}`)}
      className="mb-4 text-gray-600 hover:text-gray-900"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {topicId === null ? "Back to Roadmap" : "Back to topic"}
    </Button>
  );

  /** The route sits outside the student layout, so the shell lives here. */
  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="max-w-3xl mx-auto px-6 py-8">
        {back}
        {children}
      </div>
    </div>
  );

  const notFound = shell(
    <Unavailable
      title="Assessment not found"
      message="This assessment does not exist, or it is not open to students."
    />,
  );

  if (id === null) return notFound;

  if (loading) {
    return shell(
      <LoadingState
        label={justSubmitted ? "Loading your review…" : "Loading assessment…"}
      />,
    );
  }

  if (error) {
    return shell(
      <>
        {/* The submission is the server's now. Only reading it back failed, and
            a student told nothing would reasonably think it had not gone in. */}
        {justSubmitted && (
          <p
            role="status"
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            Your answers were submitted. Only the review could not be loaded.
          </p>
        )}
        <ErrorState message={error} onRetry={reload} />
      </>,
    );
  }

  if (data === null || data.kind === "missing") return notFound;

  if (data.kind === "withheld") {
    return shell(
      <Unavailable title="Assessment not available yet" message={data.message} />,
    );
  }

  const assessment =
    data.kind === "reviewed" ? data.review.assessment : data.assessment;

  return shell(
    <div className="space-y-6">
      <AssessmentHeading assessment={assessment} />

      {notice && (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {notice}
        </p>
      )}

      {data.kind === "reviewed" ? (
        <>
          <ResultCard
            result={data.review}
            // Only for a submission made here, once the server has answered:
            // the Submit button that had focus is gone. Opening a review that
            // was already there moves nothing.
            focusOnMount={justSubmitted}
          />
          {/* A submitted pre-test is what opens a topic's subtopics. Which one
              it opened is read from the server afresh, not assumed. Kept above
              the review, where it has always been, so moving on does not mean
              scrolling past every question first. */}
          {assessment.type === "pre_test" && (
            <NextSubtopic
              topicId={assessment.topicId}
              onOpen={(subtopicId) => navigate(`/subtopic/${subtopicId}`)}
            />
          )}
          <AssessmentAnswerReview review={data.review} />
        </>
      ) : data.assessment.questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="This assessment has no questions to answer."
        />
      ) : (
        <AnswerForm
          key={data.assessment.id}
          assessment={data.assessment}
          onSubmitted={() => {
            setNotice(null);
            setSubmittedFor(data.assessment.id);
            toast.success("Assessment submitted.");
            // The submission's reply is the totals alone. The review — what was
            // picked, what was right — is a reading of the attempt, so the page
            // is read again rather than a second way of loading it invented
            // here. That read is what puts the review up.
            reload();
          }}
          onStale={(message) => {
            setNotice(message);
            reload();
          }}
        />
      )}
    </div>,
  );
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-10 text-center space-y-3">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-gray-400" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </CardContent>
    </Card>
  );
}

/**
 * What the assessment is called, and which of the two it is.
 *
 * Takes only those fields, so that it draws the same heading over a form and
 * over a review — the review carries its own copy of them for an assessment
 * that is no longer on offer.
 */
function AssessmentHeading({
  assessment,
}: {
  assessment: Pick<StudentAssessment, "type" | "title" | "description">;
}) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 space-y-2">
        <span className="inline-flex text-xs font-medium rounded px-1.5 py-0.5 border text-blue-700 bg-blue-50 border-blue-200">
          {STUDENT_ASSESSMENT_TYPE_LABELS[assessment.type]}
        </span>
        <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
        {assessment.description && (
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {assessment.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The server's numbers, and only those: nothing about which answers were right. */
function ResultCard({
  result,
  focusOnMount = false,
}: {
  result: AssessmentResult;
  /** Move focus to the result as it appears, for a submission just made. */
  focusOnMount?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
    // Once, as the result arrives — not again on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      role="region"
      aria-labelledby="assessment-result-title"
      className="border border-gray-200 shadow-sm"
    >
      <CardContent className="p-8 text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" aria-hidden="true" />
        {/* Focusable from code only (tabIndex -1), so landing a student here
            after they submit adds no stop to the tab order. */}
        <h2
          ref={headingRef}
          id="assessment-result-title"
          tabIndex={-1}
          className="text-xl font-bold text-gray-900 focus:outline-none"
        >
          Assessment submitted
        </h2>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Score
          </p>
          <p className="text-3xl font-bold text-gray-900" data-testid="assessment-score">
            {result.earnedPoints} / {result.totalPoints}
          </p>
          <p className="text-lg text-gray-700" data-testid="assessment-percent">
            {formatPercent(result.percent)}%
          </p>
        </div>

        {result.submittedAt && (
          <p className="text-xs text-gray-500">
            Submitted {shortDate(result.submittedAt)}
          </p>
        )}
        <p className="text-xs text-gray-500">Each assessment can be taken once.</p>
      </CardContent>
    </Card>
  );
}

/**
 * Where a submitted pre-test leads: the subtopic the server now opens.
 *
 * Mounted only once there is a result, so the progression it reads is the one
 * after the submission. The topic is the one the server says this assessment
 * belongs to. If nothing is open — a waiver or completion elsewhere changed the
 * picture, or the read fails — it offers nothing, and Back still leads to the
 * topic, which shows the whole of it.
 */
function NextSubtopic({
  topicId,
  onOpen,
}: {
  topicId: number;
  onOpen: (subtopicId: number) => void;
}) {
  const load = useCallback(() => fetchTopicProgression(topicId), [topicId]);
  const { data } = useAsync(load, [topicId]);

  const next = openNextSubtopic(data);

  if (next === null) return null;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700">
          The topic&apos;s subtopics are open. Next up: {next.title}.
        </p>
        {/* Wraps and grows for a long section title: the shared Button never
            wraps. Narrow-width appearance is a browser check. */}
        <Button
          className="h-auto min-h-9 max-w-full whitespace-normal break-words py-2"
          onClick={() => onOpen(next.id)}
        >
          Start {next.title}
        </Button>
      </CardContent>
    </Card>
  );
}

/** "1", "1 and 3", "1, 2 and 4". */
function listNumbers(numbers: number[]): string {
  if (numbers.length <= 1) return numbers.join("");

  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

function AnswerForm({
  assessment,
  onSubmitted,
  onStale,
}: {
  assessment: StudentAssessment;
  /**
   * The submission landed. No result goes with it: the totals come back with
   * the review, read from the server, so this says that it happened and not
   * what it came to.
   */
  onSubmitted: () => void;
  /** The server says the page is out of date: taken elsewhere, or withdrawn. */
  onStale: (message: string) => void;
}) {
  const { questions } = assessment;

  const [selections, setSelections] = useState<AssessmentSelections>({});
  // Unanswered questions are pointed out only once a submit has been tried —
  // not from the start, when every question is unanswered.
  const [showMissing, setShowMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The disabled button is what a student sees; this is what actually stops a
  // second submission going out before the next render.
  const inFlight = useRef(false);

  const missing = unansweredQuestions(questions, selections);
  const missingIds = new Set(missing.map((question) => question.id));
  const answered = questions.length - missing.length;

  const choose = (questionId: number, choiceId: number) =>
    setSelections((current) => ({ ...current, [questionId]: choiceId }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (inFlight.current) return;

    if (missing.length > 0) {
      setShowMissing(true);
      setFailure(null);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    try {
      await submitAssessment(assessment.id, answersFor(questions, selections));

      onSubmitted();
    } catch (e) {
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) {
        // Not a problem with the answers: submitted from somewhere else first,
        // or no longer open. Read the page again and show what is true now.
        onStale(e.message);
        return;
      }

      // The answers stay exactly as they were, so nothing has to be picked again.
      setFailure(
        e instanceof ApiError && Object.keys(e.errors).length > 0
          ? Object.values(e.errors)
              .map((messages) => messages[0])
              .filter(Boolean)
              .join(" ")
          : e instanceof Error
            ? e.message
            : "Could not submit the assessment.",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const missingNumbers = missing.map((question) => questions.indexOf(question) + 1);

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={`Answer ${assessment.title}`}
      className="space-y-4"
    >
      <ol className="space-y-4">
        {questions.map((question, index) => {
          const number = index + 1;
          const unanswered = showMissing && missingIds.has(question.id);
          const hintId = `question-${question.id}-missing`;

          return (
            <li key={question.id}>
              <Card
                className={`border shadow-sm ${
                  unanswered ? "border-red-300" : "border-gray-200"
                }`}
              >
                <CardContent className="p-6">
                  <fieldset aria-describedby={unanswered ? hintId : undefined}>
                    <legend className="w-full">
                      <span className="block text-xs font-semibold text-gray-600">
                        Question {number}
                      </span>
                      <span className="block mt-1 text-base text-gray-900 whitespace-pre-line">
                        {question.prompt}
                      </span>
                    </legend>

                    <p className="mt-1 text-xs text-gray-500">
                      {question.points === 1 ? "1 point" : `${question.points} points`}
                    </p>

                    <div className="mt-4 space-y-2">
                      {question.choices.map((choice) => {
                        const checked = selections[question.id] === choice.id;

                        return (
                          <label
                            key={choice.id}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm cursor-pointer ${
                              checked
                                ? "border-blue-600 bg-blue-50 text-gray-900"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={choice.id}
                              checked={checked}
                              disabled={submitting}
                              onChange={() => choose(question.id, choice.id)}
                              className="h-4 w-4 shrink-0 accent-blue-600"
                            />
                            <span>{choice.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {unanswered && (
                      <p id={hintId} className="mt-3 text-xs text-red-600">
                        Choose an answer to this question.
                      </p>
                    )}
                  </fieldset>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-6 space-y-3">
          {showMissing && missing.length > 0 && (
            <p role="alert" className="text-sm text-red-600">
              {missing.length === 1 ? "Question" : "Questions"}{" "}
              {listNumbers(missingNumbers)} {missing.length === 1 ? "is" : "are"}{" "}
              unanswered. Answer every question before submitting.
            </p>
          )}

          {failure && (
            <p role="alert" className="text-sm text-red-600">
              {failure}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {answered} of {questions.length} answered
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit assessment"}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            You can submit this assessment once. Check your answers first.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
