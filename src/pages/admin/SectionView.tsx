import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchSectionStudents } from "@/features/admin/adminService";
import { standingClass } from "@/features/admin/format";
import { timeAgo } from "@/services/time";
import { useAsync } from "@/services/useAsync";

export function SectionView() {
  const { year, sectionId } = useParams();
  const navigate = useNavigate();

  const load = useCallback(
    () => fetchSectionStudents(Number(sectionId)),
    [sectionId],
  );
  const { data: students, error, loading, reload } = useAsync(load, [sectionId]);

  const sectionName = students?.[0]?.section?.name ?? "Section";
  const yearName = students?.[0]?.section?.yearLevel ?? "";

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/students/${year}`)}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        {students && students.length > 0 && (
          <p className="text-sm text-gray-500">
            {yearName} / {sectionName}
          </p>
        )}
      </div>

      {loading && <LoadingState label="Loading roster…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {students && students.length === 0 && (
        <EmptyState
          title="No students in this section"
          description="Students appear here once they sign up and are placed in this section."
        />
      )}

      {students && students.length > 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Student ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Challenges passed
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Topics done
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Last active
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Standing
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {student.fullName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {student.studentId ?? "—"}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={student.summary.completionPercent}
                            className="h-2 w-20"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {student.summary.challengesPassed}/
                            {student.summary.challengesTotal}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {student.summary.topicsCompleted}/
                        {student.summary.topicsTotal}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {timeAgo(student.summary.lastActiveAt)}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${standingClass(
                            student.summary.standing,
                          )}`}
                        >
                          {student.summary.standingLabel}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/admin/students/${year}/${sectionId}/${student.id}`,
                            )
                          }
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
