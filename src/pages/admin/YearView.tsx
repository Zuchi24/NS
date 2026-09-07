import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import {
  activateSection,
  deactivateSection,
  fetchCohorts,
} from "@/features/admin/adminService";
import type { SectionSummary } from "@/features/admin/types";
import { useAsync } from "@/services/useAsync";

export function YearView() {
  const { year } = useParams();
  const navigate = useNavigate();

  const { data: cohorts, error, loading, reload } = useAsync(fetchCohorts);

  /*
   * The section being opened or closed, if any. Held by id so only that card's
   * button goes quiet — closing Section C should not freeze the whole year.
   */
  const [busyId, setBusyId] = useState<number | null>(null);

  const toggle = async (section: SectionSummary) => {
    setBusyId(section.id);

    try {
      if (section.isActive) {
        await deactivateSection(section.id);
        toast.success(`${section.name} is closed to new sign-ups.`);
      } else {
        await activateSection(section.id);
        toast.success(`${section.name} is open for sign-ups.`);
      }

      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not do that.");
    } finally {
      setBusyId(null);
    }
  };

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
            className={`border-gray-200 transition-all ${
              section.isActive
                ? "hover:border-blue-400 hover:shadow-lg"
                : "bg-gray-50"
            }`}
          >
            <CardContent className="p-6 text-center">
              {/* The roster is still the card's job, closed or not: a closed
                  section keeps its students, and they are still someone's to
                  look after. */}
              <button
                type="button"
                onClick={() =>
                  navigate(`/admin/students/${yearLevel.id}/${section.id}`)
                }
                className="w-full cursor-pointer"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    section.isActive ? "bg-blue-100" : "bg-gray-200"
                  }`}
                >
                  <Users
                    className={`w-8 h-8 ${
                      section.isActive ? "text-blue-600" : "text-gray-500"
                    }`}
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {section.name}
                </h3>
                {/* "of 40" read as a cap, and nothing enforces one: a section
                    takes a forty-first student without complaint. The seat
                    count is what the timetable intended, not a limit. */}
                <p className="text-sm text-gray-600">
                  {section.studentsCount} student
                  {section.studentsCount !== 1 ? "s" : ""}
                  {section.capacity !== null &&
                    ` · ${section.capacity}-seat guideline`}
                </p>
              </button>

              {!section.isActive && (
                <p className="mt-2 text-xs font-medium text-gray-500">
                  Closed to new sign-ups
                </p>
              )}

              {/* Reversible either way, so neither move asks to be confirmed. */}
              <Button
                size="sm"
                variant="outline"
                className="mt-4 w-full"
                disabled={busyId === section.id}
                onClick={() => toggle(section)}
              >
                {busyId === section.id
                  ? "Saving…"
                  : section.isActive
                    ? "Close section"
                    : "Reopen section"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
