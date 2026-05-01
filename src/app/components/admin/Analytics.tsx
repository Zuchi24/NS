import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { BarChart3, TrendingUp, TrendingDown, Activity, Users } from 'lucide-react';

export function Analytics() {
  const topicEngagement = [
    {
      topic: 'Computer Hardware Components',
      views: 156,
      completed: 145,
      avgTime: '42 min',
      avgScore: 86,
    },
    {
      topic: 'Network Communication Technologies',
      views: 152,
      completed: 128,
      avgTime: '38 min',
      avgScore: 82,
    },
    {
      topic: 'Basics of Computer Networking',
      views: 148,
      completed: 135,
      avgTime: '35 min',
      avgScore: 88,
    },
    {
      topic: 'Network Models & Architecture',
      views: 98,
      completed: 76,
      avgTime: '45 min',
      avgScore: 79,
    },
    { topic: 'Network Devices (Basic)', views: 134, completed: 112, avgTime: '32 min', avgScore: 84 },
  ];

  const challengePerformance = [
    { name: 'Assemble System Unit', attempts: 178, completed: 124, avgScore: 86, passRate: 70 },
    { name: 'Cable Wiring', attempts: 165, completed: 142, avgScore: 88, passRate: 86 },
    { name: 'IP Configuration', attempts: 132, completed: 98, avgScore: 75, passRate: 74 },
    { name: 'Star Topology', attempts: 95, completed: 67, avgScore: 71, passRate: 71 },
    { name: 'Router Configuration', attempts: 45, completed: 23, avgScore: 68, passRate: 51 },
    { name: 'VLAN Configuration', attempts: 28, completed: 12, avgScore: 65, passRate: 43 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">Track performance metrics and platform usage</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Avg Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">73%</p>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>+5.2%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Avg Score</p>
                <p className="text-3xl font-bold text-gray-900">82%</p>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>+3.1%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-gray-900">142</p>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>+12%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Avg Time/Topic</p>
                <p className="text-3xl font-bold text-gray-900">38m</p>
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <TrendingDown className="w-4 h-4" />
                  <span>-2m</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic Engagement */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Topic Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Topic</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Views</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Completed
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Avg Time
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Avg Score
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Completion Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {topicEngagement.map((topic, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">{topic.topic}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{topic.views}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{topic.completed}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{topic.avgTime}</td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-gray-900">{topic.avgScore}%</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Progress value={(topic.completed / topic.views) * 100} className="h-2 w-24" />
                        <span className="text-sm text-gray-600">
                          {Math.round((topic.completed / topic.views) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Challenge Performance */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Challenge Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {challengePerformance.map((challenge, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{challenge.name}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          {challenge.completed}/{challenge.attempts} attempts
                        </span>
                        <span className="font-semibold text-blue-600">{challenge.avgScore}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={challenge.passRate} className="h-2 flex-1" />
                      <span className="text-sm text-gray-600 w-12">{challenge.passRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
