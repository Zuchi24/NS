import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

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
      title: "Total Topics",
      value: "16",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      change: "100%",
    },
  ];

  const challengeStats = [
    { title: "Assemble System Unit", completed: 124, total: 156, avgScore: 86 },
    { title: "Cable Wiring", completed: 142, total: 156, avgScore: 88 },
    { title: "IP Configuration", completed: 98, total: 156, avgScore: 75 },
    { title: "Star Topology", completed: 67, total: 156, avgScore: 71 },
    { title: "Router Configuration", completed: 23, total: 156, avgScore: 68 },
    { title: "VLAN Configuration", completed: 12, total: 156, avgScore: 65 },
  ];

  // Calculate overall roadmap progress
  const totalCompleted = challengeStats.reduce(
    (sum, c) => sum + c.completed,
    0,
  );
  const totalTasks = challengeStats.reduce((sum, c) => sum + c.total, 0);
  const overallProgress = Math.round((totalCompleted / totalTasks) * 100);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-gray-600">
          Monitor student progress and platform analytics
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
                  <p className="text-sm text-green-600 font-medium">
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

      {/* Two Column Layout: Challenges and Roadmap Progress */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT SIDE: Challenges */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Challenges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {challengeStats.map((challenge, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {challenge.title}
                    </span>
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

        {/* RIGHT SIDE: Roadmap Progress */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Roadmap Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Overall Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    Overall Progress
                  </span>
                  <span className="font-semibold text-blue-600">
                    {overallProgress}%
                  </span>
                </div>
                <Progress value={overallProgress} className="h-3" />
              </div>

              {/* Individual Challenge Progress */}
              <div className="space-y-4">
                {challengeStats.map((challenge, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">
                        {challenge.title}
                      </span>
                      <span className="text-gray-600">
                        {Math.round(
                          (challenge.completed / challenge.total) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <Progress
                      value={(challenge.completed / challenge.total) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
