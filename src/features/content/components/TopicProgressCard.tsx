import { useCallback } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, History, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { fetchTopicProgression } from "@/features/content/progressionService";
import {
  SUBTOPIC_STATUS_LABEL,
  SUBTOPIC_STATUS_STYLE,
} from "@/features/content/subtopicStatus";
import type {
  ProgressionPastResult,
  ProgressionPostTest,
  ProgressionPreTest,
  ProgressionResult,
  TopicProgression,
} from "@/features/content/progressionService";
import { useAsync } from "@/services/useAsync";

/**
 * A student's way through a root topic, on the topic's own page.
 *
 * The pre-test, then the subtopics in order, then the post-test — each drawn
 * exactly as the server judged it. The card offers a way into whatever the
 * server has opened and says why the rest is shut; it never opens anything
 * itself. What a subtopic holds is still read on that subtopic's page: here it
 * is a title, a status and a way in.
 *
 * Nothing is drawn for a topic with nothing to pace and nothing already done —
 * no published pre-test, no subtopics and no result behind the student — and
 * the post-test is never offered on a topic with no subtopics, which the server
 * keeps shut rather than calling "all of nothing completed" done.
 *
 * Results the student holds on assessments the topic no longer offers are shown
 * apart from all of that, under their own heading. They are not steps: there is
 * nothing to take, nothing gating anything behind them, and the only thing on
 * offer is the review of what was already submitted.
 */

export function formatResult(result: ProgressionResult): string {
  return `${result.earnedPoints} / ${result.totalPoints} (${Math.round(result.percent * 100) / 100}%)`;
}

export function TopicProgressCard({ topicId }: { topicId: number }) {
  const navigate = useNavigate();

  const load = useCallback(() => fetchTopicProgression(topicId), [topicId]);
  const { data, error, loading, reload } = useAsync(load, [topicId]);

  const titleId = `topic-${topicId}-progress-title`;

  const frame = (children: React.ReactNode) => (
    <Card
      role="region"
      aria-labelledby={titleId}
      className="border border-gray-200 shadow-sm bg-white"
    >
      <CardContent className="p-6 space-y-5">
        <h2 id={titleId} className="text-xl font-bold text-gray-900">
          Your progress
        </h2>
        {children}
      </CardContent>
    </Card>
  );

  if (loading) return frame(<LoadingState label="Loading your progress…" />);
  if (error) return frame(<ErrorState message={error} onRetry={reload} />);
  if (data === null) return null;

  const hasSubtopics = data.totalCount > 0;
  const hasPastResults = data.pastResults.length > 0;

  /*
   * A post-test is offered against the subtopics it follows, so a topic with
   * none of them does not show the step — but a student who took it before
   * those subtopics were removed still holds the result, and that is theirs to
   * read whatever the topic looks like now.
   */
  const showPostTest = data.postTest !== null && (hasSubtopics || data.postTest.submitted);

  if (data.preTest === null && !hasSubtopics && !showPostTest && !hasPastResults) {
    return null;
  }

  return frame(
    <>
      {data.preTest && (
        <PreTestStep
          preTest={data.preTest}
          hasSubtopics={hasSubtopics}
          onOpen={(id) => navigate(`/assessments/${id}`)}
        />
      )}

      {hasSubtopics && (
        <SubtopicSteps
          progression={data}
          onOpen={(id) => navigate(`/subtopic/${id}`)}
        />
      )}

      {showPostTest && data.postTest && (
        <PostTestStep
          postTest={data.postTest}
          onOpen={(id) => navigate(`/assessments/${id}`)}
        />
      )}

      {hasPastResults && (
        <PastResults
          results={data.pastResults}
          onOpen={(id) => navigate(`/assessments/${id}`)}
        />
      )}
    </>,
  );
}

const PAST_RESULT_LABEL: Record<ProgressionPastResult["type"], string> = {
  pre_test: "Pre-test",
  post_test: "Post-test",
};

/**
 * What the student has already done here, on assessments no longer offered.
 *
 * Its own section, below the pacing and visibly not part of it: no step number,
 * no lock, no "take" anywhere. One thing is offered against each — the review of
 * the attempt they submitted — and the wording says so, because an assessment
 * that is no longer on offer must not read as one that could be taken again.
 */
function PastResults({
  results,
  onOpen,
}: {
  results: ProgressionPastResult[];
  onOpen: (assessmentId: number) => void;
}) {
  return (
    <section aria-label="Earlier results" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Earlier results</h3>
        <span className="text-xs text-gray-500">No longer offered in this topic</span>
      </div>

      <ul className="space-y-2">
        {results.map((past) => (
          <li
            key={past.assessmentId}
            className="rounded-md border border-gray-200 p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StepHeading kind={PAST_RESULT_LABEL[past.type]} title={past.title} />

              <Button
                size="sm"
                variant="outline"
                aria-label={`Review your ${PAST_RESULT_LABEL[past.type].toLowerCase()} result: ${past.title}`}
                onClick={() => onOpen(past.assessmentId)}
              >
                Review result
              </Button>
            </div>

            <p className="text-sm text-gray-700 flex items-start gap-2">
              <History className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
              Submitted on version {past.version} · {formatResult(past.result)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Which version a result was taken on, said only when it is not the version the
 * step offers now — a student who took version 1 before version 2 went live.
 * Every other result is on the version in front of them, and saying so would
 * be noise.
 */
function versionNote(result: ProgressionResult, offered: number): string {
  return result.version === offered ? "" : ` on version ${result.version}`;
}

function StepHeading({ kind, title }: { kind: string; title: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {kind}
      </p>
      <p className="text-sm font-semibold text-gray-900 break-words">{title}</p>
    </div>
  );
}

function PreTestStep({
  preTest,
  hasSubtopics,
  onOpen,
}: {
  preTest: ProgressionPreTest;
  /** Whether there are subtopics for the pre-test to open — wording only. */
  hasSubtopics: boolean;
  onOpen: (assessmentId: number) => void;
}) {
  return (
    <section
      aria-label="Pre-test"
      className="rounded-md border border-gray-200 p-4 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepHeading kind="Pre-test" title={preTest.title} />

        {preTest.required ? (
          <Button size="sm" onClick={() => onOpen(preTest.id)}>
            Take the pre-test
          </Button>
        ) : (
          // A result is reviewed on the version it was taken on, which may be
          // older than the one on offer now.
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen(preTest.result?.assessmentId ?? preTest.id)}
          >
            {preTest.submitted ? "View result" : "Open pre-test"}
          </Button>
        )}
      </div>

      {preTest.required ? (
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {hasSubtopics
            ? "Submit the pre-test to open this topic's subtopics."
            : "Take the pre-test for this topic."}
        </p>
      ) : preTest.submitted ? (
        <p className="text-sm text-gray-700 flex items-start gap-2">
          <CheckCircle2
            className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          {preTest.result
            ? `Submitted${versionNote(preTest.result, preTest.version)} · ${formatResult(preTest.result)}`
            : "Submitted"}
        </p>
      ) : preTest.waived ? (
        // Optional, not withheld: the server still lets this student take it,
        // and taking it changes nothing about what is open to them.
        <p className="text-sm text-gray-600">
          Not required — you had already started this topic before it had a
          pre-test. You can still take it if you want to.
        </p>
      ) : null}
    </section>
  );
}

function SubtopicSteps({
  progression,
  onOpen,
}: {
  progression: TopicProgression;
  onOpen: (subtopicId: number) => void;
}) {
  return (
    <section aria-label="Subtopics" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Subtopics</h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {progression.completedCount} of {progression.totalCount} completed
        </span>
      </div>

      <ol className="space-y-1.5">
        {progression.subtopics.map((subtopic, index) => (
          <li
            key={subtopic.id}
            className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2"
          >
            <span className="w-5 shrink-0 text-sm tabular-nums text-gray-400">
              {index + 1}.
            </span>
            <span
              className={`flex-1 min-w-0 text-sm break-words ${
                subtopic.status === "locked" ? "text-gray-500" : "text-gray-900"
              }`}
            >
              {subtopic.title}
            </span>
            <span
              className={`text-xs font-medium rounded px-1.5 py-0.5 border ${SUBTOPIC_STATUS_STYLE[subtopic.status]}`}
            >
              {SUBTOPIC_STATUS_LABEL[subtopic.status]}
            </span>

            {subtopic.status === "available" && (
              <Button
                size="sm"
                aria-label={`Start ${subtopic.title}`}
                onClick={() => onOpen(subtopic.id)}
              >
                Start
              </Button>
            )}
            {subtopic.status === "completed" && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Review ${subtopic.title}`}
                onClick={() => onOpen(subtopic.id)}
              >
                Review
              </Button>
            )}
            {subtopic.status === "locked" && (
              <Lock className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PostTestStep({
  postTest,
  onOpen,
}: {
  postTest: ProgressionPostTest;
  onOpen: (assessmentId: number) => void;
}) {
  return (
    <section
      aria-label="Post-test"
      className="rounded-md border border-gray-200 p-4 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepHeading kind="Post-test" title={postTest.title} />

        {postTest.submitted ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen(postTest.result?.assessmentId ?? postTest.id)}
          >
            View result
          </Button>
        ) : postTest.available ? (
          <Button size="sm" onClick={() => onOpen(postTest.id)}>
            Take the post-test
          </Button>
        ) : null}
      </div>

      {postTest.submitted ? (
        <p className="text-sm text-gray-700 flex items-start gap-2">
          <CheckCircle2
            className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          {postTest.result
            ? `Submitted${versionNote(postTest.result, postTest.version)} · ${formatResult(postTest.result)}`
            : "Submitted"}
        </p>
      ) : postTest.available ? (
        <p className="text-sm text-gray-700">
          Every subtopic is complete. The post-test is open.
        </p>
      ) : (
        <p className="text-sm text-gray-600 flex items-start gap-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {postTest.lockedReason ??
            "The post-test opens once every subtopic is complete."}
        </p>
      )}
    </section>
  );
}
