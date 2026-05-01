import { Link } from "react-router";
import {
  LayoutDashboard,
  Network,
  Target,
  LogOut,
  Search,
  Bell,
  User,
  Monitor,
  Cable,
  Wifi,
  CheckCircle2,
  Clock,
  Wrench,
  Map,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";

export function Dashboard() {
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
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NetSim</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/dashboard"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 text-blue-600 font-medium"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>

          <Link
            to="/challenges"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Target className="w-5 h-5" />
            Challenges
          </Link>

          <Link
            to="/workspace"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Wrench className="w-5 h-5" />
            Workspace
          </Link>

          <Link
            to="/roadmap"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Map className="w-5 h-5" />
            Roadmap
          </Link>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 space-y-1">
          <Link
            to="/profile"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <User className="w-5 h-5" />
            Profile
          </Link>
          <Link
            to="/login"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Search */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search simulations, challenges..."
                  className="pl-10 h-10 bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>
              <Link
                to="/profile"
                className="flex items-center gap-3 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity"
              >
                <div className="text-right">
                  <div className="font-semibold text-gray-900 text-sm">
                    John Doe
                  </div>
                  <div className="text-xs text-gray-500">Student</div>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            {/* Welcome Section */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, John!
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
                          {activity.score && (
                            <div className="text-sm text-gray-600">
                              {activity.score}%
                            </div>
                          )}
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-gray-700">
                            Device Connections
                          </span>
                        </div>
                        <span className="text-gray-900 font-semibold">75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Cable className="w-4 h-4 text-orange-600" />
                          <span className="font-medium text-gray-700">
                            Cable Wiring
                          </span>
                        </div>
                        <span className="text-gray-900 font-semibold">60%</span>
                      </div>
                      <Progress value={60} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-gray-700">
                            IP Configuration
                          </span>
                        </div>
                        <span className="text-gray-900 font-semibold">85%</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Start New Simulation */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      Ready for a new challenge?
                    </h3>
                    <p className="text-gray-600">
                      Start a new simulation and continue your learning journey
                    </p>
                  </div>
                  <Link to="/simulations">
                    <Button className="bg-blue-600 hover:bg-blue-700 h-12 px-8">
                      Start Simulation
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
