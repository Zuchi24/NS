import { useNavigate } from "react-router";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { fetchCohorts } from "@/features/admin/adminService";
import { useAsync } from "@/services/useAsync";

export function StudentsOverview() {
  const navigate = useNavigate();
  const { data: cohorts, error, loading, reload } = useAsync(fetchCohorts);

  if (loading) return <LoadingState label="Loading year levels…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">Select a year level to view students</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(cohorts ?? []).map((year) => (
          <Card
            key={year.id}
            onClick={() => navigate(`/admin/students/${year.id}`)}
            className="border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {year.name}
              </h3>
              <p className="text-sm text-gray-600">
                {year.studentsCount} student
                {year.studentsCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {year.sections.length} section
                {year.sections.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
