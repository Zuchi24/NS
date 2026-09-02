import { useState } from "react";
import { Eye, EyeOff, Map, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api";
import {
  EMPTY_ROADMAP_DRAFT,
  createRoadmap,
  deleteRoadmap,
  draftOfRoadmap,
  publishRoadmap,
  unpublishRoadmap,
  updateRoadmap,
  validateRoadmapDraft,
} from "@/features/content/roadmapService";
import type { RoadmapDraft } from "@/features/content/roadmapService";
import type { Roadmap } from "@/features/content/types";

/**
 * Authoring the roadmaps themselves — the layer above topics and materials.
 *
 * Picking one is the same control that manages it: the roadmap in the picker is
 * the roadmap the buttons act on, and it is also the one whose topics the panel
 * below is authoring. That is why this is one card rather than a separate list
 * screen — an author who has just renamed a roadmap is already looking at the
 * topics they renamed it for.
 *
 * Publishing and deleting are deliberately different actions rather than two
 * spellings of "remove". Unpublishing takes a roadmap back from students and
 * keeps every attempt, every topic's progress and every earned achievement;
 * deleting takes the rows themselves, and the server refuses it outright once
 * any of that history exists. The wording here says so, and the 409 the API
 * answers with is shown as it was written rather than flattened into "failed".
 */

/** Says a roadmap is not out yet. Matches the mark the materials panel uses. */
export function DraftBadge() {
  return (
    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      Draft
    </span>
  );
}

/** Says a roadmap is out. Only shown beside the one being authored. */
function PublishedBadge() {
  return (
    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
      Published
    </span>
  );
}

/** Which roadmap the form is editing, or that it is adding a new one. */
type Editing = { mode: "new" } | { mode: "edit"; roadmap: Roadmap };

export function RoadmapPanel({
  roadmaps,
  roadmap,
  onSelect,
  onChanged,
}: {
  /** The whole catalogue, in order. Owned by the page, not by this panel. */
  roadmaps: Roadmap[];
  /** The one being authored, or null when the catalogue is empty. */
  roadmap: Roadmap | null;
  onSelect: (roadmapId: number) => void;
  /**
   * Reloads the catalogue after a write, and says which roadmap should be
   * showing once it lands — the new one after a create, nothing after a delete.
   */
  onChanged: (selected: number | null) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const setRelease = async (publish: boolean) => {
    if (!roadmap) return;

    setBusy(true);

    try {
      if (publish) {
        await publishRoadmap(roadmap.id);
        toast.success(`“${roadmap.title}” is now visible to students.`);
      } else {
        await unpublishRoadmap(roadmap.id);
        toast.success(`“${roadmap.title}” is hidden from students.`);
      }

      onChanged(roadmap.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change this.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!roadmap) return;

    setBusy(true);

    try {
      await deleteRoadmap(roadmap.id);
      toast.success(`Removed “${roadmap.title}”.`);
      onChanged(null);
    } catch (e) {
      // The server refuses this with 409 and an explanation — that a roadmap
      // students have worked through is unpublished rather than destroyed. Its
      // wording is better than anything this panel could guess at, so it is
      // shown as written.
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-600" aria-hidden="true" />
          Roadmap
          {roadmap &&
            (roadmap.isPublished ? <PublishedBadge /> : <DraftBadge />)}
        </CardTitle>

        <Button
          size="sm"
          onClick={() => setEditing({ mode: "new" })}
          disabled={editing !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          New roadmap
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {roadmap === null ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No roadmaps yet. Add the first one, then give it topics.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="roadmap-picker">Authoring</Label>
              <select
                id="roadmap-picker"
                value={roadmap.id}
                onChange={(event) => onSelect(Number(event.target.value))}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {roadmaps.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {/* Marked in the option text as well as beside the title: a
                        native select shows only the chosen row when closed, so
                        a badge alone would not say which of the others are
                        still drafts. */}
                    {entry.isPublished ? entry.title : `${entry.title} (draft)`}
                  </option>
                ))}
              </select>
            </div>

            {roadmap.description ? (
              <p className="text-xs text-gray-600">{roadmap.description}</p>
            ) : (
              <p className="text-xs text-gray-500 italic">
                This roadmap has no description.
              </p>
            )}

            {!roadmap.isPublished && (
              <p className="text-xs text-amber-700">
                This roadmap is unpublished. Students cannot see it, or anything
                in it, until it is published — but you can author it now.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || editing !== null}
                onClick={() => setEditing({ mode: "edit", roadmap })}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit details
              </Button>

              {roadmap.isPublished ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRelease(false)}
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Unpublish
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRelease(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Publish
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                Delete
              </Button>
            </div>

            {confirming && (
              <div className="rounded-md border border-red-200 bg-red-50/60 p-3 space-y-2">
                <p className="text-xs text-gray-700">
                  Delete “{roadmap.title}”? Its topics, their learning materials
                  and the files those hold go with it. A roadmap students have
                  already worked through cannot be deleted — unpublish it
                  instead.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      setConfirming(false);
                      remove();
                    }}
                  >
                    Delete roadmap
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {editing && (
          <RoadmapForm
            key={editing.mode === "edit" ? editing.roadmap.id : "new"}
            editing={editing}
            onClose={() => setEditing(null)}
            onSaved={(saved) => {
              setEditing(null);
              onChanged(saved.id);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function RoadmapForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (roadmap: Roadmap) => void;
}) {
  const isNew = editing.mode === "new";

  const [draft, setDraft] = useState<RoadmapDraft>(() =>
    editing.mode === "new"
      ? EMPTY_ROADMAP_DRAFT
      : draftOfRoadmap(editing.roadmap),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RoadmapDraft>(
    field: K,
    value: RoadmapDraft[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here so the author is told which field to fix without a round
    // trip. The server checks all of it again and has the final say.
    const found = validateRoadmapDraft(draft);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (isNew) {
        // A new roadmap arrives as a draft. Writing one down is not the same
        // decision as putting it in front of a class, so releasing it is the
        // separate Publish action rather than a checkbox on this form.
        const created = await createRoadmap(draft);

        toast.success("Roadmap added as a draft.");
        onSaved(created);
      } else {
        const saved = await updateRoadmap(
          (editing as { roadmap: Roadmap }).roadmap.id,
          draft,
        );

        toast.success("Roadmap saved.");
        onSaved(saved);
      }
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        // Laravel's own messages, against the fields it rejected.
        setErrors(
          Object.fromEntries(
            Object.entries(e.errors).map(([field, messages]) => [
              field,
              messages[0],
            ]),
          ),
        );
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      aria-label={isNew ? "Add roadmap" : "Edit roadmap"}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="roadmap-title">Title</Label>
        <Input
          id="roadmap-title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
        {errors.title && <FieldError message={errors.title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="roadmap-description">Description (optional)</Label>
        <Input
          id="roadmap-description"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {errors.description && <FieldError message={errors.description} />}
      </div>

      {isNew && (
        <p className="text-xs text-gray-600">
          It starts as a draft. Add its topics, then publish it when the class
          should see it.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add roadmap" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}
