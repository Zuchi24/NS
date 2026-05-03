import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ChallengesChart } from "./ChallengesChart";
import { RoadmapChart } from "./RoadmapChart";
import { generateDashboardInsights, getYearlyChallengeStats, getYearlyRoadmapStats } from "../../data/dashboardTransform";

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
