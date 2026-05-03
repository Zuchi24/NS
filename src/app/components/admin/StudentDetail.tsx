import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { User, Mail, TrendingUp, ArrowLeft, Clock } from "lucide-react";
import { MOCK_STUDENTS, MOCK_ACTIVITIES } from "../../data/mock";

const ROADMAP_TOTAL = 28;
const CHALLENGE_TOTAL = 2;

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
  const completedRoadmapItems = Math.round(
    (student?.completionRate ?? 0) / 100 * ROADMAP_TOTAL,
  );
  const roadmapCompletionRate = Math.round(
    (completedRoadmapItems / ROADMAP_TOTAL) * 100,
  );
  const completedChallenges = Math.min(
    student?.completedActivities ?? 0,
    CHALLENGE_TOTAL,
  );
  const challengeCompletionRate = Math.round(
    (completedChallenges / CHALLENGE_TOTAL) * 100,
  );

  if (!student) {
    return (
      <div className="space-y-6">
        <p className="text-gray-500">Student not found</p>
      </div>
    );
  }

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
        {/* Student Information Card */}
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

        {/* Progress Summary Card */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Progress Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT SIDE: Challenge Progress */}
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

              {/* RIGHT SIDE: Roadmap Progress */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-600">
                  Roadmap Progress
                </label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      Completed
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {completedRoadmapItems}/{ROADMAP_TOTAL}
                    </span>
                  </div>
                  <Progress value={roadmapCompletionRate} className="h-2" />
                </div>
              </div>
            </div>

            {/* Status - Full Width Below */}
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

      {/* Activity Progress Table */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Activity Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Activity Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Score
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Time Spent
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ACTIVITIES.map((activity) => (
                  <tr
                    key={activity.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4 font-medium text-gray-900">
                      {activity.name}
                    </td>
                    <td className="py-4 px-4">
                      {activity.score > 0 ? (
                        <span className="font-semibold text-gray-900">
                          {activity.score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {activity.timeSpent}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          activity.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : activity.status === "In Progress"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {activity.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={activity.progress}
                          className="h-2 w-24"
                        />
                        <span className="text-sm text-gray-600">
                          {activity.progress}%
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
    </div>
  );
}
