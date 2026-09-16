import { useCallback } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { fetchAssessmentResults } from "@/features/assessments/adminAssessmentService";
import type { AssessmentResult } from "@/features/assessments/adminAssessmentService";
import { useAsync } from "@/services/useAsync";

/**
 * Who has taken this assessment, and what they scored.
 *
 * The only view of a result that is not the student's own: every student route
 * answers about the caller, so without this an assessment could be set, taken
 * by a class, and never looked at by the person who set it.
 *
 * Read-only, and deliberately plain. A name, a score and a time is what an
 * instructor needs to see at a glance; averages, rankings and charts would each
 * be a claim about the class rather than a record of it, and none of them is
 * decided here. Nothing on this panel changes anything, so it carries no
 * controls at all.
 *
 * What it cannot show is as deliberate. Which choices a student picked is the
 * answer key read from the other side, and the server does not send it — so
 * there is nothing here to accidentally put on screen.
 */

/** The moment a result was handed in, in the reader's own locale. */
function formatSubmitted(submittedAt: string | null): string {
  if (submittedAt === null) return "—";

  const at = new Date(submittedAt);

  // A date the browser could not read is shown as it arrived rather than as
  // "Invalid Date", which tells an instructor nothing they can act on.
  if (Number.isNaN(at.getTime())) return submittedAt;

  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Whole numbers stay whole; a third of a mark keeps its decimals. */
function formatPercent(percent: number): string {
  return `${Math.round(percent * 100) / 100}%`;
}

export function AssessmentResultsPanel({ assessmentId }: { assessmentId: number }) {
  const load = useCallback(
    () => fetchAssessmentResults(assessmentId),
    [assessmentId],
  );
  const { data, error, loading, reload } = useAsync(load, [assessmentId]);

  const titleId = `assessment-${assessmentId}-results-title`;

  const frame = (children: React.ReactNode) => (
    <Card className="border-gray-200" role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId} className="text-lg">
          Results
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (loading) return frame(<LoadingState label="Loading results…" />);

  // The server's own words, which name a refusal better than this panel could.
  if (error) return frame(<ErrorState message={error} onRetry={reload} />);
  if (!data) return null;

  if (data.length === 0) {
    return frame(
      <p className="text-sm text-gray-600">
        No students have submitted this assessment yet.
      </p>,
    );
  }

  return frame(
    <>
      <p className="text-sm text-gray-600 mb-3">
        {data.length} student{data.length === 1 ? "" : "s"} submitted, most
        recent first.
      </p>

      {/*
        The table scrolls sideways inside its own box rather than pushing the
        page wider, which is what keeps a long name from putting the whole
        builder into a horizontal scroll on a narrow screen.
      */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Students who have submitted this assessment, with their scores
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="py-2 pr-4 font-medium">
                Student
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Score
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Percentage
              </th>
              <th scope="col" className="py-2 font-medium">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((result) => (
              <ResultRow key={result.id} result={result} />
            ))}
          </tbody>
        </table>
      </div>
    </>,
  );
}

function ResultRow({ result }: { result: AssessmentResult }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <th scope="row" className="py-2 pr-4 text-left font-medium text-gray-900">
        <span className="break-words">{result.student.fullName}</span>

        {/* The school's id under the name: two students can share a name, and
            this is what tells an instructor which one they are looking at. */}
        {result.student.studentId !== null && (
          <span className="block text-xs font-normal text-gray-500 tabular-nums">
            {result.student.studentId}
          </span>
        )}
      </th>

      <td className="py-2 pr-4 text-gray-900 tabular-nums whitespace-nowrap">
        {result.earnedPoints} / {result.totalPoints}
      </td>

      <td className="py-2 pr-4 text-gray-900 tabular-nums whitespace-nowrap">
        {formatPercent(result.percent)}
      </td>

      <td className="py-2 text-gray-600 whitespace-nowrap">
        {formatSubmitted(result.submittedAt)}
      </td>
    </tr>
  );
}
