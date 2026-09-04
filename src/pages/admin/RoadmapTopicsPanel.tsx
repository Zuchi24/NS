import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api";
import {
  EMPTY_TOPIC_DRAFT,
  TOPIC_DESCRIPTION_MAX,
  createTopic,
  deleteTopic,
  draftOfTopic,
  overviewLength,
  reorderTopics,
  updateTopic,
  validateTopicDraft,
} from "@/features/content/topicService";
import type { TopicDraft } from "@/features/content/topicService";
import type { Topic } from "@/features/content/types";
import { TopicMaterialsPanel } from "./TopicMaterialsPanel";

/**
 * Authoring one roadmap's topics.
 *
 * Every action goes to the same endpoints the student side reads from, so what
 * an author sees here is what students get — there is no second store and
 * nothing is held locally between saves. Authorization is the server's: these
 * routes refuse anyone without canManageContent(), and this panel is only
 * rendered inside the admin area, so the check is not repeated here.
 *
 * The list is deliberately numbered. Topic order is not decoration — it decides
 * which topics unlock after which — so the position is shown rather than left
 * to be inferred from the order rows happen to appear in.
 *
 * A card carries a whole topic: its content, and the learning materials hanging
 * off it. All of that at once, down a roadmap of twenty topics, is a page an
 * author has to scroll past to reach the topic they came for — so a card opens
 * one at a time and the rest stay a single line each. One open at a time is not
 * only tidiness: an open card fetches that topic's materials, and the order
 * controls are read off the collapsed list, which stops being readable once
 * several cards are unfolded between them.
 */

/** Which topic the form is editing, or that it is adding a new one. */
type Editing = { mode: "new" } | { mode: "edit"; topic: Topic };

export function RoadmapTopicsPanel({
  roadmapId,
  roadmapTitle,
  topics,
  onChanged,
}: {
  roadmapId: number;
  roadmapTitle: string;
  /** In the order students meet them. Owned by the page, not by this panel. */
  topics: Topic[];
  /** Reloads the catalogue after a write, so the page and server agree. */
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The one topic that is open, if any. Held by id rather than by position, so
   * a reorder or a reload leaves the same topic open rather than whichever
   * topic has since moved into that slot.
   */
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const editingTopicId = editing?.mode === "edit" ? editing.topic.id : null;

  const toggle = (topicId: number) =>
    setExpandedId((current) => (current === topicId ? null : topicId));

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...topics];
    const target = index + direction;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);

    try {
      // The whole order is sent, so what is stored is the list the author is
      // looking at rather than a guess assembled from one move. The server
      // insists on the complete list for the same reason.
      await reorderTopics(
        roadmapId,
        next.map((topic) => topic.id),
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (topic: Topic) => {
    setBusy(true);

    try {
      await deleteTopic(topic.id);
      toast.success(`Removed “${topic.title}”.`);

      // Nothing is left to open once the topic is gone; leaving its id behind
      // would open whatever the server hands back under that id next.
      setExpandedId((current) => (current === topic.id ? null : current));
      onChanged();
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
            <BookOpen className="w-5 h-5 text-blue-600" />
            Topics
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            {topics.length} topic{topics.length === 1 ? "" : "s"} in{" "}
            {roadmapTitle}, in the order students meet them. Open one to author
            its content and materials.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setEditing({ mode: "new" })}
          disabled={editing !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add topic
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {topics.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No topics in this roadmap yet. Add the first one students will meet.
          </p>
        )}

        {topics.length > 0 && (
          <ul className="space-y-2">
            {topics.map((topic, index) => (
              <li key={topic.id}>
                <TopicCard
                  topic={topic}
                  position={index + 1}
                  busy={busy}
                  // An open form is never folded away out from under the author
                  // mid-edit, whatever else is open.
                  isExpanded={
                    expandedId === topic.id || editingTopicId === topic.id
                  }
                  isEditing={editingTopicId === topic.id}
                  isFirst={index === 0}
                  isLast={index === topics.length - 1}
                  onToggle={() => toggle(topic.id)}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, 1)}
                  onEdit={() => {
                    setEditing({ mode: "edit", topic });
                    setExpandedId(topic.id);
                  }}
                  onDelete={() => remove(topic)}
                >
                  {editingTopicId === topic.id && (
                    <TopicEditForm
                      topic={topic}
                      onClose={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        setExpandedId(topic.id);
                        onChanged();
                      }}
                    />
                  )}
                </TopicCard>
              </li>
            ))}
          </ul>
        )}

        <AddTopicDialog
          roadmapId={roadmapId}
          open={editing?.mode === "new"}
          onClose={() => setEditing(null)}
          onCreated={(saved) => {
            setEditing(null);
            // The topic that was just written is the one the author is about to
            // put materials on, so the modal closes onto it open rather than
            // folded into the list it was appended to.
            setExpandedId(saved.id);
            onChanged();
          }}
        />
      </CardContent>
    </Card>
  );
}

function TopicCard({
  topic,
  position,
  busy,
  isExpanded,
  isEditing,
  isFirst,
  isLast,
  onToggle,
  onUp,
  onDown,
  onEdit,
  onDelete,
  children,
}: {
  topic: Topic;
  position: number;
  busy: boolean;
  isExpanded: boolean;
  /** True while this topic's own edit form is open inside the card. */
  isEditing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** The edit form, when this is the topic being edited. */
  children?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const contentId = `topic-${topic.id}-content`;

  return (
    <div
      className={`rounded-md border ${
        isExpanded
          ? "border-blue-600 bg-blue-50/40"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* The position, not a bullet: where a topic sits is what decides which
            topics unlock after it, so it is worth reading off the screen — and
            it stays readable with every card folded. It stays through an edit
            too: the form has no field for position, so the badge is the only
            thing saying which topic is being rewritten. */}
        <span
          className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center"
          aria-hidden="true"
        >
          {position}
        </span>

        {/* An edit takes the place of what it edits. The title, the position
            line and the video the card was showing are the same three fields
            the form carries, already filled in, so leaving the display above
            the form would be showing each of them twice — once as text and
            once as the box that is about to change it. The row's own controls
            go with them: what can be done to a topic mid-edit is save it or
            drop the edit, and the form carries both. */}
        {isEditing ? (
          <div className="min-w-0 flex-1">{children}</div>
        ) : (
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={contentId}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${topic.title}`}
              className="text-left w-full flex items-start gap-2"
            >
              <span
                className="shrink-0 mt-0.5 text-gray-500"
                aria-hidden="true"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 break-words">
                  {topic.title}
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Position {position}
                </span>
              </span>
            </button>

            {/* Kept on the folded card: a topic with no headline video is a gap
              an author is usually looking for, and finding it should not mean
              opening every card in turn. */}
            {!isExpanded && topic.videoUrl && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 break-all">
                <Video className="w-3 h-3 shrink-0" aria-hidden="true" />
                {topic.videoUrl}
              </p>
            )}

            {confirming && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-700">
                  Delete this topic? Its learning materials and their files go
                  with it. Students keep every attempt they have made.
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
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Move ${topic.title} up`}
              disabled={isFirst || busy}
              onClick={onUp}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Move ${topic.title} down`}
              disabled={isLast || busy}
              onClick={onDown}
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Edit ${topic.title}`}
              onClick={onEdit}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${topic.title}`}
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        )}
      </div>

      {/* Rendered only while open, so a folded card costs nothing and the
          materials panel inside fetches for the topic being worked on rather
          than for every topic in the roadmap. Materials are not part of what an
          edit replaces: they are the topic's own list, edited by their own
          panel, and an author retitling a topic has no reason to lose sight of
          them. */}
      {isExpanded && (
        <div
          id={contentId}
          className="border-t border-blue-100 px-4 py-4 space-y-4 bg-white rounded-b-md"
        >
          {!isEditing && (
            <div className="space-y-3">
              {topic.description ? (
                <p className="text-sm text-gray-700">{topic.description}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  This topic has no description.
                </p>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4 text-gray-400 shrink-0" />
                {topic.videoUrl ? (
                  <a
                    href={topic.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    {topic.videoUrl}
                  </a>
                ) : (
                  <span className="text-gray-500">No video linked</span>
                )}
              </div>
            </div>
          )}

          {/* The card itself is keyed on the topic, so opening another one
              mounts a fresh panel rather than showing the previous topic's
              list while this one loads. */}
          <TopicMaterialsPanel topicId={topic.id} />
        </div>
      )}
    </div>
  );
}

/**
 * The three boxes a topic is written in, wherever it is being written.
 *
 * The modal that adds a topic and the form that edits one in place are the same
 * fields against the same rules, so they share these rather than drifting into
 * two spellings of one column. Ids are prefixed because both could be mounted
 * at once, and a label pointing at the wrong box is a label that does nothing.
 */
function TopicFields({
  idPrefix,
  draft,
  errors,
  onChange,
}: {
  idPrefix: string;
  draft: TopicDraft;
  errors: Record<string, string>;
  onChange: <K extends keyof TopicDraft>(field: K, value: TopicDraft[K]) => void;
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
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${idPrefix}-overview`}>Overview (optional)</Label>
          <OverviewCounter idPrefix={idPrefix} text={draft.description} />
        </div>
        <Input
          id={`${idPrefix}-overview`}
          value={draft.description}
          // Deliberately not capped with maxLength: silently swallowing the
          // end of a pasted paragraph looks like the box is broken. It is let
          // through, counted, and refused with a reason.
          aria-describedby={`${idPrefix}-overview-count`}
          onChange={(e) => onChange("description", e.target.value)}
        />
        <p className="text-xs text-gray-600">
          The line that says what the topic covers. Students read it under the
          title, on the roadmap and on the topic itself.
        </p>
        {errors.description && <FieldError message={errors.description} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-video`}>Headline video (optional)</Label>
        <Input
          id={`${idPrefix}-video`}
          value={draft.videoUrl}
          placeholder="https://"
          onChange={(e) => onChange("videoUrl", e.target.value)}
        />
        <p className="text-xs text-gray-600">
          The one tutorial the topic page leads with. Anything further belongs
          in learning materials.
        </p>
        {errors.videoUrl && <FieldError message={errors.videoUrl} />}
      </div>
    </>
  );
}

/**
 * How much of the overview is left.
 *
 * Counts down rather than up: while typing, what an author needs to know is how
 * much room is left, not how much they have used. Past the limit it turns and
 * says by how much — the same thing the validation error says on save, so the
 * form never refuses something it had not already been showing.
 *
 * Counted on the trimmed text, in characters rather than UTF-16 units, which
 * is what the server counts and what would be stored — so the number here and
 * the number in the error always agree.
 */
function OverviewCounter({
  idPrefix,
  text,
}: {
  idPrefix: string;
  text: string;
}) {
  // Counted by the same function the validation uses, so the number an author
  // watches while typing is the number that decides whether the save goes
  // through — not a second opinion that happens to agree most of the time.
  const left = TOPIC_DESCRIPTION_MAX - overviewLength(text);

  return (
    <span
      id={`${idPrefix}-overview-count`}
      className={`text-xs tabular-nums ${
        left < 0
          ? "text-red-600 font-medium"
          : left <= 40
            ? "text-amber-700"
            : "text-gray-500"
      }`}
    >
      {left < 0
        ? `${-left} over the ${TOPIC_DESCRIPTION_MAX} character limit`
        : `${left} of ${TOPIC_DESCRIPTION_MAX} characters left`}
    </span>
  );
}

/**
 * Checks a draft, writes it, and turns a refusal into per-field messages.
 *
 * Shared by both forms so adding a topic and editing one fail identically: the
 * same rules before the network, the same field the server's message lands
 * under afterwards, the same toast for everything that is not a field problem.
 */
async function saveTopicDraft(
  draft: TopicDraft,
  save: (draft: TopicDraft) => Promise<Topic>,
): Promise<{ saved?: Topic; errors: Record<string, string> }> {
  // Checked here so the author is told which field to fix without a round
  // trip. The server checks all of it again and has the final say.
  const found = validateTopicDraft(draft);

  if (Object.keys(found).length > 0) return { errors: found };

  try {
    return { saved: await save(draft), errors: {} };
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
      // Laravel's own messages, against the fields it rejected. The API names
      // the column, so ytube_link is put back under the box that carries it.
      return {
        errors: Object.fromEntries(
          Object.entries(e.errors).map(([field, messages]) => [
            field === "ytube_link" ? "videoUrl" : field,
            messages[0],
          ]),
        ),
      };
    }

    toast.error(e instanceof Error ? e.message : "Could not save.");
    return { errors: {} };
  }
}

/** Rewriting a topic, in the card that topic already occupies. */
function TopicEditForm({
  topic,
  onClose,
  onSaved,
}: {
  topic: Topic;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TopicDraft>(() => draftOfTopic(topic));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const result = await saveTopicDraft(draft, (next) =>
      updateTopic(topic.id, next),
    );

    setSaving(false);
    setErrors(result.errors);

    if (result.saved) {
      toast.success("Topic saved.");
      onSaved();
    }
  };

  /*
   * A topic written before the limit existed.
   *
   * Its description is untouched — nothing trims what is already stored, and
   * students go on reading it in full. But the limit applies to what is saved
   * from here, so an author who came to change the title needs to know why the
   * save will not go through, and that the fix is theirs to make rather than
   * something the form will quietly do for them.
   */
  const wasAlreadyOver =
    overviewLength(topic.description ?? "") > TOPIC_DESCRIPTION_MAX;

  return (
    <form
      onSubmit={submit}
      aria-label="Edit topic"
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      {wasAlreadyOver && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          This overview was written before the {TOPIC_DESCRIPTION_MAX} character
          limit and is longer than it. Nothing has been cut — students still see
          all of it — but saving this topic needs it shortened first.
        </p>
      )}

      <TopicFields
        idPrefix="topic-edit"
        draft={draft}
        errors={errors}
        onChange={(field, value) =>
          setDraft((current) => ({ ...current, [field]: value }))
        }
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Adding a topic, in a modal over the roadmap.
 *
 * A new topic has no card to be written in — that is the difference between
 * adding and editing, and why only this one is a dialog. It is the same centred
 * modal the workspace configures a device in, for the same reason: the author
 * is filling in one short form and nothing behind it is worth reading past.
 */
function AddTopicDialog({
  roadmapId,
  open,
  onClose,
  onCreated,
}: {
  roadmapId: number;
  open: boolean;
  onClose: () => void;
  /** Hands back what was stored, so the caller can open the new topic. */
  onCreated: (saved: Topic) => void;
}) {
  const [draft, setDraft] = useState<TopicDraft>(EMPTY_TOPIC_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /**
   * Shuts the modal on an empty draft.
   *
   * The dialog stays mounted between openings, so what was abandoned last time
   * is still in state; every way out of the modal goes through here, and opens
   * the next one on blank boxes rather than on someone's dropped draft.
   */
  const close = () => {
    setDraft(EMPTY_TOPIC_DRAFT);
    setErrors({});
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    // Appended. Moving a topic is its own action, so a new one goes to the end
    // and the author walks it up to where they want it — which reads the same
    // as every other move and stores the same way.
    const result = await saveTopicDraft(draft, (next) =>
      createTopic(roadmapId, next),
    );

    setSaving(false);
    setErrors(result.errors);

    // A refused draft keeps the modal open, with what was typed still in it and
    // the message under the box that has to change. Only a stored topic closes
    // it.
    if (result.saved) {
      toast.success("Topic added.");
      setDraft(EMPTY_TOPIC_DRAFT);
      setErrors({});
      onCreated(result.saved);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape, the overlay and the corner cross all come through here, and
        // each of them means the same as Cancel.
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Topic</DialogTitle>
          <DialogDescription>
            It joins the end of the roadmap. Move it into place, and add its
            learning materials, once it is in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} aria-label="Add topic" className="space-y-4">
          <TopicFields
            idPrefix="topic-add"
            draft={draft}
            errors={errors}
            onChange={(field, value) =>
              setDraft((current) => ({ ...current, [field]: value }))
            }
          />

          <DialogFooter className="mt-6 gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Add topic"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}
