import { useState } from "react";
import { Award, Lock, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  ASSIGNABLE_TYPES,
  EMPTY_ACHIEVEMENT_DRAFT,
  TYPE_DESCRIPTIONS,
  activateAchievement,
  createAchievement,
  deleteAchievement,
  draftOfAchievement,
  fetchAdminAchievements,
  retireAchievement,
  updateAchievement,
  validateAchievementDraft,
} from "@/features/achievements/adminAchievementService";
import type {
  AchievementDraft,
  AchievementStatus,
  AdminAchievement,
  AssignableAchievementType,
} from "@/features/achievements/adminAchievementService";

/**
 * Authoring the achievements students earn.
 *
 * The whole catalogue on one page, drafts and retired rows included — which is
 * the difference between this and the student's achievements page, and the
 * reason it is a separate screen rather than an admin mode of that one. An
 * author is deciding what to write next; a student is being told what they have
 * earned.
 *
 * Three things here are not this page's decisions to make, and it shows them
 * rather than working them out. An achievement is written as a draft and
 * activated separately, so a rule never reaches a class as a side effect of
 * being typed. Once a student holds one its rule is fixed, because the award
 * carries no record of which rule earned it and changing the rule afterwards
 * would relabel their badge rather than re-decide it. And a held achievement
 * cannot be deleted at all: the awards cascade, so deleting one would take a
 * student's record with it. Retiring is what that achievement gets, and it
 * costs the student nothing.
 *
 * Each of those is enforced by the API. What the page does is never offer the
 * button — and when a refusal comes back anyway, show the server's own wording,
 * which names the achievement and says what to do instead.
 */

const STATUS_STYLES: Record<AchievementStatus, string> = {
  draft: "text-amber-700 bg-amber-50 border-amber-200",
  active: "text-emerald-700 bg-emerald-50 border-emerald-200",
  retired: "text-gray-600 bg-gray-100 border-gray-300",
};

/** Where an achievement stands, in the wording the server uses for it. */
export function StatusBadge({ achievement }: { achievement: AdminAchievement }) {
  return (
    <span
      className={`text-xs font-medium rounded px-1.5 py-0.5 border ${STATUS_STYLES[achievement.status]}`}
    >
      {achievement.statusLabel}
    </span>
  );
}

/** Which achievement the form is editing, or that it is adding a new one. */
type Editing = { mode: "new" } | { mode: "edit"; achievement: AdminAchievement };

/** A move waiting to be confirmed. Each one is worth a second look. */
type Pending = {
  achievement: AdminAchievement;
  action: "activate" | "retire" | "delete";
};

export function AchievementAdminPage() {
  const { data, error, loading, reload } = useAsync(fetchAdminAchievements);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState label="Loading achievements…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const achievements = data ?? [];

  const run = async (move: Pending) => {
    setBusy(true);

    try {
      if (move.action === "activate") {
        await activateAchievement(move.achievement.id);
        toast.success(`“${move.achievement.title}” is now being awarded.`);
      } else if (move.action === "retire") {
        await retireAchievement(move.achievement.id);
        toast.success(`“${move.achievement.title}” is retired.`);
      } else {
        await deleteAchievement(move.achievement.id);
        toast.success(`Removed “${move.achievement.title}”.`);
      }

      reload();
    } catch (e) {
      /*
       * The server refuses these with 409 and an explanation — that retirement
       * is permanent, or that an achievement students have earned is retired
       * rather than destroyed. Its wording names the achievement and says what
       * to do instead, which is better than anything this page could guess at.
       */
      toast.error(e instanceof Error ? e.message : "Could not do that.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Achievements
          </CardTitle>

          <Button
            size="sm"
            onClick={() => setEditing({ mode: "new" })}
            disabled={editing !== null}
          >
            <Plus className="w-4 h-4 mr-2" />
            New achievement
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {editing && (
            <AchievementForm
              key={editing.mode === "edit" ? editing.achievement.id : "new"}
              editing={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                reload();
              }}
            />
          )}

          {achievements.length === 0 ? (
            <EmptyState
              title="No achievements yet"
              description="Write the first one. It starts as a draft, so nothing reaches a class until you activate it."
            />
          ) : (
            <ul className="space-y-2">
              {achievements.map((achievement) => (
                <li key={achievement.id}>
                  <AchievementRow
                    achievement={achievement}
                    busy={busy}
                    formOpen={editing !== null}
                    pending={
                      pending?.achievement.id === achievement.id ? pending : null
                    }
                    onEdit={() => setEditing({ mode: "edit", achievement })}
                    onAsk={(action) => setPending({ achievement, action })}
                    onCancel={() => setPending(null)}
                    onConfirm={run}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementRow({
  achievement,
  busy,
  formOpen,
  pending,
  onEdit,
  onAsk,
  onCancel,
  onConfirm,
}: {
  achievement: AdminAchievement;
  busy: boolean;
  formOpen: boolean;
  pending: Pending | null;
  onEdit: () => void;
  onAsk: (action: Pending["action"]) => void;
  onCancel: () => void;
  onConfirm: (move: Pending) => void;
}) {
  return (
    <div
      className="rounded-md border border-gray-200 p-3 space-y-2"
      data-testid={`achievement-${achievement.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{achievement.title}</span>
            <StatusBadge achievement={achievement} />
          </div>

          <p className="text-xs text-gray-600">
            {achievement.typeLabel}
            {typeof achievement.criteria?.count === "number" && (
              <> · needs {String(achievement.criteria.count)}</>
            )}
          </p>

          <p className="text-xs text-gray-500">
            {achievement.awardedCount === 0
              ? "Earned by nobody yet"
              : achievement.awardedCount === 1
                ? "Earned by 1 student"
                : `Earned by ${achievement.awardedCount} students`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || formOpen}
            onClick={onEdit}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>

          {/* Only the move this achievement actually has. A draft is activated,
              an active one is retired, and a retired one is finished — offering
              a third button would be offering a request the API refuses. */}
          {achievement.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAsk("activate")}
            >
              <Play className="w-4 h-4 mr-2" />
              Activate
            </Button>
          )}

          {achievement.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAsk("retire")}
            >
              <Square className="w-4 h-4 mr-2" />
              Retire
            </Button>
          )}

          {/* Hidden rather than disabled once anybody holds it: there is no
              state in which this becomes available again, so a greyed-out
              button would be promising something that never arrives. */}
          {achievement.canBeDeleted && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onAsk("delete")}
            >
              <Trash2 className="w-4 h-4 mr-2 text-red-600" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {achievement.hasBeenAwarded && (
        <p className="text-xs text-gray-600 flex items-center gap-1.5">
          <Lock className="w-3 h-3" aria-hidden="true" />
          Students have earned this, so its rule is fixed and it cannot be
          deleted. Retire it instead — they keep what they earned.
        </p>
      )}

      {pending && (
        <Confirm
          pending={pending}
          busy={busy}
          onCancel={onCancel}
          onConfirm={() => onConfirm(pending)}
        />
      )}
    </div>
  );
}

/** What each move costs, said before it is made. */
const CONFIRM_COPY: Record<
  Pending["action"],
  { question: (title: string) => string; detail: string; verb: string }
> = {
  activate: {
    question: (title) => `Activate “${title}”?`,
    detail:
      "Students start being measured against it straight away, and it is awarded the moment somebody meets it.",
    verb: "Activate",
  },
  retire: {
    question: (title) => `Retire “${title}”?`,
    detail:
      "It stops being awarded, and this cannot be undone — a retired achievement never comes back. Everything students have already earned is kept.",
    verb: "Retire",
  },
  delete: {
    question: (title) => `Delete “${title}”?`,
    detail:
      "The achievement is removed for good. This is only possible because nobody has earned it.",
    verb: "Delete",
  },
};

function Confirm({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = CONFIRM_COPY[pending.action];
  const destructive = pending.action !== "activate";

  return (
    <div
      role="alertdialog"
      aria-label={copy.question(pending.achievement.title)}
      className={`rounded-md border p-3 space-y-2 ${
        destructive ? "border-red-200 bg-red-50/60" : "border-blue-200 bg-blue-50/50"
      }`}
    >
      <p className="text-xs text-gray-700">
        {copy.question(pending.achievement.title)} {copy.detail}
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={busy}
          onClick={onConfirm}
        >
          {copy.verb}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AchievementForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing.mode === "new";
  const achievement = editing.mode === "edit" ? editing.achievement : null;

  /*
   * Whether the rule may still be rewritten.
   *
   * Two ways it cannot. A student holds it, so the rule is part of their record
   * — the server's rulesAreEditable. Or it counts something no longer offered:
   * a roadmap_complete achievement is readable history, and there is no rule in
   * the picker that is the one it uses, so the picker cannot honestly edit it.
   */
  const ruleEditable =
    achievement === null ||
    (achievement.rulesAreEditable && achievement.isAssignable);

  const [draft, setDraft] = useState<AchievementDraft>(() =>
    achievement === null
      ? EMPTY_ACHIEVEMENT_DRAFT
      : draftOfAchievement(achievement),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AchievementDraft>(
    field: K,
    value: AchievementDraft[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here so the author is told which box to fix without a round trip.
    // The server checks all of it again and has the final say.
    const found = validateAchievementDraft(draft, {
      requireKey: isNew,
      requireRule: ruleEditable,
    });

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (achievement === null) {
        await createAchievement(draft);
        toast.success("Achievement added as a draft.");
      } else {
        await updateAchievement(achievement.id, draft, ruleEditable);
        toast.success("Achievement saved.");
      }

      onSaved();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        /*
         * Laravel's own messages, against the fields it rejected. `criteria` and
         * `criteria.count` are one box here, so both land on it — including the
         * refusal to rewrite an awarded rule, which arrives under whichever half
         * the request tried to change.
         */
        setErrors(
          Object.fromEntries(
            Object.entries(e.errors).map(([field, messages]) => [
              field === "criteria" || field === "criteria.count"
                ? "count"
                : field,
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
      aria-label={isNew ? "Add achievement" : "Edit achievement"}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      {isNew && (
        <div className="space-y-2">
          <Label htmlFor="achievement-key">Key</Label>
          <Input
            id="achievement-key"
            value={draft.key}
            onChange={(e) => set("key", e.target.value)}
            placeholder="first-steps"
          />
          <p className="text-xs text-gray-600">
            A permanent name for this achievement, in lower case with hyphens.
            It cannot be changed later.
          </p>
          {errors.key && <FieldError message={errors.key} />}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="achievement-title">Title</Label>
        <Input
          id="achievement-title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
        {errors.title && <FieldError message={errors.title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="achievement-description">Description (optional)</Label>
        <Input
          id="achievement-description"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {errors.description && <FieldError message={errors.description} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="achievement-icon">Icon (optional)</Label>
        <Input
          id="achievement-icon"
          value={draft.icon}
          onChange={(e) => set("icon", e.target.value)}
          placeholder="trophy"
        />
        {errors.icon && <FieldError message={errors.icon} />}
      </div>

      {!ruleEditable && achievement !== null && (
        <p className="text-xs text-amber-700" role="note">
          {achievement.hasBeenAwarded
            ? "Students have earned this, so what it is awarded for cannot be changed. Its title and description still can."
            : "This achievement uses a rule that is no longer offered, so it cannot be rewritten. Its title and description still can."}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="achievement-type">Awarded for</Label>
        <select
          id="achievement-type"
          value={draft.type}
          disabled={!ruleEditable}
          onChange={(e) =>
            set("type", e.target.value as AssignableAchievementType)
          }
          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          {/* Only the rules still offered. roadmap_complete is history: rows
              carrying it still read, and nothing new is written against it. */}
          {ASSIGNABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "challenge_count"
                ? "Challenges passed"
                : "Passed first try"}
            </option>
          ))}
        </select>
        {ruleEditable && (
          <p className="text-xs text-gray-600">{TYPE_DESCRIPTIONS[draft.type]}</p>
        )}
        {errors.type && <FieldError message={errors.type} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="achievement-count">How many are needed</Label>
        <Input
          id="achievement-count"
          inputMode="numeric"
          value={draft.count}
          disabled={!ruleEditable}
          onChange={(e) => set("count", e.target.value)}
        />
        {errors.count && <FieldError message={errors.count} />}
      </div>

      {isNew && (
        <p className="text-xs text-gray-600">
          It starts as a draft. Activate it when the class should be measured
          against it.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add achievement" : "Save changes"}
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
