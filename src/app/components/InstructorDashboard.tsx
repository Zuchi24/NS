import { useNavigate } from "react-router";
import {
  Users,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Filter,
  Search,
  Eye,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";

export function InstructorDashboard() {
  const navigate = useNavigate();

  const stats = [
    { label: "Total Students", value: "48", icon: Users, color: "text-blue-600", bgColor: "bg-blue-100" },
    { label: "Avg Completion", value: "72%", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
    { label: "Avg Score", value: "84%", icon: Award, color: "text-purple-600", bgColor: "bg-purple-100" },
    { label: "Active Today", value: "23", icon: TrendingUp, color: "text-orange-600", bgColor: "bg-orange-100" },
  ];

  const students = [
    {
      id: 1,
      name: "Alice Johnson",
      studentId: "2023001",
      completed: 15,
      total: 20,
      score: 92,
      lastActive: "2 hours ago",
      status: "excellent",
    },
    {
      id: 2,
      name: "Bob Smith",
      studentId: "2023002",
      completed: 12,
      total: 20,
      score: 85,
      lastActive: "5 hours ago",
      status: "good",
    },
    {
      id: 3,
      name: "Carol Williams",
      studentId: "2023003",
      completed: 18,
      total: 20,
      score: 95,
      lastActive: "1 hour ago",
      status: "excellent",
    },
    {
      id: 4,
      name: "David Brown",
      studentId: "2023004",
      completed: 8,
      total: 20,
      score: 68,
      lastActive: "1 day ago",
      status: "needs-attention",
    },
    {
      id: 5,
      name: "Emma Davis",
      studentId: "2023005",
      completed: 14,
      total: 20,
      score: 88,
      lastActive: "3 hours ago",
      status: "good",
    },
    {
      id: 6,
      name: "Frank Miller",
      studentId: "2023006",
      completed: 6,
      total: 20,
      score: 62,
      lastActive: "2 days ago",
      status: "needs-attention",
    },
  ];

  const recentSubmissions = [
    {
      student: "Alice Johnson",
      activity: "Basic IP Configuration",
      score: 95,
      submittedAt: "10 minutes ago",
      status: "graded",
    },
    {
      student: "Carol Williams",
      activity: "Build Star Topology",
      score: 98,
      submittedAt: "1 hour ago",
      status: "graded",
    },
    {
      student: "Bob Smith",
      activity: "Cable Wiring Challenge",
      score: null,
      submittedAt: "2 hours ago",
      status: "pending",
    },
    {
      student: "Emma Davis",
      activity: "Router Configuration",
      score: 87,
      submittedAt: "3 hours ago",
      status: "graded",
    },
  ];

  const performanceData = [
    { topic: "Cable Wiring", avgScore: 88, completionRate: 95 },
    { topic: "Device Connection", avgScore: 82, completionRate: 87 },
    { topic: "IP Configuration", avgScore: 78, completionRate: 72 },
    { topic: "Router Setup", avgScore: 75, completionRate: 65 },
    { topic: "VLAN Configuration", avgScore: 70, completionRate: 45 },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "excellent":
        return <Badge className="bg-green-100 text-green-700">Excellent</Badge>;
      case "good":
        return <Badge className="bg-blue-100 text-blue-700">Good</Badge>;
      case "needs-attention":
        return <Badge className="bg-orange-100 text-orange-700">Needs Attention</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructor Monitoring</h1>
            <p className="text-gray-600">Track student progress and review submitted activities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" className="h-10">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Student List */}
          <div className="lg:col-span-2">
            <Card className="border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Student Progress</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Search students..." className="pl-9 h-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{student.name}</h3>
                            {getStatusBadge(student.status)}
                          </div>
                          <p className="text-sm text-gray-500">ID: {student.studentId}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{student.score}%</div>
                          <div className="text-xs text-gray-500">Avg Score</div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-semibold text-gray-900">
                            {student.completed}/{student.total} Activities
                          </span>
                        </div>
                        <Progress value={(student.completed / student.total) * 100} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          Last active {student.lastActive}
                        </div>
                        <Button variant="outline" size="sm" className="h-8">
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Submissions */}
          <div>
            <Card className="border-gray-200 mb-6">
              <CardHeader>
                <CardTitle>Recent Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSubmissions.map((submission, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 truncate">
                            {submission.student}
                          </h4>
                          <p className="text-xs text-gray-600 truncate">{submission.activity}</p>
                        </div>
                        {submission.status === "graded" ? (
                          <div className="text-right ml-2">
                            <div className="text-sm font-bold text-green-600">{submission.score}%</div>
                            <div className="text-xs text-gray-500">Graded</div>
                          </div>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 text-xs ml-2">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{submission.submittedAt}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start h-10">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Review Pending Submissions
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-10">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Generate Analytics Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-10">
                    <Download className="w-4 h-4 mr-2" />
                    Export Student Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Performance Analytics */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle>Performance by Topic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {performanceData.map((topic, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{topic.topic}</h4>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-600">
                        Avg Score: <span className="font-bold text-gray-900">{topic.avgScore}%</span>
                      </span>
                      <span className="text-gray-600">
                        Completion: <span className="font-bold text-gray-900">{topic.completionRate}%</span>
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Average Score</div>
                      <Progress value={topic.avgScore} className="h-2" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Completion Rate</div>
                      <Progress value={topic.completionRate} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
