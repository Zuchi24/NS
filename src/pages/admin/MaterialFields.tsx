import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_UPLOAD_MEGABYTES } from "@/features/content/materialService";
import type { MaterialDraft } from "@/features/content/materialService";
import { MATERIAL_KINDS } from "@/features/content/types";
import type { MaterialKind } from "@/features/content/types";

/**
 * The boxes a material is written in, and nothing else.
 *
 * A module of its own rather than a part of TopicMaterialsPanel, because it now
 * has two callers that must not depend on that panel: the panel itself, and the
 * Add Topic and Add Subtopic dialogs, which stage materials before there is
 * anything to attach them to. The admin tests stub TopicMaterialsPanel whole, so
 * importing these fields from it would hand those tests an undefined component.
 *
 * Presentational on purpose: it holds no draft of its own, validates nothing and
 * sends nothing. What it is given it shows, and what is typed it hands back
 * through onChange — so whoever renders it owns the draft.
 *
 * `idPrefix` is here for the same reason TopicFields has one: two sets of these
 * on a page would otherwise share every id, which silently breaks the label a
 * screen reader reads and the label a test clicks. The prefix is the caller's to
 * make unique; this only promises to use it consistently.
 *
 * There is no submit button and no <form> element. A second form nested inside
 * the one that owns these fields is not something a browser will render, and
 * both callers are exactly such a form.
 */

/** The kinds, in the words the select offers them. */
export const KIND_LABEL: Record<MaterialKind, string> = {
  video: "Video",
  link: "Link",
  file: "File",
};

/** A material nobody has written yet. Shared, so both callers start the same. */
export const EMPTY_MATERIAL_DRAFT: MaterialDraft = {
  title: "",
  description: "",
  kind: "link",
  url: "",
  file: null,
  isPublished: true,
};

export function MaterialFields({
  idPrefix,
  draft,
  errors,
  existingFile,
  onChange,
}: {
  idPrefix: string;
  draft: MaterialDraft;
  errors: Record<string, string>;
  /** The file an edit already has, named so it can be kept or replaced. */
  existingFile: string | null;
  onChange: <K extends keyof MaterialDraft>(
    field: K,
    value: MaterialDraft[K],
  ) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          onChange={(e) => onChange("title", e.target.value)}
        />
        {errors.title && <FieldError message={errors.title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-kind`}>Type</Label>
        <select
          id={`${idPrefix}-kind`}
          value={draft.kind}
          onChange={(e) => onChange("kind", e.target.value as MaterialKind)}
          className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
          <Label htmlFor={`${idPrefix}-file`}>File</Label>
          <Input
            id={`${idPrefix}-file`}
            type="file"
            onChange={(e) => onChange("file", e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-gray-600">
            PDF, Office documents (including PPT and PPTX), images, text or zip.
            Up to {MAX_UPLOAD_MEGABYTES} MB. Files are stored privately and only
            released to students who can open this topic. Video belongs under the
            video kind, as a link.
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
          <Label htmlFor={`${idPrefix}-url`}>
            {draft.kind === "video" ? "Video address" : "Web address"}
          </Label>
          <Input
            id={`${idPrefix}-url`}
            value={draft.url}
            placeholder="https://"
            onChange={(e) => onChange("url", e.target.value)}
          />
          {draft.kind === "video" && (
            <p className="text-xs text-gray-600">
              A YouTube link, a Google Drive share link, or any other https
              address the video plays at. NetSim points at video rather than
              hosting it; upload PDFs and slide decks as a file instead.
            </p>
          )}
          {errors.url && <FieldError message={errors.url} />}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
        <Input
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
        {errors.description && <FieldError message={errors.description} />}
      </div>

      {/* The box and its words are one label, so this needs no id of its own —
          and so there is none to collide when a second set is on the page. */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={draft.isPublished}
          onChange={(e) => onChange("isPublished", e.target.checked)}
          className="rounded border-gray-300"
        />
        Visible to students
      </label>
    </>
  );
}

/** The same one-line message every admin form puts under a rejected box. */
function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}

/** A staged or saved material, said in one line. */
export function materialSummary(draft: MaterialDraft): string {
  if (draft.kind === "file") {
    return draft.file ? draft.file.name : "No file chosen";
  }

  return draft.url.trim() === "" ? "No address yet" : draft.url.trim();
}
