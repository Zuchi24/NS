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

  const { topics, challenges } = data;

  const students = topics[0]?.studentsTotal ?? 0;
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
  const topicsCompleted = topics.reduce(
    (sum, topic) => sum + topic.studentsCompleted,
    0,
  );

  const metrics = [
    {
      label: "Topic completion",
      value:
        students > 0 && topics.length > 0
          ? `${Math.round(
              (topicsCompleted / (students * topics.length)) * 100,
            )}%`
          : "—",
      note: `${topicsCompleted} of ${students * topics.length} student-topic pairs`,
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
      label: "Students",
      value: String(students),
      note: `across ${topics.length} topics and ${challenges.length} challenges`,
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
          <CardTitle className="text-lg">Topic engagement</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            How far the cohort has got into each topic. &ldquo;Reached&rdquo; is
            how many students the topic is open to.
          </p>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <EmptyState
              title="No topics yet"
              description="Topics appear here once the catalogue has some."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Topic
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Reached
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      In progress
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Completed
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Avg time
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Completion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr
                      key={topic.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900">
                          {topic.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {topic.challenges} challenge
                          {topic.challenges === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {topic.studentsReached}/{topic.studentsTotal}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {topic.studentsInProgress}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {topic.studentsCompleted}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {minutes(topic.averageMinutes)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={topic.completionPercent}
                            className="h-2 w-24"
                          />
                          <span className="text-sm text-gray-600">
                            {topic.completionPercent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                      {challenge.topics.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500">
                          {challenge.topics.join(", ")}
                        </span>
                      )}
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
