import { useCallback, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Link2,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  createMaterial,
  deleteMaterial,
  fetchTopicMaterials,
  readableSize,
  reorderMaterials,
  updateMaterial,
  validateDraft,
} from "@/features/content/materialService";
import type { MaterialDraft } from "@/features/content/materialService";
import { MATERIAL_KINDS } from "@/features/content/types";
import type { LearningMaterial, MaterialKind } from "@/features/content/types";

/**
 * Authoring one topic's materials.
 *
 * Every action goes to the same endpoints the student side reads from, so what
 * an author sees here is what students get — there is no second store and
 * nothing is held locally between saves. Authorization is the server's: these
 * routes refuse anyone without canManageContent(), and this panel is only
 * rendered inside the admin area, so the check is not repeated here.
 */

const KIND_ICON: Record<MaterialKind, typeof FileText> = {
  video: PlayCircle,
  link: Link2,
  file: FileText,
};

const KIND_LABEL: Record<MaterialKind, string> = {
  video: "Video",
  link: "Link",
  file: "File",
};

const EMPTY_DRAFT: MaterialDraft = {
  title: "",
  description: "",
  kind: "link",
  url: "",
  file: null,
  isPublished: true,
};

/** Which material the form is editing, or that it is adding a new one. */
type Editing = { mode: "new" } | { mode: "edit"; material: LearningMaterial };

export function TopicMaterialsPanel({ topicId }: { topicId: number }) {
  const load = useCallback(() => fetchTopicMaterials(topicId), [topicId]);
  const { data, error, loading, reload } = useAsync(load, [topicId]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  const materials = data ?? [];

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...materials];
    const target = index + direction;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);

    try {
      // The whole order is sent, so what is stored is the list the author is
      // looking at rather than a guess assembled from one move.
      await reorderMaterials(
        topicId,
        next.map((material) => material.id),
      );
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (material: LearningMaterial) => {
    setBusy(true);

    try {
      await deleteMaterial(material.id);
      toast.success(`Removed “${material.title}”.`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Learning materials
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            What students see on this topic, in this order.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setEditing({ mode: "new" })}
          disabled={editing !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add material
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && <LoadingState label="Loading materials…" />}

        {error && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && materials.length === 0 && editing === null && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No materials yet. Add a video, a link or a file.
          </p>
        )}

        {!loading && !error && materials.length > 0 && (
          <ul className="space-y-2">
            {materials.map((material, index) => (
              <li key={material.id}>
                <MaterialRow
                  material={material}
                  busy={busy}
                  isFirst={index === 0}
                  isLast={index === materials.length - 1}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, 1)}
                  onEdit={() => setEditing({ mode: "edit", material })}
                  onDelete={() => remove(material)}
                />
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <MaterialForm
            key={editing.mode === "edit" ? editing.material.id : "new"}
            topicId={topicId}
            editing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MaterialRow({
  material,
  busy,
  isFirst,
  isLast,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: {
  material: LearningMaterial;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = KIND_ICON[material.kind];

  return (
    <div className="rounded-md border border-gray-200 px-4 py-3 flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 shrink-0 mt-1" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 break-words">
            {material.title}
          </p>
          <span className="text-xs text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
            {material.kindLabel}
          </span>
          {!material.isPublished && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Draft
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-1 break-all">
          {material.kind === "file"
            ? [material.filename, readableSize(material.sizeBytes)]
                .filter(Boolean)
                .join(" · ")
            : material.url}
        </p>

        {confirming && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-700">
              Delete this material? Its file is removed too.
            </span>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move ${material.title} up`}
          disabled={isFirst || busy}
          onClick={onUp}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move ${material.title} down`}
          disabled={isLast || busy}
          onClick={onDown}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Edit ${material.title}`}
          onClick={onEdit}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${material.title}`}
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

function draftOf(editing: Editing): MaterialDraft {
  if (editing.mode === "new") return EMPTY_DRAFT;

  const { material } = editing;

  return {
    title: material.title,
    description: material.description ?? "",
    kind: material.kind,
    url: material.url ?? "",
    // An edit keeps the file it already has unless a new one is chosen.
    file: null,
    isPublished: material.isPublished,
  };
}

function MaterialForm({
  topicId,
  editing,
  onClose,
  onSaved,
}: {
  topicId: number;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing.mode === "new";

  const [draft, setDraft] = useState<MaterialDraft>(() => draftOf(editing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MaterialDraft>(
    field: K,
    value: MaterialDraft[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const existingFile =
    editing.mode === "edit" && editing.material.kind === "file"
      ? editing.material.filename
      : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here so the author is told which field to fix without a round
    // trip. The server checks all of it again and has the final say.
    const found = validateDraft(draft, { isNew });

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (isNew) {
        await createMaterial(topicId, draft);
        toast.success("Material added.");
      } else {
        await updateMaterial((editing as { material: LearningMaterial }).material.id, draft);
        toast.success("Material saved.");
      }

      onSaved();
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
      aria-label={isNew ? "Add material" : "Edit material"}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="material-title">Title</Label>
        <Input
          id="material-title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
        {errors.title && <FieldError message={errors.title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="material-kind">Type</Label>
        <select
          id="material-kind"
          value={draft.kind}
          onChange={(e) => set("kind", e.target.value as MaterialKind)}
          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {/* Exactly the kinds the API accepts; there is no "other". */}
          {MATERIAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      </div>

      {/* Keyed so React remounts the field rather than reconciling the URL box
          into the file picker — the two differ in whether they are controlled,
          and reusing the node flips one into the other and strands its value. */}
      {draft.kind === "file" ? (
        <div key="file-field" className="space-y-2">
          <Label htmlFor="material-file">File</Label>
          <Input
            id="material-file"
            type="file"
            onChange={(e) => set("file", e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-gray-600">
            PDF, Office documents, images, text or zip. Up to 20 MB. Files are
            stored privately and only released to students who can open this
            topic.
          </p>
          {existingFile && !draft.file && (
            <p className="text-xs text-gray-600">
              Currently {existingFile}. Choose a file to replace it.
            </p>
          )}
          {errors.file && <FieldError message={errors.file} />}
        </div>
      ) : (
        <div key="url-field" className="space-y-2">
          <Label htmlFor="material-url">
            {draft.kind === "video" ? "YouTube address" : "Web address"}
          </Label>
          <Input
            id="material-url"
            value={draft.url}
            placeholder="https://"
            onChange={(e) => set("url", e.target.value)}
          />
          {errors.url && <FieldError message={errors.url} />}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="material-description">Description (optional)</Label>
        <Input
          id="material-description"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {errors.description && <FieldError message={errors.description} />}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={draft.isPublished}
          onChange={(e) => set("isPublished", e.target.checked)}
          className="rounded border-gray-300"
        />
        Visible to students
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add material" : "Save changes"}
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
