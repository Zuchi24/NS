import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, CheckCircle2, Lock, Timer } from "lucide-react";
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
} from "@/features/assessments/studentAssessmentService";
import type {
  AssessmentResult,
  AssessmentReview,
  AssessmentSelections,
  StudentAssessment,
  StudentAssessmentQuestion,
} from "@/features/assessments/studentAssessmentService";
import {
  formatCountdown,
  useQuestionCountdown,
} from "@/features/assessments/useQuestionCountdown";
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
 * The questions one at a time, each answered once — some against a timer — and
 * a single submission, after which the page shows the score the server worked
 * out, the review of what was answered, and never the questions again. A student who has already taken it lands on that
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
  /**
   * 409: a newer version of this assessment is live, so this one is no longer
   * offered. The topic is where the current version is.
   */
  | { kind: "replaced"; message: string }
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
    if (e instanceof ApiError && e.status === 409) {
      return { kind: "replaced", message: e.message };
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

  if (data.kind === "replaced") {
    return shell(<Unavailable title="Assessment updated" message={data.message} />);
  }

  const assessment =
    data.kind === "reviewed" ? data.review.assessment : data.assessment;

  return shell(
    <div className="space-y-6">
      <AssessmentHeading
        assessment={assessment}
        // A review names the version it was taken on, which may be older than
        // the one offered now; a form is always the version offered now.
        version={data.kind === "reviewed" ? data.review.assessment.version : null}
      />

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
  version,
}: {
  assessment: Pick<StudentAssessment, "type" | "title" | "description">;
  /** Shown beside the type when given. */
  version: number | null;
}) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex text-xs font-medium rounded px-1.5 py-0.5 border text-accent-foreground bg-accent border-brand-teal/30">
            {STUDENT_ASSESSMENT_TYPE_LABELS[assessment.type]}
          </span>
          {version !== null && (
            <span className="inline-flex text-xs font-medium rounded px-1.5 py-0.5 border text-gray-700 bg-white border-gray-200">
              Version {version}
            </span>
          )}
        </div>
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

/**
 * Taking the assessment: a start screen, then one question at a time, then the
 * single submission.
 *
 * Forward only. A question is settled exactly once — by Next with the choice
 * picked, or, on a timed question, by its time running out with nothing sent
 * but null — and the next question opens. There is no going back to change a
 * settled answer, which is what makes a per-question timer mean anything.
 *
 * The answers stay in this component until the last question is settled, and
 * then go in one submission through the same endpoint as always: nothing is
 * sent per question, and no attempt exists until that submission. So reloading
 * the page starts again from the start screen with fresh timers and nothing
 * picked — this version keeps no progress anywhere else, on purpose.
 *
 * Nothing here decides what is right. The server scores the submission; a
 * timed-out question is sent as null and the server calls it incorrect.
 */
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
  const total = questions.length;

  const [started, setStarted] = useState(false);
  // Which question is open. `total` once the last is settled: then nothing is
  // open, so no timer can be running while the answers are sent.
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // The question whose time just ran out, said on the question after it.
  const [timedOut, setTimedOut] = useState<number | null>(null);
  // What a screen reader is told: a timer nearing its end, or running out.
  const [announcement, setAnnouncement] = useState("");

  /*
   * The settled answers, kept in a ref rather than state: settling and
   * submitting happen in the same moment on the last question, and the answers
   * sent have to be the ones just settled, not the ones from the last render.
   */
  const selections = useRef<AssessmentSelections>({});
  const current = useRef(0);

  // The disabled button is what a student sees; this is what actually stops a
  // second submission going out before the next render.
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    try {
      await submitAssessment(assessment.id, answersFor(questions, selections.current));

      onSubmitted();
    } catch (e) {
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) {
        // Not a problem with the answers: submitted from somewhere else first,
        // or no longer open. Read the page again and show what is true now.
        onStale(e.message);
        return;
      }

      // The answers stay exactly as they were, so trying again sends the same.
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

  /**
   * Ends the open question, once.
   *
   * Next and the timer can both try to end the same question — a click landing
   * as the time runs out — and a timer from a question already gone can fire
   * late. Only the open question can be settled, and only the first time: the
   * second call finds it already settled, or no longer open, and does nothing.
   * So a question is never answered twice, never skipped, and the last one
   * never submits twice.
   */
  const settle = (questionId: number, choiceId: number | null) => {
    const at = current.current;

    if (questions[at]?.id !== questionId || questionId in selections.current) return;

    selections.current = { ...selections.current, [questionId]: choiceId };
    current.current = at + 1;
    setIndex(at + 1);

    if (choiceId === null) {
      setTimedOut(at + 1);
      setAnnouncement(`Time's up. Question ${at + 1} was not answered.`);
    } else {
      setTimedOut(null);
      setAnnouncement("");
    }

    if (at + 1 === total) void submit();
  };

  const timedCount = questions.filter((question) => question.timeLimitSeconds !== null).length;
  const question = questions[index];

  return (
    <div className="space-y-4">
      {/* The one place timing is announced: a timer nearing its end, and a
          question left unanswered. Outside the question, so it is still there
          to be read once the question it is about has gone. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="assessment-announcer">
        {announcement}
      </p>

      {!started ? (
        <StartScreen
          title={assessment.title}
          total={total}
          timedCount={timedCount}
          onStart={() => setStarted(true)}
        />
      ) : question !== undefined ? (
        <QuestionStep
          // One per question: a new question is a new step, with its own
          // deadline, and nothing of the last one's timer carried over.
          key={question.id}
          question={question}
          number={index + 1}
          total={total}
          timedOutBefore={timedOut !== null && timedOut === index ? timedOut : null}
          onSettle={(choiceId) => settle(question.id, choiceId)}
          onWarn={(message) => setAnnouncement(message)}
        />
      ) : (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-6 space-y-3">
            {timedOut === total && (
              <p className="text-sm text-amber-800">
                Time ran out on question {total}, so it was left unanswered.
              </p>
            )}

            {failure ? (
              <>
                <p role="alert" className="text-sm text-red-600">
                  {failure}
                </p>
                <p className="text-sm text-gray-600">
                  Your answers are still here. Nothing has been submitted yet.
                </p>
                <Button type="button" onClick={() => void submit()} disabled={submitting}>
                  {submitting ? "Submitting…" : "Try submitting again"}
                </Button>
              </>
            ) : (
              <p role="status" className="text-sm text-gray-700">
                Submitting your answers…
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** What the assessment is and how it runs, before any clock starts. */
function StartScreen({
  title,
  total,
  timedCount,
  onStart,
}: {
  title: string;
  total: number;
  timedCount: number;
  onStart: () => void;
}) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600">
            {total === 1 ? "1 question" : `${total} questions`}, one at a time.
          </p>
        </div>

        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          {timedCount > 0 && (
            <li>
              {timedCount === total
                ? "Every question is timed."
                : timedCount === 1
                  ? "One question is timed."
                  : `${timedCount} questions are timed.`}{" "}
              A timed question&apos;s clock starts when it appears. If it runs out,
              the question is left unanswered and the next one opens.
            </li>
          )}
          <li>Pick an answer, then choose Next. You can&apos;t go back to a question.</li>
          <li>You can submit this assessment once.</li>
        </ul>

        <Button type="button" onClick={onStart}>
          Start assessment
        </Button>
      </CardContent>
    </Card>
  );
}

/** How far into the countdown a screen reader is told time is short. */
const WARN_AT_MS = 10_000;

/** Below this, the countdown is shown as urgent. */
const URGENT_AT_MS = 5_000;

/**
 * The open question.
 *
 * Mounted once per question, so its countdown starts when it appears and ends
 * with it. Picking a choice only picks it; Next is what settles the question.
 */
function QuestionStep({
  question,
  number,
  total,
  timedOutBefore,
  onSettle,
  onWarn,
}: {
  question: StudentAssessmentQuestion;
  number: number;
  total: number;
  /** The previous question's number, when its time ran out. */
  timedOutBefore: number | null;
  onSettle: (choiceId: number | null) => void;
  onWarn: (message: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const remaining = useQuestionCountdown(question.timeLimitSeconds, () => onSettle(null));

  const headingRef = useRef<HTMLHeadingElement>(null);
  const isLast = number === total;

  // Each question takes focus as it opens: the Next or Start that had it is
  // gone, and a screen reader reads the new question from its heading.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Once, as the time gets short — never a second-by-second count.
  const warned = useRef(false);
  useEffect(() => {
    if (
      remaining !== null &&
      !warned.current &&
      question.timeLimitSeconds !== null &&
      question.timeLimitSeconds * 1000 > WARN_AT_MS &&
      remaining > 0 &&
      remaining <= WARN_AT_MS
    ) {
      warned.current = true;
      onWarn(`${Math.ceil(remaining / 1000)} seconds left on question ${number}.`);
    }
  }, [remaining, question.timeLimitSeconds, number, onWarn]);

  const urgent = remaining !== null && remaining <= URGENT_AT_MS;
  const choices = [...question.choices].sort((a, b) => a.order - b.order);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6 space-y-5">
        {/* Where the student is. Settled questions are not marked right or
            wrong: nothing here knows. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-700" data-testid="question-progress">
              Question {number} / {total}
            </p>

            {remaining !== null && (
              <p
                data-testid="question-timer"
                // The time left is for the eye; a screen reader is told only
                // as it gets short, and when it runs out.
                aria-hidden="true"
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm tabular-nums ${
                  urgent
                    ? "border-red-300 bg-red-50 text-red-700 font-semibold"
                    : "border-gray-200 bg-white text-gray-800"
                }`}
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                {formatCountdown(remaining)}
              </p>
            )}
          </div>

          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={number}
            aria-valuetext={`Question ${number} of ${total}`}
            className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${(number / total) * 100}%` }}
            />
          </div>
        </div>

        {timedOutBefore !== null && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
            Time ran out on question {timedOutBefore}, so it was left unanswered.
          </p>
        )}

        <fieldset className="space-y-3">
          <legend className="w-full">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-gray-900 whitespace-pre-line focus:outline-none"
            >
              <span className="sr-only">
                Question {number} of {total}
                {question.timeLimitSeconds !== null &&
                  `, ${question.timeLimitSeconds} second time limit`}
                .{" "}
              </span>
              {question.prompt}
            </h2>
            <span className="mt-1 block text-xs text-gray-500">
              {question.points === 1 ? "1 point" : `${question.points} points`}
            </span>
          </legend>

          <div className="grid gap-2.5">
            {choices.map((choice, slot) => {
              const checked = picked === choice.id;

              return (
                <label
                  key={choice.id}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3.5 text-base cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                    checked
                      ? "border-primary bg-accent text-foreground"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choice.id}
                    checked={checked}
                    onChange={() => setPicked(choice.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {checked ? <Check className="h-4 w-4" /> : (CHOICE_LETTERS[slot] ?? String(slot + 1))}
                  </span>
                  <span className="flex-1">{choice.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          {picked === null && (
            <p className="text-xs text-gray-500">Pick an answer to continue.</p>
          )}
          <Button type="button" disabled={picked === null} onClick={() => onSettle(picked)}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** A question has two to six choices; past F, should one ever arrive, a number. */
const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];
