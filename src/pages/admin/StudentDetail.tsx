import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Mail,
  Map,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { fetchStudent } from "@/features/admin/adminService";
import { standingClass, topicStatus } from "@/features/admin/format";
import { shortDate, timeAgo } from "@/services/time";
import { useAsync } from "@/services/useAsync";

export function StudentDetail() {
  const { year, sectionId, studentId } = useParams();
  const navigate = useNavigate();

  const load = useCallback(() => fetchStudent(Number(studentId)), [studentId]);
  const { data, error, loading, reload } = useAsync(load, [studentId]);

  if (loading) return <LoadingState label="Loading student…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { student, topics, challenges } = data;
  const { summary } = student;

  const challengesPassed = challenges.filter(
    (challenge) => challenge.passed,
  ).length;
  const topicsCompleted = topics.filter(
    (topic) => topic.status === "completed",
  ).length;

  const percent = (count: number, of: number) =>
    of > 0 ? Math.round((count / of) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/students/${year}/${sectionId}`)}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-gray-500">
          {student.section
            ? `${student.section.yearLevel} / ${student.section.name} / `
            : ""}
          {student.fullName}
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
              <p className="text-gray-900 font-medium">{student.fullName}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Student ID
              </label>
              <p className="text-gray-900 font-medium">
                {student.studentId ?? "Not set"}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Year &amp; Section
              </label>
              <p className="text-gray-900 font-medium">
                {student.section
                  ? `${student.section.yearLevel} - ${student.section.name}`
                  : "Not placed in a section"}
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
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Last active
              </label>
              <div className="flex items-center gap-2 text-gray-900">
                <Clock className="w-4 h-4 text-gray-400" />
                <p>{timeAgo(summary.lastActiveAt)}</p>
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
                  Challenges passed
                </label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Passed</span>
                    <span className="text-sm font-bold text-green-700">
                      {challengesPassed}/{challenges.length}
                    </span>
                  </div>
                  <Progress
                    value={percent(challengesPassed, challenges.length)}
                    className="h-2"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-600">
                  Topics completed
                </label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Completed</span>
                    <span className="text-sm font-bold text-blue-600">
                      {topicsCompleted}/{topics.length}
                    </span>
                  </div>
                  <Progress
                    value={percent(topicsCompleted, topics.length)}
                    className="h-2"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Standing
                </label>
                <div
                  className={`mt-1 inline-block px-3 py-1 rounded-full text-sm font-medium ${standingClass(
                    summary.standing,
                  )}`}
                >
                  {summary.standingLabel}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Submissions
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {summary.submissions} submitted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Learning Progress Details</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Every challenge and topic in the catalogue, and where{" "}
            {student.firstName} stands on each.
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
                  {challengesPassed}/{challenges.length} passed
                </span>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      {challenge.passed ? (
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
                              challenge.passed
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {challenge.passed
                              ? `Passed ${shortDate(challenge.passedAt)}`
                              : "Not passed"}
                          </span>
                        </div>
                        {challenge.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {challenge.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">
                          {challenge.attempts === 0
                            ? "Never opened"
                            : `${challenge.attempts} attempt${
                                challenge.attempts === 1 ? "" : "s"
                              }, ${challenge.submissions} submitted · last ${timeAgo(
                                challenge.lastAttemptAt,
                              ).toLowerCase()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Roadmap</h3>
                </div>
                <span className="text-sm font-bold text-blue-700">
                  {topicsCompleted}/{topics.length} completed
                </span>
              </div>
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-2">
                {topics.map((topic) => {
                  const status = topicStatus(topic.status);
                  const done = topic.status === "completed";

                  return (
                    <div
                      key={topic.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-start gap-3">
                        {done ? (
                          <CheckCircle2 className="mt-0.5 w-5 h-5 flex-shrink-0 text-blue-600" />
                        ) : (
                          <Circle className="mt-0.5 w-5 h-5 flex-shrink-0 text-gray-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {topic.title}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress
                              value={topic.progressPercent}
                              className="h-1.5 w-24"
                            />
                            <span className="text-xs text-gray-500">
                              {topic.progressPercent}%
                            </span>
                            {topic.roadmap && (
                              <span className="text-xs text-gray-400 truncate">
                                · {topic.roadmap}
                              </span>
                            )}
                          </div>
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
