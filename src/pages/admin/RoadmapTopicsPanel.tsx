import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api";
import {
  EMPTY_TOPIC_DRAFT,
  createTopic,
  deleteTopic,
  draftOfTopic,
  reorderTopics,
  updateTopic,
  validateTopicDraft,
} from "@/features/content/topicService";
import type { TopicDraft } from "@/features/content/topicService";
import type { Topic } from "@/features/content/types";

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
 */

/** Which topic the form is editing, or that it is adding a new one. */
type Editing = { mode: "new" } | { mode: "edit"; topic: Topic };

export function RoadmapTopicsPanel({
  roadmapId,
  roadmapTitle,
  topics,
  selectedTopicId,
  onSelect,
  onChanged,
}: {
  roadmapId: number;
  roadmapTitle: string;
  /** In the order students meet them. Owned by the page, not by this panel. */
  topics: Topic[];
  selectedTopicId: number | null;
  onSelect: (topicId: number) => void;
  /** Reloads the catalogue after a write, so the page and server agree. */
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

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
            {roadmapTitle}, in the order students meet them.
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
        {topics.length === 0 && editing === null && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No topics yet. Add the first one students will meet.
          </p>
        )}

        {topics.length > 0 && (
          <ul className="space-y-2">
            {topics.map((topic, index) => (
              <li key={topic.id}>
                <TopicRow
                  topic={topic}
                  position={index + 1}
                  busy={busy}
                  isSelected={topic.id === selectedTopicId}
                  isFirst={index === 0}
                  isLast={index === topics.length - 1}
                  onSelect={() => onSelect(topic.id)}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, 1)}
                  onEdit={() => setEditing({ mode: "edit", topic })}
                  onDelete={() => remove(topic)}
                />
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <TopicForm
            key={editing.mode === "edit" ? editing.topic.id : "new"}
            roadmapId={roadmapId}
            editing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TopicRow({
  topic,
  position,
  busy,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: {
  topic: Topic;
  position: number;
  busy: boolean;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`rounded-md border px-4 py-3 flex items-start gap-3 ${
        isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* The position, not a bullet: where a topic sits is what decides which
          topics unlock after it, so it is worth reading off the screen. */}
      <span
        className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center"
        aria-hidden="true"
      >
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onSelect}
          className="text-left w-full"
          aria-label={`Select ${topic.title}`}
        >
          <p className="text-sm font-semibold text-gray-900 break-words">
            {topic.title}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Position {position} · {topic.challengesCount ?? 0} challenge
            {topic.challengesCount === 1 ? "" : "s"}
          </p>
        </button>

        {topic.videoUrl && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 break-all">
            <Video className="w-3 h-3 shrink-0" aria-hidden="true" />
            {topic.videoUrl}
          </p>
        )}

        {confirming && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-700">
              Delete this topic? Its learning materials and their files go with
              it. Students keep every attempt they have made.
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
    </div>
  );
}

function TopicForm({
  roadmapId,
  editing,
  onClose,
  onSaved,
}: {
  roadmapId: number;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing.mode === "new";

  const [draft, setDraft] = useState<TopicDraft>(() =>
    editing.mode === "new" ? EMPTY_TOPIC_DRAFT : draftOfTopic(editing.topic),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TopicDraft>(field: K, value: TopicDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here so the author is told which field to fix without a round
    // trip. The server checks all of it again and has the final say.
    const found = validateTopicDraft(draft);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (isNew) {
        // Appended. Moving a topic is its own action, so a new one goes to the
        // end and the author walks it up to where they want it — which reads
        // the same as every other move and stores the same way.
        await createTopic(roadmapId, draft);
        toast.success("Topic added.");
      } else {
        await updateTopic((editing as { topic: Topic }).topic.id, draft);
        toast.success("Topic saved.");
      }

      onSaved();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        // Laravel's own messages, against the fields it rejected. The API
        // names the column, so ytube_link is put back under the box that
        // carries it.
        setErrors(
          Object.fromEntries(
            Object.entries(e.errors).map(([field, messages]) => [
              field === "ytube_link" ? "videoUrl" : field,
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
      aria-label={isNew ? "Add topic" : "Edit topic"}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="topic-title">Title</Label>
        <Input
          id="topic-title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
        {errors.title && <FieldError message={errors.title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-description">Description (optional)</Label>
        <Input
          id="topic-description"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {errors.description && <FieldError message={errors.description} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-video">Headline video (optional)</Label>
        <Input
          id="topic-video"
          value={draft.videoUrl}
          placeholder="https://"
          onChange={(e) => set("videoUrl", e.target.value)}
        />
        <p className="text-xs text-gray-600">
          The one tutorial the topic page leads with. Anything further belongs
          in learning materials.
        </p>
        {errors.videoUrl && <FieldError message={errors.videoUrl} />}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add topic" : "Save changes"}
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
