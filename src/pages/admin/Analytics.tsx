import { Activity, BarChart3, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchAnalytics } from "@/features/admin/adminService";
import { minutes } from "@/features/admin/format";
import { useAsync } from "@/services/useAsync";

export function Analytics() {
  const { data, error, loading, reload } = useAsync(fetchAnalytics);

  if (loading) return <LoadingState label="Loading analytics…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { challenges } = data;

  /*
   * The busiest challenge, which is what the card below says this is.
   *
   * Reading challenges[0] agreed with that only by coincidence: the API returns
   * the catalogue in its authored order, and the first challenge is usually the
   * most attempted simply because it comes first. Reorder the catalogue, or
   * publish a challenge people take up faster, and the figure would keep the
   * label while quietly reporting something else.
   */
  const busiest = challenges.reduce(
    (most, challenge) => Math.max(most, challenge.studentsAttempted),
    0,
  );
  const submissions = challenges.reduce(
    (sum, challenge) => sum + challenge.submissions,
    0,
  );
  const passed = challenges.reduce(
    (sum, challenge) => sum + challenge.passedSubmissions,
    0,
  );
  const timed = challenges.filter(
    (challenge) => challenge.averageMinutes !== null,
  );
  const averageMinutes = timed.length
    ? Math.round(
        timed.reduce(
          (sum, challenge) => sum + (challenge.averageMinutes ?? 0),
          0,
        ) / timed.length,
      )
    : null;
  const metrics = [
    {
      label: "Challenges passed",
      value: String(
        challenges.reduce((sum, challenge) => sum + challenge.studentsPassed, 0),
      ),
      note: `across ${challenges.length} challenge${challenges.length === 1 ? "" : "s"}`,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Submission pass rate",
      value: submissions > 0 ? `${Math.round((passed / submissions) * 100)}%` : "—",
      note: `${passed} of ${submissions} submissions`,
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Students attempting",
      value: String(busiest),
      note: `on the busiest of ${challenges.length} challenge${challenges.length === 1 ? "" : "s"}`,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Avg time per challenge",
      value: minutes(averageMinutes),
      note:
        averageMinutes === null
          ? "no completed attempts to measure yet"
          : `over ${timed.length} challenge${timed.length === 1 ? "" : "s"} with submissions`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">
          Where the cohort is getting stuck, measured from submitted work
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                  <p className="text-xs text-gray-500">{metric.note}</p>
                </div>
                <div
                  className={`w-12 h-12 ${metric.bgColor} rounded-xl flex items-center justify-center shrink-0`}
                >
                  <metric.icon className={`w-6 h-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Challenge performance</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            A challenge nobody has submitted for shows no rate, rather than a
            zero it has not earned.
          </p>
        </CardHeader>
        <CardContent>
          {challenges.length === 0 ? (
            <EmptyState
              title="No challenges yet"
              description="Challenges appear here once the catalogue has some."
            />
          ) : (
            <div className="space-y-5">
              {challenges.map((challenge) => (
                <div key={challenge.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">
                        {challenge.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        {challenge.studentsPassed}/
                        {challenge.studentsAttempted} students passed
                      </span>
                      <span className="text-gray-600">
                        {minutes(challenge.averageMinutes)}
                      </span>
                      <span className="font-semibold text-blue-600">
                        {challenge.submissions === 0
                          ? "No submissions"
                          : `${challenge.passRate}% of submissions`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={challenge.passRate} className="h-2 flex-1" />
                    <span className="text-sm text-gray-600 w-28 text-right">
                      {challenge.passedSubmissions}/{challenge.submissions}{" "}
                      submitted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
