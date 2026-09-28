import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { useAsync } from "@/services/useAsync";
import {
  activateAcademicYear,
  createAcademicYear,
  deleteAcademicYear,
  fetchAcademicYears,
  updateAcademicYear,
} from "@/features/academic/academicService";
import type { AcademicYear, AcademicYearDraft, AcademicYearStatus } from "@/features/academic/types";
import { InlineConfirm, messageOf } from "./academic/InlineConfirm";

/**
 * The school's academic years.
 *
 * A year is created planned. It becomes current only by being activated, which
 * closes the year that was current — so the school is always in exactly one
 * year, and leaves it only by entering the next. A closed year is kept as it
 * was, and only a planned year nothing uses yet can be deleted. The page never
 * offers what the server would refuse.
 */

const STATUS_STYLES: Record<AcademicYearStatus, string> = {
  planned: "bg-amber-50 text-amber-700 border-amber-200",
  current: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const EMPTY_DRAFT: AcademicYearDraft = { name: "", startsAt: "", endsAt: "" };

type Pending = { action: "activate" | "delete"; year: AcademicYear };

export function AcademicYearsPage() {
  const navigate = useNavigate();
  const { data: years, error, loading, reload } = useAsync(fetchAcademicYears);

  const [editing, setEditing] = useState<AcademicYear | "new" | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !years) return <LoadingState label="Loading academic years…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const current = (years ?? []).find((year) => year.isCurrent) ?? null;

  const run = async ({ action, year }: Pending) => {
    setBusy(true);

    try {
      if (action === "activate") {
        await activateAcademicYear(year.id);
        toast.success(`${year.name} is now the current academic year.`);
      } else {
        await deleteAcademicYear(year.id);
        toast.success(`${year.name} was deleted.`);
      }

      setPending(null);
      reload();
    } catch (e) {
      toast.error(messageOf(e, "Could not do that."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 max-w-2xl">
          Every placement belongs to an academic year. Plan the next year, set up its
          sections and move students into it, then make it current — the year
          before closes and is kept exactly as it was.
        </p>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4 mr-1" />
            New academic year
          </Button>
        )}
      </div>

      {editing !== null && (
        <YearForm
          year={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {(years ?? []).length === 0 ? (
        <EmptyState title="No academic years yet" description="Create the first one to begin." />
      ) : (
        <div className="space-y-3">
          {(years ?? []).map((year) => {
            const deletable =
              year.status === "planned" && year.sectionsCount === 0 && year.enrollmentsCount === 0;

            return (
              <Card key={year.id} className="border-gray-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CalendarRange className="w-5 h-5 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-gray-900">{year.name}</p>
                        <p className="text-xs text-gray-500">
                          {year.startsAt} to {year.endsAt} · {year.sectionsCount} section
                          {year.sectionsCount === 1 ? "" : "s"} · {year.enrollmentsCount} placed
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[year.status]}`}
                      >
                        {year.statusLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/academic/sections?year=${year.id}`)}
                      >
                        Sections
                      </Button>
                      {year.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/academic/years/${year.id}/promotion`)}
                        >
                          Move students in
                        </Button>
                      )}
                      {year.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${year.name}`}
                          onClick={() => setEditing(year)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {year.status === "planned" && (
                        <Button
                          size="sm"
                          onClick={() => setPending({ action: "activate", year })}
                        >
                          Make current
                        </Button>
                      )}
                      {deletable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${year.name}`}
                          onClick={() => setPending({ action: "delete", year })}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {pending?.year.id === year.id && (
                    <InlineConfirm
                      question={
                        pending.action === "activate"
                          ? `Make ${year.name} the current year?`
                          : `Delete ${year.name}?`
                      }
                      detail={
                        pending.action === "activate"
                          ? `${current ? `${current.name} closes and can no longer be changed. ` : ""}Every student's current section becomes their ${year.name} placement, and students not placed in ${year.name} will show as not placed. Their work, progress and achievements are not touched.`
                          : "It has no sections and nobody is placed in it, so nothing else goes with it."
                      }
                      verb={pending.action === "activate" ? "Make current" : "Delete"}
                      destructive={pending.action === "delete"}
                      busy={busy}
                      onConfirm={() => run(pending)}
                      onCancel={() => setPending(null)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YearForm({
  year,
  onClose,
  onSaved,
}: {
  year: AcademicYear | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<AcademicYearDraft>(
    year ? { name: year.name, startsAt: year.startsAt, endsAt: year.endsAt } : EMPTY_DRAFT,
  );
  const [busy, setBusy] = useState(false);

  const ready = draft.name.trim() !== "" && draft.startsAt !== "" && draft.endsAt !== "";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);

    try {
      if (year) {
        await updateAcademicYear(year.id, draft);
        toast.success(`${draft.name} was saved.`);
      } else {
        await createAcademicYear(draft);
        toast.success(`${draft.name} was created as a planned year.`);
      }

      onSaved();
    } catch (e) {
      toast.error(messageOf(e, "Could not save the academic year."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-brand-teal/30">
      <CardHeader>
        <CardTitle className="text-base">
          {year ? `Edit ${year.name}` : "New academic year"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="year-name">Name</Label>
            <Input
              id="year-name"
              placeholder="2027–2028"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="year-starts">Starts</Label>
            <Input
              id="year-starts"
              type="date"
              value={draft.startsAt}
              onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="year-ends">Ends</Label>
            <Input
              id="year-ends"
              type="date"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !ready}>
              {busy ? "Saving…" : year ? "Save" : "Create planned year"}
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
