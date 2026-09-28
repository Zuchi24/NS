import { useCallback, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { useAsync } from "@/services/useAsync";
import { activateSection, deactivateSection } from "@/features/admin/adminService";
import {
  createSection,
  deleteSection,
  fetchAcademicYears,
  fetchYearLevels,
  fetchYearSections,
  updateSection,
} from "@/features/academic/academicService";
import type { AcademicYear, ManagedSection, ManagedYearLevel } from "@/features/academic/types";
import { InlineConfirm, messageOf } from "./academic/InlineConfirm";

/**
 * One academic year's sections.
 *
 * A section is one class of one year level in one year, so "Section A" of 1st
 * Year is a different section — a different row — in each year it runs. Its
 * year and year level are never edited: a different class is a different
 * section. One anyone has been placed in is closed rather than deleted, and a
 * closed year's sections are only read.
 */
const selectClass =
  "h-10 rounded-md border border-input bg-white px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";

export function SectionsAdminPage() {
  const [params, setParams] = useSearchParams();
  const { data: years, error, loading, reload } = useAsync(fetchAcademicYears);
  const { data: levels } = useAsync(fetchYearLevels);

  if (loading && !years) return <LoadingState label="Loading academic years…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const all = years ?? [];
  const requested = Number(params.get("year"));
  const year =
    all.find((candidate) => candidate.id === requested) ??
    all.find((candidate) => candidate.isCurrent) ??
    all[0] ??
    null;

  if (!year) {
    return (
      <EmptyState
        title="No academic years yet"
        description="Create an academic year before adding its sections."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="sections-year" className="text-gray-700">
          Academic year
        </Label>
        <select
          id="sections-year"
          aria-label="Academic year"
          className={selectClass}
          value={year.id}
          onChange={(event) => setParams({ year: event.target.value })}
        >
          {all.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.statusLabel})
            </option>
          ))}
        </select>
        {year.status === "closed" && (
          <span className="text-xs text-gray-500">
            A closed year is kept as it was: its sections can be read, not changed.
          </span>
        )}
      </div>

      <YearSections key={year.id} year={year} levels={levels ?? []} />
    </div>
  );
}

function YearSections({ year, levels }: { year: AcademicYear; levels: ManagedYearLevel[] }) {
  const navigate = useNavigate();
  const load = useCallback(() => fetchYearSections(year.id), [year.id]);
  const { data: sections, error, loading, reload } = useAsync(load, [year.id]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ManagedSection | null>(null);
  const [deleting, setDeleting] = useState<ManagedSection | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const open = year.status !== "closed";

  if (loading && !sections) return <LoadingState label="Loading sections…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const act = async (section: ManagedSection, work: () => Promise<unknown>, done: string) => {
    setBusyId(section.id);

    try {
      await work();
      toast.success(done);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(messageOf(e, "Could not do that."));
    } finally {
      setBusyId(null);
    }
  };

  const byLevel = levels
    .map((level) => ({
      level,
      sections: (sections ?? []).filter((section) => section.yearLevel.id === level.id),
    }))
    .filter((group) => group.sections.length > 0);

  return (
    <div className="space-y-6">
      {open && !adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New section in {year.name}
        </Button>
      )}

      {adding && (
        <NewSectionForm
          year={year}
          levels={levels}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}

      {byLevel.length === 0 ? (
        <EmptyState
          title={`${year.name} has no sections yet`}
          description={open ? "Add the first one above." : "It was closed without any."}
        />
      ) : (
        byLevel.map(({ level, sections: inLevel }) => (
          <Card key={level.id} className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">{level.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inLevel.map((section) => (
                <div key={section.id} className="rounded-md border border-gray-100 p-3 space-y-2">
                  {editing?.id === section.id ? (
                    <EditSectionForm
                      section={section}
                      onClose={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        reload();
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {section.name}
                          {!section.isActive && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              Closed to new sign-ups
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {section.enrollmentsCount} placed
                          {section.capacity !== null && ` · ${section.capacity}-seat guideline`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/students/${level.id}/${section.id}`)}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Roster
                        </Button>
                        {open && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === section.id}
                              onClick={() =>
                                act(
                                  section,
                                  () =>
                                    section.isActive
                                      ? deactivateSection(section.id)
                                      : activateSection(section.id),
                                  section.isActive
                                    ? `${section.name} is closed to new sign-ups.`
                                    : `${section.name} is open for sign-ups.`,
                                )
                              }
                            >
                              {section.isActive ? "Close" : "Reopen"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${level.name} ${section.name}`}
                              onClick={() => setEditing(section)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {section.enrollmentsCount === 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete ${level.name} ${section.name}`}
                                onClick={() => setDeleting(section)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {deleting?.id === section.id && (
                    <InlineConfirm
                      question={`Delete ${level.name} ${section.name} from ${year.name}?`}
                      detail="Nobody has been placed in it, so nothing else goes with it."
                      verb="Delete"
                      destructive
                      busy={busyId === section.id}
                      onConfirm={() =>
                        act(section, () => deleteSection(section.id), `${section.name} was deleted.`)
                      }
                      onCancel={() => setDeleting(null)}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function NewSectionForm({
  year,
  levels,
  onClose,
  onSaved,
}: {
  year: AcademicYear;
  levels: ManagedYearLevel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [levelId, setLevelId] = useState(String(levels[0]?.id ?? ""));
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [busy, setBusy] = useState(false);

  const ready = levelId !== "" && name.trim() !== "";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);

    try {
      await createSection({
        academicYearId: year.id,
        yearLevelId: Number(levelId),
        name,
        capacity: capacity === "" ? null : Number(capacity),
      });
      toast.success(`${name} was added to ${year.name}.`);
      onSaved();
    } catch (e) {
      toast.error(messageOf(e, "Could not add the section."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-brand-teal/30">
      <CardContent className="p-4">
        <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="section-level">Year level</Label>
            <select
              id="section-level"
              className={`${selectClass} w-full`}
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="section-name">Name</Label>
            <Input
              id="section-name"
              placeholder="Section A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="section-capacity">Seat guideline</Label>
            <Input
              id="section-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !ready}>
              {busy ? "Adding…" : "Add section"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EditSectionForm({
  section,
  onClose,
  onSaved,
}: {
  section: ManagedSection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [capacity, setCapacity] = useState(section.capacity === null ? "" : String(section.capacity));
  const [busy, setBusy] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") return;

    setBusy(true);

    try {
      await updateSection(section.id, {
        name,
        capacity: capacity === "" ? null : Number(capacity),
      });
      toast.success(`${name} was saved.`);
      onSaved();
    } catch (e) {
      toast.error(messageOf(e, "Could not save the section."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`edit-name-${section.id}`}>Name</Label>
        <Input id={`edit-name-${section.id}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`edit-capacity-${section.id}`}>Seat guideline</Label>
        <Input
          id={`edit-capacity-${section.id}`}
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={busy || name.trim() === ""}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
