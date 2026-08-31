import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchCohorts } from "@/features/admin/adminService";
import { useAsync } from "@/services/useAsync";

export function YearView() {
  const { year } = useParams();
  const navigate = useNavigate();

  const { data: cohorts, error, loading, reload } = useAsync(fetchCohorts);

  if (loading) return <LoadingState label="Loading sections…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const yearLevel = (cohorts ?? []).find((level) => String(level.id) === year);

  if (!yearLevel) {
    return (
      <EmptyState
        title="Year level not found"
        description="It may have been removed. Pick one from the students overview."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/students")}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-sm text-gray-500">{yearLevel.name}</p>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {yearLevel.sections.map((section) => (
          <Card
            key={section.id}
            onClick={() =>
              navigate(`/admin/students/${yearLevel.id}/${section.id}`)
            }
            className="border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {section.name}
              </h3>
              <p className="text-sm text-gray-600">
                {section.studentsCount} student
                {section.studentsCount !== 1 ? "s" : ""}
                {section.capacity !== null && ` of ${section.capacity}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
