import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Mail,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import {
  fetchCohorts,
  fetchStudent,
  moveStudentToSection,
} from "@/features/admin/adminService";
import { standingClass } from "@/features/admin/format";
import type { SectionSummary, Student } from "@/features/admin/types";
import { shortDate, timeAgo } from "@/services/time";
import { useAsync } from "@/services/useAsync";

/**
 * Moving a student into another section.
 *
 * The only thing on this page that writes anything. It exists because a student
 * chooses their own section when they sign up and can choose wrong, and every
 * instructor figure is grouped by section — so one wrong choice otherwise skews
 * two rosters for as long as the account lives.
 *
 * Only open sections are offered, which is the same rule the server enforces.
 * The list is fetched when the form opens rather than with the page: most
 * visits to a student are to read their progress, and the timetable is not part
 * of that.
 */
function MoveSection({
  student,
  onMoved,
}: {
  student: Student;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const loadSections = useCallback(
    () => (open ? fetchCohorts() : Promise.resolve(null)),
    [open],
  );
  const { data: cohorts, error, loading } = useAsync(loadSections, [open]);

  /*
   * Every open section across every year level. A student can be moved between
   * years as well as within one — a repeating student is the ordinary case —
   * so the list is not narrowed to the year they are in now.
   */
  const sections: { yearLevel: string; section: SectionSummary }[] = (
    cohorts ?? []
  ).flatMap((year) =>
    year.sections
      .filter((section) => section.isActive)
      .map((section) => ({ yearLevel: year.name, section })),
  );

  const save = async () => {
    if (!choice) return;

    setBusy(true);

    try {
      await moveStudentToSection(student.id, Number(choice));
      toast.success(`Moved ${student.fullName}.`);
      setOpen(false);
      setChoice("");
      onMoved();
    } catch (e) {
      // The server refuses a closed or missing section with a 422 whose message
      // says so; that is the one worth showing.
      toast.error(e instanceof Error ? e.message : "Could not move them.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => setOpen(true)}
      >
        Move to another section
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {loading && <p className="text-xs text-gray-500">Loading sections…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {cohorts && (
        <select
          aria-label="Section"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Choose a section…</option>
          {sections.map(({ yearLevel, section }) => (
            <option key={section.id} value={section.id}>
              {yearLevel} - {section.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !choice} onClick={save}>
          {busy ? "Moving…" : "Move"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setChoice("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function StudentDetail() {
  const { year, sectionId, studentId } = useParams();
  const navigate = useNavigate();

  const load = useCallback(() => fetchStudent(Number(studentId)), [studentId]);
  const { data, error, loading, reload } = useAsync(load, [studentId]);

  if (loading) return <LoadingState label="Loading student…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { student, challenges } = data;
  const { summary } = student;

  const challengesPassed = challenges.filter(
    (challenge) => challenge.passed,
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
              <MoveSection student={student} onMoved={reload} />
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
            <div className="grid grid-cols-1 gap-4">
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
          <div className="grid gap-6">
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

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
