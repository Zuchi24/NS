import { Link } from "react-router";
import {
  Target,
  CheckCircle2,
  Clock,
  Wrench,
  Map,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/useAuth";

import { Progress } from "@/components/ui/progress";

export function Dashboard() {
  const { user } = useAuth();
  // Calculate totals from the recent activities
  const completedCount = 12;
  const pendingCount = 3;
  const totalActivities = completedCount + pendingCount;
  const overallProgress = Math.round((completedCount / totalActivities) * 100);

  const recentActivities = [
    {
      title: "Basic Network Topology",
      status: "Completed",
      score: 95,
      time: "2 hours ago",
    },
    {
      title: "IP Configuration Practice",
      status: "Completed",
      score: 88,
      time: "1 day ago",
    },
    {
      title: "Cable Wiring Challenge",
      status: "In Progress",
      score: null,
      time: "Just now",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name ?? "Student"}!
        </h1>
        <p className="text-gray-600">
          Here's your learning progress and upcoming tasks
        </p>
      </div>

      {/* TOP SECTION: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Completed Activities */}
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Completed Activities
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {completedCount}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Activities */}
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Pending Activities
                </p>
                <p className="text-3xl font-bold text-orange-600">
                  {pendingCount}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Progress */}
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Overall Progress</p>
                <p className="text-2xl font-bold text-purple-600">
                  {overallProgress}%
                </p>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MIDDLE SECTION: Main Features - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Workspace */}
        <Link to="/workspace">
          <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Workspace
                  </h3>
                  <p className="text-sm text-gray-500">
                    Practice hands-on
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Challenges */}
        <Link to="/challenges">
          <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Challenges
                  </h3>
                  <p className="text-sm text-gray-500">
                    Test your skills
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Roadmap */}
        <Link to="/roadmap">
          <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Map className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Roadmap</h3>
                  <p className="text-sm text-gray-500">
                    Track your journey
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* BOTTOM SECTION: Recent Activities & Learning Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">
                      {activity.title}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {activity.time}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-medium ${activity.status === "Completed" ? "text-green-600" : "text-orange-600"}`}
                    >
                      {activity.status}
                    </div>
                    {/* {activity.score && (
                      <div className="text-sm text-gray-600">
                        {activity.score}%
                      </div>
                    )} */}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Learning Progress */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Learning Progress</CardTitle>
          </CardHeader>

          <CardContent>

            <div className="space-y-6">

{/* Challenges Progress */}
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium text-gray-700">
      Challenges Completed
    </span>
    <span className="text-gray-900 font-semibold">
      2/2
    </span>
  </div>
  <Progress value={100} className="h-2" />
</div>

{/* Roadmap Progress */}
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium text-gray-700">
      Roadmap Progress
    </span>
    <span className="text-gray-900 font-semibold">
      1/28
    </span>
  </div>
  <Progress value={(1 / 28) * 100} className="h-2" />
</div>

</div>
            
          </CardContent>
        </Card>
      </div>

     
    </div>
  );
}
