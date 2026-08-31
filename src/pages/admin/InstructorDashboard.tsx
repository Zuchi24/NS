import { useNavigate } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Inbox,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import {
  fetchAnalytics,
  fetchOverview,
  fetchRecentSubmissions,
} from "@/features/admin/adminService";
import { minutes } from "@/features/admin/format";
import { timeAgo } from "@/services/time";
import { useAsync } from "@/services/useAsync";

/**
 * The live view of the platform: what has just been handed in, from anywhere.
 *
 * Deliberately not another cohort summary — /admin/dashboard reports the
 * platform in aggregate and /admin/analytics reports it by topic. This is the
 * one page that crosses sections and shows individual work as it arrives.
 */
export function InstructorDashboard() {
  const navigate = useNavigate();

  const { data, error, loading, reload } = useAsync(() =>
    Promise.all([
      fetchOverview(),
      fetchRecentSubmissions(25),
      fetchAnalytics(),
    ]).then(([overview, submissions, analytics]) => ({
      overview,
      submissions,
      analytics,
    })),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Instructor Monitoring
          </h1>
          <p className="text-gray-600">
            Work as it comes in, across every year level and section
          </p>
        </div>

        {loading && <LoadingState label="Loading submissions…" />}
        {error && <ErrorState message={error} onRetry={reload} />}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  label: "Students",
                  value: String(data.overview.students),
                  icon: Users,
                  color: "text-blue-600",
                  bgColor: "bg-blue-100",
                },
                {
                  label: "Submissions",
                  value: String(data.overview.submissions.total),
                  icon: Inbox,
                  color: "text-purple-600",
                  bgColor: "bg-purple-100",
                },
                {
                  label: "Pass rate",
                  value: `${data.overview.submissions.passRate}%`,
                  icon: CheckCircle,
                  color: "text-green-600",
                  bgColor: "bg-green-100",
                },
                {
                  label: `Active in ${data.overview.activeWithinDays}d`,
                  value: String(data.overview.activeStudents),
                  icon: TrendingUp,
                  color: "text-orange-600",
                  bgColor: "bg-orange-100",
                },
              ].map((stat) => (
                <Card key={stat.label} className="border-gray-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}
                      >
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-gray-200">
                  <CardHeader>
                    <CardTitle>Recent submissions</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Newest first. A failed submission lists the requirements
                      it missed, exactly as the grader recorded them.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {data.submissions.length === 0 ? (
                      <EmptyState
                        title="Nothing submitted yet"
                        description="Submitted attempts appear here the moment a student hands one in."
                      />
                    ) : (
                      <div className="space-y-4">
                        {data.submissions.map((submission) => {
                          const missed = (submission.requirements ?? []).filter(
                            (requirement) => !requirement.passed,
                          );

                          return (
                            <div
                              key={submission.id}
                              className="border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      {submission.student.fullName}
                                    </h3>
                                    {submission.student.section && (
                                      <span className="text-xs text-gray-500">
                                        {submission.student.section}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mt-0.5">
                                    {submission.challenge.title}
                                  </p>
                                </div>
                                {submission.passed ? (
                                  <Badge className="bg-green-100 text-green-700 shrink-0">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Passed
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-100 text-orange-700 shrink-0">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Not passed
                                  </Badge>
                                )}
                              </div>

                              {missed.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                  {missed.map((requirement) => (
                                    <li
                                      key={requirement.requirement}
                                      className="text-xs text-gray-600 flex items-start gap-2"
                                    >
                                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                      {requirement.requirement}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                                <Clock className="w-3.5 h-3.5" />
                                {timeAgo(submission.submittedAt)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="border-gray-200">
                  <CardHeader>
                    <CardTitle>Hardest challenges</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Lowest pass rate first, among the ones anyone has
                      submitted for.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const attempted = data.analytics.challenges
                        .filter((challenge) => challenge.submissions > 0)
                        .sort((a, b) => a.passRate - b.passRate)
                        .slice(0, 6);

                      if (attempted.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 py-6 text-center">
                            No challenge has been submitted for yet.
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {attempted.map((challenge) => (
                            <div key={challenge.id} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {challenge.title}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 shrink-0">
                                  {challenge.passRate}%
                                </span>
                              </div>
                              <Progress
                                value={challenge.passRate}
                                className="h-2"
                              />
                              <p className="text-xs text-gray-500">
                                {challenge.studentsPassed}/
                                {challenge.studentsAttempted} students ·{" "}
                                {minutes(challenge.averageMinutes)} avg
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
