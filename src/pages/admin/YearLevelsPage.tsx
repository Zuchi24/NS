import { useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { useAsync } from "@/services/useAsync";
import {
  createYearLevel,
  deleteYearLevel,
  fetchYearLevels,
  updateYearLevel,
} from "@/features/academic/academicService";
import type { ManagedYearLevel } from "@/features/academic/types";
import { InlineConfirm, messageOf } from "./academic/InlineConfirm";

/**
 * The year levels — the rungs of the programme, shared by every academic year.
 *
 * There is one "1st Year" however many years run; which sections hang off it
 * is each year's. The order is what moving students up follows. The code is
 * the stable handle seeds and code rely on, so it is set once and never
 * edited, and a year level any section uses cannot be deleted.
 */
export function YearLevelsPage() {
  const { data: levels, error, loading, reload } = useAsync(fetchYearLevels);

  const [editing, setEditing] = useState<ManagedYearLevel | "new" | null>(null);
  const [deleting, setDeleting] = useState<ManagedYearLevel | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !levels) return <LoadingState label="Loading year levels…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const remove = async (level: ManagedYearLevel) => {
    setBusy(true);

    try {
      await deleteYearLevel(level.id);
      toast.success(`${level.name} was deleted.`);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(messageOf(e, "Could not delete the year level."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 max-w-2xl">
          Year levels are shared by every academic year. Moving students up takes
          them to the next year level in this order.
        </p>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4 mr-1" />
            New year level
          </Button>
        )}
      </div>

      {editing !== null && (
        <LevelForm
          level={editing === "new" ? null : editing}
          nextOrder={Math.max(0, ...(levels ?? []).map((level) => level.levelOrder)) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {(levels ?? []).length === 0 ? (
        <EmptyState title="No year levels yet" description="Create the first one to begin." />
      ) : (
        <div className="space-y-3">
          {(levels ?? []).map((level) => (
            <Card key={level.id} className="border-gray-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-gray-900">{level.name}</p>
                      <p className="text-xs text-gray-500">
                        Code {level.code} · position {level.levelOrder} · {level.sectionsCount}{" "}
                        section{level.sectionsCount === 1 ? "" : "s"} across all years
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${level.name}`}
                      onClick={() => setEditing(level)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {level.sectionsCount === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${level.name}`}
                        onClick={() => setDeleting(level)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>

                {deleting?.id === level.id && (
                  <InlineConfirm
                    question={`Delete ${level.name}?`}
                    detail="No section in any year uses it, so nothing else goes with it."
                    verb="Delete"
                    destructive
                    busy={busy}
                    onConfirm={() => remove(level)}
                    onCancel={() => setDeleting(null)}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LevelForm({
  level,
  nextOrder,
  onClose,
  onSaved,
}: {
  level: ManagedYearLevel | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(level?.code ?? "");
  const [name, setName] = useState(level?.name ?? "");
  const [order, setOrder] = useState(String(level?.levelOrder ?? nextOrder));
  const [busy, setBusy] = useState(false);

  const ready = name.trim() !== "" && Number(order) >= 1 && (level !== null || code.trim() !== "");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);

    try {
      if (level) {
        await updateYearLevel(level.id, { name, levelOrder: Number(order) });
      } else {
        await createYearLevel({ code, name, levelOrder: Number(order) });
      }

      toast.success(`${name} was saved.`);
      onSaved();
    } catch (e) {
      toast.error(messageOf(e, "Could not save the year level."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-brand-teal/30">
      <CardContent className="p-4">
        <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="level-code">Code</Label>
            <Input
              id="level-code"
              value={code}
              disabled={level !== null}
              placeholder="5TH"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="level-name">Name</Label>
            <Input
              id="level-name"
              value={name}
              placeholder="5th Year"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="level-order">Position</Label>
            <Input
              id="level-order"
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !ready}>
              {busy ? "Saving…" : "Save"}
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
