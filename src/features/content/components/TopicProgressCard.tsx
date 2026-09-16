import { useCallback } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { fetchTopicProgression } from "@/features/content/progressionService";
import {
  SUBTOPIC_STATUS_LABEL,
  SUBTOPIC_STATUS_STYLE,
} from "@/features/content/subtopicStatus";
import type {
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
 * Nothing is drawn for a topic with nothing to pace — no published pre-test
 * and no subtopics — and the post-test is never offered on a topic with no
 * subtopics, which the server keeps shut rather than calling "all of nothing
 * completed" done.
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

  if (data.preTest === null && !hasSubtopics) return null;

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

      {hasSubtopics && data.postTest && (
        <PostTestStep
          postTest={data.postTest}
          onOpen={(id) => navigate(`/assessments/${id}`)}
        />
      )}
    </>,
  );
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
          <Button size="sm" variant="outline" onClick={() => onOpen(preTest.id)}>
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
          {preTest.result ? `Submitted · ${formatResult(preTest.result)}` : "Submitted"}
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
          <Button size="sm" variant="outline" onClick={() => onOpen(postTest.id)}>
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
          {postTest.result ? `Submitted · ${formatResult(postTest.result)}` : "Submitted"}
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
