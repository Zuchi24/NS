import {
  Activity,
  AlertTriangle,
  BookOpen,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { CompletionChart } from "./CompletionChart";
import { fetchOverview } from "@/features/admin/adminService";
import { useAsync } from "@/services/useAsync";

export function Dashboard() {
  const { data: overview, error, loading, reload } = useAsync(fetchOverview);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!overview) return null;

  const stats = [
    {
      title: "Students",
      value: String(overview.students),
      note: `${overview.sections} sections across ${overview.yearLevels} year levels`,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Catalogue",
      value: String(overview.topics),
      note: `${overview.topics} topics, ${overview.challenges} challenges`,
      icon: BookOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Challenge Completion",
      value: `${overview.challengeCompletion.percent}%`,
      note: `${overview.challengeCompletion.count} of ${overview.challengeCompletion.possible} passed`,
      icon: Trophy,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Roadmap Completion",
      value: `${overview.roadmapCompletion.percent}%`,
      note: `${overview.roadmapCompletion.count} of ${overview.roadmapCompletion.possible} topics done`,
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  const cohorts = overview.byYearLevel.filter((year) => year.students > 0);
  const strongest = [...cohorts].sort(
    (a, b) => b.challengeCompletion.percent - a.challengeCompletion.percent,
  )[0];
  const weakest = [...cohorts].sort(
    (a, b) => a.challengeCompletion.percent - b.challengeCompletion.percent,
  )[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor student progress and platform statistics
        </p>
      </div>

      {/* Students in no section appear in no roster, no cohort head count and
          no year-level breakdown. Saying so is the difference between a figure
          that is incomplete and one that is quietly wrong. */}
      {overview.unassignedStudents > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">
                {overview.unassignedStudents} student
                {overview.unassignedStudents === 1 ? " is" : "s are"} not
                assigned to a section
              </p>
              <p className="text-amber-800 mt-1">
                They are counted in the total above, but they appear in no
                section roster and in no year-level figure below. Signing up now
                requires a section, so these are accounts created before that.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 min-w-0">
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.note}</p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center shrink-0`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {overview.students === 0 ? (
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <EmptyState
              title="No students yet"
              description="Cohort figures appear here as soon as students sign up and start submitting work. Nothing on this page is illustrative — an empty platform reports empty."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-gray-200">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Insights
                </h2>
                <p className="text-sm text-gray-600">
                  Drawn from {overview.submissions.total} submission
                  {overview.submissions.total === 1 ? "" : "s"} across the
                  platform
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Active this week
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {overview.activeStudents} of {overview.students}
                  </p>
                  <p className="text-sm text-gray-600">
                    worked on something in the last{" "}
                    {overview.activeWithinDays} days
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Submission pass rate
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {overview.submissions.passRate}%
                  </p>
                  <p className="text-sm text-gray-600">
                    {overview.submissions.passed} of{" "}
                    {overview.submissions.total} satisfied every rule
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Cohort spread
                  </p>
                  {strongest && weakest && strongest.id !== weakest.id ? (
                    <>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {strongest.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-green-600">
                          {strongest.challengeCompletion.percent}%
                        </span>{" "}
                        ahead of {weakest.name} at{" "}
                        <span className="font-medium text-red-600">
                          {weakest.challengeCompletion.percent}%
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-600">
                      Only one year level has students in it, so there is
                      nothing to compare yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <CompletionChart
              title="Challenge completion by year level"
              description="Of every challenge each student could have passed, the share that has been passed"
              data={overview.byYearLevel}
              measure="challengeCompletion"
              unit="passed"
            />
            <CompletionChart
              title="Roadmap completion by year level"
              description="Of every topic each student could have finished, the share that has been finished"
              data={overview.byYearLevel}
              measure="roadmapCompletion"
              unit="topics"
            />
          </div>
        </>
      )}
    </div>
  );
}
