import { Card, CardContent } from "@/components/ui/card";
import { ChallengesChart } from "./ChallengesChart";
import { RoadmapChart } from "./RoadmapChart";
import { generateDashboardInsights, getYearlyChallengeStats, getYearlyRoadmapStats } from "@/data/dashboardTransform";

export function Dashboard() {
  const yearlyChallenges = getYearlyChallengeStats();
  const yearlyRoadmap = getYearlyRoadmapStats();
  const insights = generateDashboardInsights();

  const stats = [
    {
      title: "Total Students",
      value: "156",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      change: "+12%",
    },
    {
      title: "Total Topics",
      value: "28",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      change: "100%",
    },
    {
      title: "Challenge Completion",
      value: `${insights.overallChallengeRate}%`,
      color: "text-green-600",
      bgColor: "bg-green-100",
      change: insights.overallChallengeRate >= 75 ? "On Track" : "Needs Attention",
    },
    {
      title: "Roadmap Completion",
      value: `${insights.overallRoadmapRate}%`,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      change: insights.overallRoadmapRate >= 75 ? "On Track" : "Needs Attention",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor student progress and platform statistics
        </p>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className={`text-sm font-medium ${
                    stat.change.includes("Needs") ? "text-red-600" : 
                    stat.change.includes("On Track") ? "text-green-600" :
                    "text-gray-600"
                  }`}>
                    {stat.change}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}
                >
                  <div className={`w-6 h-6 ${stat.color}`}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights derived from challenge and roadmap data */}
      <Card className="border-gray-200">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Insights</h2>
            <p className="text-sm text-gray-600">
              Where cohorts are strongest and where they need support
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Strongest Year
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                Year {insights.strongestYear.year}
              </p>
              <p className="text-sm font-medium text-green-600">
                {insights.strongestYear.rate}% completion
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Needs Attention
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                Year {insights.weakestYear.year}
              </p>
              <p className="text-sm font-medium text-red-600">
                {insights.weakestYear.rate}% completion
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Weakest Topic
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {insights.weakestCategory.category}
              </p>
              <p className="text-sm font-medium text-red-600">
                {insights.weakestCategory.rate}% &middot; Year {insights.weakestCategory.year}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Theory vs. practice gap
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Challenges are at{" "}
              <span className="font-semibold text-gray-900">
                {insights.theoryPracticGap.challenges}%
              </span>{" "}
              while roadmap topics are at{" "}
              <span className="font-semibold text-gray-900">
                {insights.theoryPracticGap.roadmap}%
              </span>
              {" — a "}
              <span
                className={
                  Math.abs(insights.theoryPracticGap.gap) >= 10
                    ? "font-semibold text-red-600"
                    : "font-semibold text-green-600"
                }
              >
                {Math.abs(insights.theoryPracticGap.gap)} point
              </span>
              {insights.theoryPracticGap.gap >= 0
                ? " lead for hands-on work."
                : " lead for theory."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Charts - Stacked Layout */}
      <div className="space-y-6">
        {/* Challenges Chart */}
        <ChallengesChart data={yearlyChallenges} />

        {/* Roadmap Chart */}
        <RoadmapChart data={yearlyRoadmap} />
      </div>
    </div>
  );
}
