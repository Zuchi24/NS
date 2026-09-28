import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { validateDraft } from "@/features/content/materialService";
import type { MaterialDraft } from "@/features/content/materialService";
import {
  EMPTY_MATERIAL_DRAFT,
  KIND_LABEL,
  MaterialFields,
  materialSummary,
} from "./MaterialFields";

/**
 * The materials an author writes while the thing that will hold them does not
 * exist yet.
 *
 * A topic or a section is created before anything can be attached to it — the
 * API takes the owner's id in the path, and there is no id until the server has
 * answered. So these are held here, in the browser, until there is somewhere to
 * put them. Nothing in this component reaches the network.
 *
 * The list belongs to whoever renders this. That is deliberate: the dialog
 * already resets its own draft when it closes, and a list held in here would be
 * a second thing to remember to clear. What this owns is only the editor — which
 * entry is open and what has been typed into it so far — and the caller drops
 * that by remounting on open, the same way it blanks its other boxes.
 *
 * Every control is type="button". These fields live inside the dialog's form,
 * and a button that defaults to submit would create the topic halfway through
 * writing a material. For the same reason there is no <form> in here: a nested
 * one is not something a browser will render.
 *
 * A file lives in the draft as the browser's own File handle, not a copy, so
 * staging several costs almost nothing until they are actually sent.
 */

/** Which entry the editor is on: a new one, or the staged entry at this index. */
type Editing = { mode: "new" } | { mode: "edit"; index: number };

export function StagedMaterials({
  idPrefix,
  materials,
  onChange,
  caption,
}: {
  idPrefix: string;
  materials: MaterialDraft[];
  onChange: (next: MaterialDraft[]) => void;
  /** What these will be attached to, in the words the dialog uses. */
  caption: string;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState<MaterialDraft>(EMPTY_MATERIAL_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = (next: Editing) => {
    setEditing(next);
    setDraft(next.mode === "edit" ? materials[next.index] : EMPTY_MATERIAL_DRAFT);
    setErrors({});
  };

  const cancel = () => {
    setEditing(null);
    setDraft(EMPTY_MATERIAL_DRAFT);
    setErrors({});
  };

  /**
   * Takes the entry into the list, or says what is wrong with it.
   *
   * The same check the standalone form makes, and always as a new material:
   * nothing staged has been stored, so there is no file already on the server
   * for a blank picker to fall back to.
   */
  const keep = () => {
    const found = validateDraft(draft, { isNew: true });

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    onChange(
      editing?.mode === "edit"
        ? materials.map((entry, index) =>
            index === editing.index ? draft : entry,
          )
        : [...materials, draft],
    );

    cancel();
  };

  const remove = (index: number) => {
    onChange(materials.filter((_, at) => at !== index));

    // The editor is pointed at a position, so removing anything at or before
    // it would leave it editing a different material than the one it opened.
    if (editing?.mode === "edit") cancel();
  };

  return (
    <fieldset className="space-y-3 border-t border-gray-200 pt-4">
      <legend className="text-sm font-medium text-gray-900">
        Learning materials (optional)
      </legend>
      <p className="text-xs text-gray-600">{caption}</p>

      {materials.length > 0 && (
        <ul className="space-y-2" data-testid={`${idPrefix}-list`}>
          {materials.map((material, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900">
                  {index + 1}. {material.title}
                </p>
                <p className="truncate text-xs text-gray-600">
                  {KIND_LABEL[material.kind]} · {materialSummary(material)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={editing !== null}
                  onClick={() => open({ mode: "edit", index })}
                  aria-label={`Edit ${material.title}`}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${material.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => open({ mode: "new" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add material
        </Button>
      ) : (
        <div className="space-y-4 rounded-md border border-brand-teal/30 bg-accent/60 p-4">
          <MaterialFields
            idPrefix={idPrefix}
            draft={draft}
            errors={errors}
            // Nothing staged has been stored, so there is never a file already
            // on the server to keep.
            existingFile={null}
            onChange={(field, value) =>
              setDraft((current) => ({ ...current, [field]: value }))
            }
          />

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={keep}>
              {editing.mode === "edit" ? "Save material" : "Add to list"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
