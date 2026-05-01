import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { User } from "lucide-react";

export function Dashboard() {
  const stats = [
    {
      title: "Total Students",
      value: "156",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      change: "+12%",
    },
    {
      title: "Active Challenges",
      value: "6",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      change: "100%",
    },
    {
      title: "Avg Completion",
      value: "73%",
      color: "text-green-600",
      bgColor: "bg-green-100",
      change: "+5%",
    },
    {
      title: "Total Topics",
      value: "16",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      change: "100%",
    },
  ];

  const studentProgress = [
    { name: "John Doe", id: "2021-001", completed: 12, total: 16, score: 88, status: "Active" },
    { name: "Jane Smith", id: "2021-002", completed: 16, total: 16, score: 95, status: "Completed" },
    { name: "Mike Johnson", id: "2021-003", completed: 8, total: 16, score: 75, status: "Active" },
    { name: "Sarah Williams", id: "2021-004", completed: 14, total: 16, score: 91, status: "Active" },
    { name: "David Brown", id: "2021-005", completed: 10, total: 16, score: 82, status: "Active" },
  ];

  const challengeStats = [
    { title: "Assemble System Unit", completed: 124, total: 156, avgScore: 86 },
    { title: "Cable Wiring", completed: 142, total: 156, avgScore: 88 },
    { title: "IP Configuration", completed: 98, total: 156, avgScore: 75 },
    { title: "Star Topology", completed: 67, total: 156, avgScore: 71 },
    { title: "Router Configuration", completed: 23, total: 156, avgScore: 68 },
    { title: "VLAN Configuration", completed: 12, total: 156, avgScore: 65 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-gray-600">Monitor student progress and platform analytics</p>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-green-600 font-medium">{stat.change}</p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                  <div className={`w-6 h-6 ${stat.color}`}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Student Progress Table */}
        <Card className="border-gray-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Student Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Progress</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Avg Score</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentProgress.map((student, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{student.id}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>
                              {student.completed}/{student.total} topics
                            </span>
                            <span>{Math.round((student.completed / student.total) * 100)}%</span>
                          </div>
                          <Progress
                            value={(student.completed / student.total) * 100}
                            className="h-2"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900">{student.score}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            student.status === "Completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Challenge Statistics */}
        <Card className="border-gray-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Challenge Completion Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {challengeStats.map((challenge, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{challenge.title}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600">
                        {challenge.completed}/{challenge.total}
                      </span>
                      <span className="font-semibold text-blue-600 w-12 text-right">
                        {challenge.avgScore}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={(challenge.completed / challenge.total) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
