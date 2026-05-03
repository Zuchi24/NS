import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  User,
  Mail,
  TrendingUp,
  ArrowLeft,
  Trophy,
  Map,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { MOCK_STUDENTS } from "../../data/mock";

const ROADMAP_TOTAL = 28;
const CHALLENGE_TOTAL = 2;

const CHALLENGE_ITEMS = [
  {
    id: 1,
    title: "Assemble System Unit",
    description:
      "Learn computer hardware by assembling a complete system unit with all essential components",
    difficulty: "Beginner",
  },
  {
    id: 2,
    title: "Correct Cable Wiring",
    description:
      "Identify and select the correct cable wiring pattern for different network scenarios",
    difficulty: "Beginner",
  },
];

const ROADMAP_ITEMS = [
  { id: 1, title: "Introduction to Networking", category: "Start / Fundamentals" },
  { id: 2, title: "Types of Networks", category: "Start / Fundamentals" },
  { id: 3, title: "Network Topologies", category: "Start / Fundamentals" },
  { id: 4, title: "OSI Model", category: "Start / Fundamentals" },
  { id: 5, title: "TCP/IP Model", category: "Start / Fundamentals" },
  { id: 6, title: "IP Addressing", category: "Basic Networking Concepts" },
  { id: 7, title: "Subnetting", category: "Basic Networking Concepts" },
  { id: 8, title: "MAC Address", category: "Basic Networking Concepts" },
  { id: 9, title: "DNS", category: "Basic Networking Concepts" },
  { id: 10, title: "DHCP", category: "Basic Networking Concepts" },
  { id: 11, title: "Router", category: "Network Devices" },
  { id: 12, title: "Switch", category: "Network Devices" },
  { id: 13, title: "Hub & Access Point", category: "Network Devices" },
  { id: 14, title: "Firewall", category: "Network Devices" },
  { id: 15, title: "Straight-through Cable", category: "Cabling and Connections" },
  { id: 16, title: "Crossover Cable", category: "Cabling and Connections" },
  { id: 17, title: "Fiber Optics", category: "Cabling and Connections" },
  { id: 18, title: "Assigning IP Address", category: "Network Configuration" },
  { id: 19, title: "Connecting Devices", category: "Network Configuration" },
  { id: 20, title: "Basic Troubleshooting", category: "Network Configuration" },
  { id: 21, title: "HTTP / HTTPS", category: "Protocols" },
  { id: 22, title: "FTP", category: "Protocols" },
  { id: 23, title: "TCP vs UDP", category: "Protocols" },
  { id: 24, title: "ICMP", category: "Protocols" },
  { id: 25, title: "VLAN", category: "Intermediate Topics" },
  { id: 26, title: "Routing Basics", category: "Intermediate Topics" },
  { id: 27, title: "NAT", category: "Intermediate Topics" },
  { id: 28, title: "Network Security Basics", category: "Intermediate Topics" },
];

export function StudentDetail() {
  const { year, sectionId, studentId } = useParams();
  const navigate = useNavigate();

  if (!year || !sectionId || !studentId) {
    navigate("/admin/students");
    return null;
  }

  const key = `${year}-${sectionId}`;
  const students = MOCK_STUDENTS[key] || [];
  const student = students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div className="space-y-6">
        <p className="text-gray-500">Student not found</p>
      </div>
    );
  }

  const completedRoadmapItems = Math.min(
    student.completedRoadmapItems,
    ROADMAP_TOTAL,
  );
  const roadmapCompletionRate = Math.round(
    (completedRoadmapItems / ROADMAP_TOTAL) * 100,
  );
  const completedChallenges = Math.min(
    student.completedActivities,
    CHALLENGE_TOTAL,
  );
  const challengeCompletionRate = Math.round(
    (completedChallenges / CHALLENGE_TOTAL) * 100,
  );

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(
              `/admin/students/${encodeURIComponent(year)}/${encodeURIComponent(sectionId)}`,
            )
          }
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-gray-500">
          {year} / {sectionId} / {student.name}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Full Name
              </label>
              <p className="text-gray-900 font-medium">{student.name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Student ID
              </label>
              <p className="text-gray-900 font-medium">{student.studentId}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Year & Section
              </label>
              <p className="text-gray-900 font-medium">
                {year} - {sectionId}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Email
              </label>
              <div className="flex items-center gap-2 text-gray-900">
                <Mail className="w-4 h-4 text-gray-400" />
                <p>{student.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Progress Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-600">
                  Challenge Progress
                </label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Completed</span>
                    <span className="text-sm font-bold text-green-700">
                      {completedChallenges}/{CHALLENGE_TOTAL}
                    </span>
                  </div>
                  <Progress value={challengeCompletionRate} className="h-2" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-600">
                  Roadmap Progress
                </label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Completed</span>
                    <span className="text-sm font-bold text-blue-600">
                      {completedRoadmapItems}/{ROADMAP_TOTAL}
                    </span>
                  </div>
                  <Progress value={roadmapCompletionRate} className="h-2" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">
                Status
              </label>
              <div
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  student.status === "Passed"
                    ? "bg-green-100 text-green-700"
                    : student.status === "Needs Improvement"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {student.status}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Learning Progress Details</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Completed and remaining challenge and roadmap items for {student.name}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Challenges</h3>
                </div>
                <span className="text-sm font-bold text-green-700">
                  {completedChallenges}/{CHALLENGE_TOTAL} completed
                </span>
              </div>
              <div className="space-y-3">
                {CHALLENGE_ITEMS.map((challenge, index) => {
                  const isCompleted = index < completedChallenges;

                  return (
                    <div
                      key={challenge.id}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-start gap-3">
                        {isCompleted ? (
                          <CheckCircle2 className="mt-0.5 w-5 h-5 flex-shrink-0 text-green-600" />
                        ) : (
                          <Circle className="mt-0.5 w-5 h-5 flex-shrink-0 text-gray-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {challenge.title}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isCompleted
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isCompleted ? "Completed" : "Not Completed"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {challenge.description}
                          </p>
                          <p className="mt-2 text-xs font-medium text-gray-500">
                            {challenge.difficulty}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Roadmap</h3>
                </div>
                <span className="text-sm font-bold text-blue-700">
                  {completedRoadmapItems}/{ROADMAP_TOTAL} completed
                </span>
              </div>
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-2">
                {ROADMAP_ITEMS.map((item, index) => {
                  const isCompleted = index < completedRoadmapItems;

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-start gap-3">
                        {isCompleted ? (
                          <CheckCircle2 className="mt-0.5 w-5 h-5 flex-shrink-0 text-blue-600" />
                        ) : (
                          <Circle className="mt-0.5 w-5 h-5 flex-shrink-0 text-gray-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {item.id}. {item.title}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isCompleted
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isCompleted ? "Completed" : "Not Completed"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            {item.category}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
