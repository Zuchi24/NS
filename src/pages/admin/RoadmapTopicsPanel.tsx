import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
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
  EMPTY_SUBTOPIC_DRAFT,
  EMPTY_TOPIC_DRAFT,
  TOPIC_DESCRIPTION_MAX,
  createSubtopic,
  createTopic,
  deleteTopic,
  draftOfSubtopic,
  draftOfTopic,
  overviewLength,
  reorderSubtopics,
  reorderTopics,
  updateTopic,
  validateSubtopicDraft,
  validateTopicDraft,
} from "@/features/content/topicService";
import type {
  SubtopicDraft,
  TopicDraft,
} from "@/features/content/topicService";
import { createMaterial } from "@/features/content/materialService";
import type { MaterialDraft } from "@/features/content/materialService";
import type { Subtopic, Topic } from "@/features/content/types";
import {
  ASSESSMENT_SLOT_CAPTIONS,
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABELS,
  EMPTY_ASSESSMENT_DRAFT,
  createAssessment,
} from "@/features/assessments/adminAssessmentService";
import type { AssessmentType } from "@/features/assessments/adminAssessmentService";
import { StagedMaterials } from "./StagedMaterials";
import { TopicMaterialsPanel } from "./TopicMaterialsPanel";
import { TopicAssessmentsPanel } from "./TopicAssessmentsPanel";

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

/**
 * What form is open, if any.
 *
 * One at a time across the whole panel, topics and sections alike: two forms
 * open at once is two drafts an author can lose track of, and the tree is what
 * they are reading to decide where anything goes.
 */
type Editing =
  | { mode: "new" }
  | { mode: "edit"; topic: Topic }
  | { mode: "new-subtopic"; parent: Topic }
  | { mode: "edit-subtopic"; subtopic: Subtopic; parent: Topic };

export function RoadmapTopicsPanel({
  roadmapId,
  roadmapTitle,
  topics,
  onChanged,
  initialExpandedTopicId = null,
}: {
  roadmapId: number;
  roadmapTitle: string;
  /** In the order students meet them. Owned by the page, not by this panel. */
  topics: Topic[];
  /** Reloads the catalogue after a write, so the page and server agree. */
  onChanged: () => void;
  /**
   * The topic to open on arrival — the one an author was in when they left for
   * the assessment builder. Read once, on mount; the page keys this panel on
   * the roadmap, so it is not carried into another one.
   */
  initialExpandedTopicId?: number | null;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The one topic that is open, if any. Held by id rather than by position, so
   * a reorder or a reload leaves the same topic open rather than whichever
   * topic has since moved into that slot.
   */
  const [expandedId, setExpandedId] = useState<number | null>(
    initialExpandedTopicId,
  );

  /**
   * The one section that is open, if any — the same rule as topics, and for
   * the same reason.
   *
   * Held apart from `expandedId` rather than folded into it because the two
   * are read differently. A topic's branch is drawn only while its card is
   * open, so a section is always opened from inside an open parent — and
   * opening it leaves that parent open, rather than folding away the very
   * branch the section sits on. Folding the parent closes the section with it.
   */
  const [expandedSubtopicId, setExpandedSubtopicId] = useState<number | null>(
    null,
  );

  const editingTopicId = editing?.mode === "edit" ? editing.topic.id : null;

  const toggle = (topicId: number) => {
    setExpandedSubtopicId(null);
    setExpandedId((current) => (current === topicId ? null : topicId));
  };

  const toggleSubtopic = (subtopicId: number) => {
    setExpandedSubtopicId((current) =>
      current === subtopicId ? null : subtopicId,
    );
  };

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
      // would open whatever the server hands back under that id next. The
      // sections inside it go with it, so an open one of those is stale too —
      // and this is the only place that knows the deletion happened.
      setExpandedId((current) => (current === topic.id ? null : current));
      setExpandedSubtopicId(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 flex-[1_1_12rem]">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
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
                  roadmapId={roadmapId}
                  position={index + 1}
                  busy={busy}
                  // An open form is never folded away out from under the author
                  // mid-edit, whatever else is open — the topic's own, or one of
                  // its sections', which is drawn inside the open card.
                  isExpanded={
                    expandedId === topic.id ||
                    editingTopicId === topic.id ||
                    (editing?.mode === "edit-subtopic" &&
                      editing.parent.id === topic.id)
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
                  onAddSubtopic={() => {
                    setEditing({ mode: "new-subtopic", parent: topic });
                    setExpandedId(topic.id);
                  }}
                  editingSubtopicId={
                    editing?.mode === "edit-subtopic" &&
                    editing.parent.id === topic.id
                      ? editing.subtopic.id
                      : null
                  }
                  onEditSubtopic={(subtopic) => {
                    setEditing({ mode: "edit-subtopic", subtopic, parent: topic });
                    setExpandedId(topic.id);
                  }}
                  onCloseSubtopicForm={() => setEditing(null)}
                  expandedSubtopicId={expandedSubtopicId}
                  onToggleSubtopic={toggleSubtopic}
                  onChanged={onChanged}
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

        <AddSubtopicDialog
          parent={editing?.mode === "new-subtopic" ? editing.parent : null}
          onClose={() => setEditing(null)}
          onCreated={(saved) => {
            setEditing(null);
            // Onto the section that was just written, open, with its materials
            // panel already mounted — that is the next thing an author does to
            // a section, and the dialog says so. The branch is drawn only
            // inside an open card, so the parent is opened around it.
            setExpandedId(saved.parentId);
            setExpandedSubtopicId(saved.id);
            onChanged();
          }}
        />

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
  roadmapId,
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
  onAddSubtopic,
  editingSubtopicId,
  onEditSubtopic,
  onCloseSubtopicForm,
  expandedSubtopicId,
  onToggleSubtopic,
  onChanged,
  children,
}: {
  topic: Topic;
  /** The roadmap the card is in, so the builder can bring the author back. */
  roadmapId: number;
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
  onAddSubtopic: () => void;
  /** Which of this topic's sections is being rewritten, if any. */
  editingSubtopicId: number | null;
  onEditSubtopic: (subtopic: Subtopic) => void;
  onCloseSubtopicForm: () => void;
  /** Which section anywhere in the panel is open, if any. */
  expandedSubtopicId: number | null;
  onToggleSubtopic: (subtopicId: number) => void;
  onChanged: () => void;
  /** The edit form, when this is the topic being edited. */
  children?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const contentId = `topic-${topic.id}-content`;

  return (
    <div
      className={`rounded-md border ${
        isExpanded
          ? "border-primary bg-accent/60"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="px-4 py-3 flex flex-wrap items-start gap-3">
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
          <div className="min-w-0 flex-[1_1_10rem]">
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
              size="sm"
              variant="ghost"
              className="text-primary hover:text-accent-foreground hover:bg-accent"
              aria-label={`Add subtopic to ${topic.title}`}
              disabled={busy}
              onClick={onAddSubtopic}
            >
              <Plus className="w-4 h-4 mr-1" />
              Subtopic
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

      {/* The sections inside this topic, drawn only while the card is open,
          like everything else on it: a folded card is one line, so a long
          roadmap reads as its topics alone. A section is therefore always
          opened from inside an open card, and opening it keeps that card open
          (see toggleSubtopic). */}
      {isExpanded && (
        <SubtopicTree
          parent={topic}
          parentPosition={position}
          busy={busy}
          editingSubtopicId={editingSubtopicId}
          onEditSubtopic={onEditSubtopic}
          onCloseSubtopicForm={onCloseSubtopicForm}
          expandedSubtopicId={expandedSubtopicId}
          onToggleSubtopic={onToggleSubtopic}
          onChanged={onChanged}
          onAddSubtopic={onAddSubtopic}
        />
      )}

      {/* Rendered only while open, so a folded card costs nothing and the
          materials panel inside fetches for the topic being worked on rather
          than for every topic in the roadmap. Materials are not part of what an
          edit replaces: they are the topic's own list, edited by their own
          panel, and an author retitling a topic has no reason to lose sight of
          them. */}
      {isExpanded && (
        <div
          id={contentId}
          className="border-t border-brand-teal/20 px-4 py-4 space-y-4 bg-white rounded-b-md"
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
                    className="text-primary hover:underline truncate"
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

          {/* A topic of the roadmap owns a pre-test and a post-test; a section
              never does, and the server refuses one. The guard is on the row
              itself rather than on where the card happens to be drawn. */}
          {topic.parentId === null && (
            <TopicAssessmentsPanel topicId={topic.id} roadmapId={roadmapId} />
          )}
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
      className="rounded-md border border-brand-teal/30 bg-accent/60 p-4 space-y-4"
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
   * Which tests to open alongside the topic, as empty drafts.
   *
   * Only ever a pair of booleans: a pre-test and a post-test are one each per
   * topic, the server refuses a second, and neither carries a field an author
   * fills in here — createAssessment names it after what it is and the
   * questions are written in the builder afterwards. So this asks the only
   * question the dialog can answer, which is whether to make them at all.
   */
  const [tests, setTests] = useState<Record<AssessmentType, boolean>>({
    pre_test: false,
    post_test: false,
  });

  /**
   * The materials written alongside the topic, held until there is a topic to
   * attach them to. Owned here rather than inside the list so that close()
   * blanks them with everything else.
   */
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);

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
    setTests({ pre_test: false, post_test: false });
    setMaterials([]);
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

    /*
     * The tests, once there is a topic to hang them on.
     *
     * After the topic and never with it: an assessment is its own row behind
     * its own endpoint, and the id it needs is the one the server just gave
     * back. Each is reported on its own — a test that could not be opened is
     * said out loud and leaves the topic, and any test that did open, exactly
     * where they are. The author finishes them in the builder either way, so a
     * refusal here costs a click rather than the work.
     */
    if (result.saved) {
      const topic = result.saved;

      // The materials first, in the order the group shows them and before the
      // tests, so the list a student reads is the list the author wrote.
      reportRefusedMaterials(
        await sendStagedMaterials(topic.id, materials),
        "topic",
      );

      for (const type of ASSESSMENT_TYPES) {
        if (!tests[type]) continue;

        try {
          await createAssessment(topic.id, {
            ...EMPTY_ASSESSMENT_DRAFT,
            type,
            title: ASSESSMENT_TYPE_LABELS[type],
          });
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : `Could not open a ${ASSESSMENT_TYPE_LABELS[type].toLowerCase()} for this topic.`,
          );
        }
      }
    }

    setSaving(false);
    setErrors(result.errors);

    // A refused draft keeps the modal open, with what was typed still in it and
    // the message under the box that has to change. Only a stored topic closes
    // it.
    if (result.saved) {
      toast.success("Topic added.");
      setDraft(EMPTY_TOPIC_DRAFT);
      setErrors({});
      setTests({ pre_test: false, post_test: false });
      setMaterials([]);
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
          {/*
            * The boxes scroll, the buttons do not.
            *
            * DialogContent is fixed and centred with no height of its own, so a
            * form taller than the window is clipped at both ends and neither
            * end can be reached — including the one with Cancel on it. Holding
            * the scroll here rather than on the dialog keeps the heading and
            * the footer where they are, and is where this app already puts it:
            * SubmissionResultsDialog scrolls its own list the same way.
            */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <TopicFields
              idPrefix="topic-add"
              draft={draft}
              errors={errors}
              onChange={(field, value) =>
                setDraft((current) => ({ ...current, [field]: value }))
              }
            />

            {/*
              * Its materials, written now and attached once the topic exists.
              *
              * Staged rather than sent: the API takes the owner's id in the
              * path, and there is no id until the topic has been created. The
              * list is remounted whenever the dialog opens so an abandoned
              * half-written material does not come back with the next topic.
              */}
            <StagedMaterials
              key={open ? "open" : "shut"}
              idPrefix="topic-add-material"
              materials={materials}
              onChange={setMaterials}
              caption="Added to the topic once it is created. Students see them in this order."
            />

            {/*
              * Its tests, offered here and made afterwards.
              *
              * Both open as drafts, which is the only thing they could be: the
              * questions are written in the builder, and nothing a student can
              * see changes until somebody publishes one. That is what makes
              * this safe to offer beside the title — ticking it costs a draft,
              * not a test anyone sits.
              *
              * Sections are not offered them. A subtopic cannot own an
              * assessment and the server refuses one, so AddSubtopicDialog has
              * no group like this.
              */}
            <fieldset className="space-y-2 border-t border-gray-200 pt-4">
              <legend className="text-sm font-medium text-gray-900">
                Assessments (optional)
              </legend>
              <p className="text-xs text-gray-600">
                Opened as drafts, ready for their questions. Students see
                neither until it is published.
              </p>

              {ASSESSMENT_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={tests[type]}
                    onChange={(e) =>
                      setTests((current) => ({
                        ...current,
                        [type]: e.target.checked,
                      }))
                    }
                    className="mt-1 rounded border-gray-300"
                  />
                  <span>
                    {ASSESSMENT_TYPE_LABELS[type]}
                    <span className="block text-xs text-gray-600">
                      {ASSESSMENT_SLOT_CAPTIONS[type]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

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

/**
 * The sections inside one topic, drawn as what they are.
 *
 * The whole job of this block is to say "these belong to the topic above" at a
 * glance, so it leans on three things at once rather than a label: the rows are
 * indented, a rule runs down the left of them from under the topic, and each
 * row is numbered inside its parent — 2.1, 2.2 — so a section can be named
 * without ambiguity and can never be read as topic 3.
 *
 * Opening a row continues that line one level further: the section's own
 * materials panel, indented past the row and hanging off a rule of its own.
 * Three levels is the whole depth of the thing — topic, section, materials —
 * and each one is drawn the same way, so the tree is read by its indentation
 * rather than by remembering what each box means.
 *
 * Reordering is the same pair of arrows a topic has, and calls the endpoint
 * scoped to this parent. Nothing here can move a topic, and the server refuses
 * it besides.
 */
function SubtopicTree({
  parent,
  parentPosition,
  busy,
  editingSubtopicId,
  onEditSubtopic,
  onCloseSubtopicForm,
  expandedSubtopicId,
  onToggleSubtopic,
  onChanged,
  onAddSubtopic,
}: {
  parent: Topic;
  parentPosition: number;
  busy: boolean;
  editingSubtopicId: number | null;
  onEditSubtopic: (subtopic: Subtopic) => void;
  onCloseSubtopicForm: () => void;
  expandedSubtopicId: number | null;
  onToggleSubtopic: (subtopicId: number) => void;
  onChanged: () => void;
  onAddSubtopic: () => void;
}) {
  const [moving, setMoving] = useState(false);

  // Undefined means the caller never asked for sections; empty means this topic
  // has none. Neither is worth drawing a tree for.
  const subtopics = parent.subtopics;

  if (subtopics === undefined || subtopics.length === 0) return null;

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...subtopics];
    const target = index + direction;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    setMoving(true);

    try {
      await reorderSubtopics(
        parent.id,
        next.map((subtopic) => subtopic.id),
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
    } finally {
      setMoving(false);
    }
  };

  const remove = async (subtopic: Subtopic) => {
    setMoving(true);

    try {
      await deleteTopic(subtopic.id);
      toast.success(`Removed “${subtopic.title}”.`);

      // Its materials panel goes with it. Left open, the id would be handed
      // to whatever row the server returns under it next.
      if (expandedSubtopicId === subtopic.id) onToggleSubtopic(subtopic.id);

      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="px-4 pb-3">
      {/* The indent and the rule are the hierarchy. The rule is inset past the
          topic's number badge, so it reads as descending from the topic rather
          than as a second column beside it. */}
      <ul className="ml-9 border-l-2 border-gray-200 space-y-1">
        {subtopics.map((subtopic, index) => (
          <li key={subtopic.id} className="relative pl-5">
            {/* The stub joining this row to the rule running down beside it. */}
            <span
              className="absolute left-0 top-5 w-4 border-t-2 border-gray-200"
              aria-hidden="true"
            />

            {editingSubtopicId === subtopic.id ? (
              <div className="py-1">
                <SubtopicEditForm
                  subtopic={subtopic}
                  onClose={onCloseSubtopicForm}
                  onSaved={() => {
                    onCloseSubtopicForm();
                    onChanged();
                  }}
                />
              </div>
            ) : (
              <SubtopicRow
                subtopic={subtopic}
                label={`${parentPosition}.${index + 1}`}
                busy={busy || moving}
                isExpanded={expandedSubtopicId === subtopic.id}
                isFirst={index === 0}
                isLast={index === subtopics.length - 1}
                onToggle={() => onToggleSubtopic(subtopic.id)}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onEdit={() => onEditSubtopic(subtopic)}
                onDelete={() => remove(subtopic)}
              />
            )}

            {/* The third level of the tree, and the last one: this section's
                materials. Mounted only while the section is open, which is
                what keeps it a fetch for the one section being worked on
                rather than for every section in the roadmap — the same rule
                the topic card follows for its own panel.

                Indented past the row and given a rule of its own, so the panel
                reads as hanging off this section rather than off the topic the
                branch descends from. The panel brings its own card border; the
                rule is the only thing added around it, because a box inside a
                box inside a card is the noise this tree is meant to avoid. */}
            {expandedSubtopicId === subtopic.id &&
              editingSubtopicId !== subtopic.id && (
                <div
                  id={`subtopic-${subtopic.id}-materials`}
                  className="ml-3 mt-2 mb-3 border-l-2 border-brand-teal/30 pl-4"
                >
                  <TopicMaterialsPanel topicId={subtopic.id} owner="section" />
                </div>
              )}
          </li>
        ))}
      </ul>

      <div className="ml-9 pl-5 mt-1">
        <Button
          size="sm"
          variant="ghost"
          className="text-primary hover:text-accent-foreground hover:bg-accent h-7 px-2"
          disabled={busy || moving}
          onClick={onAddSubtopic}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add another subtopic
        </Button>
      </div>
    </div>
  );
}

/**
 * One section: what it is called, where it sits, and what can be done to it.
 *
 * The materials are behind a named button, not behind the title. An author
 * looking at a section has to be able to see that its materials are theirs to
 * edit without clicking anything to find out — a title that happens to be a
 * disclosure is a feature nobody discovers, and a section with nothing in it
 * looks identical to one that cannot hold anything.
 *
 * The count rides on that button rather than sitting apart from it, so the
 * thing that says how many there are is the thing that opens them. It stays put
 * whether the panel is open or shut: shut, it is the only word on whether a
 * section holds anything, which is what an author scanning a roadmap for gaps
 * is reading; open, holding it steady keeps the row from resizing under the
 * pointer that just clicked it.
 */
function SubtopicRow({
  subtopic,
  label,
  busy,
  isExpanded,
  isFirst,
  isLast,
  onToggle,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: {
  subtopic: Subtopic;
  /** Its number inside its parent, like "2.1". */
  label: string;
  busy: boolean;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const count = subtopic.materials.length;

  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        isExpanded
          ? "border-brand-teal/50 bg-accent/60"
          : "border-gray-200 bg-gray-50/70"
      }`}
    >
      <div className="flex items-start gap-2">
        <CornerDownRight
          className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 break-words">
            <span className="text-xs text-gray-500 tabular-nums mr-2">
              {label}
            </span>
            {subtopic.title}
          </p>

          {subtopic.description && (
            <p className="text-xs text-gray-600 mt-0.5 break-words">
              {subtopic.description}
            </p>
          )}

          {/* The section's own three acts, named. Reordering stays in the
              corner with the topic's, because moving a section is about the
              list it sits in rather than about the section itself. */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant={isExpanded ? "secondary" : "outline"}
              className="h-7 px-2 text-xs"
              aria-expanded={isExpanded}
              aria-controls={`subtopic-${subtopic.id}-materials`}
              aria-label={`${
                isExpanded ? "Hide" : "Show"
              } learning materials for ${subtopic.title} (${count})`}
              disabled={busy}
              onClick={onToggle}
            >
              <FileText className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Materials
              <span
                className="ml-1.5 text-gray-500 tabular-nums"
                aria-hidden="true"
              >
                · {count}
              </span>
              <span className="ml-1" aria-hidden="true">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              aria-label={`Edit ${subtopic.title}`}
              disabled={busy}
              onClick={onEdit}
            >
              <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              aria-label={`Delete ${subtopic.title}`}
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Delete
            </Button>
          </div>

          {confirming && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-700">
                Delete this subtopic? Its learning materials and their files go
                with it. The topic holding it stays.
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

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={`Move ${subtopic.title} up`}
            disabled={isFirst || busy}
            onClick={onUp}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={`Move ${subtopic.title} down`}
            disabled={isLast || busy}
            onClick={onDown}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The two boxes a section is written in.
 *
 * Title and overview, and no video field — see SubtopicDraft for why. The
 * overview counter and its limit are the topic form's, because it is the same
 * column with the same server rule behind it.
 */
function SubtopicFields({
  idPrefix,
  draft,
  errors,
  onChange,
}: {
  idPrefix: string;
  draft: SubtopicDraft;
  errors: Record<string, string>;
  onChange: <K extends keyof SubtopicDraft>(
    field: K,
    value: SubtopicDraft[K],
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
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${idPrefix}-overview`}>Overview (optional)</Label>
          <OverviewCounter idPrefix={idPrefix} text={draft.description} />
        </div>
        <Input
          id={`${idPrefix}-overview`}
          value={draft.description}
          aria-describedby={`${idPrefix}-overview-count`}
          onChange={(e) => onChange("description", e.target.value)}
        />
        <p className="text-xs text-gray-600">
          The line that says what this section covers. Students read it above
          the section&rsquo;s materials.
        </p>
        {errors.description && <FieldError message={errors.description} />}
      </div>
    </>
  );
}

/**
 * Checks a section's draft, writes it, and turns a refusal into field messages.
 *
 * The same shape as saveTopicDraft, against the section's own rules. There is
 * no video box here for a server error to land under, so the API's field names
 * are used as they arrive.
 */
async function saveSubtopicDraft<T>(
  draft: SubtopicDraft,
  save: (draft: SubtopicDraft) => Promise<T>,
): Promise<
  | { saved: true; value: T; errors: Record<string, string> }
  | { saved: false; errors: Record<string, string> }
> {
  const found = validateSubtopicDraft(draft);

  if (Object.keys(found).length > 0) return { saved: false, errors: found };

  try {
    // Handed back rather than dropped: the dialog opens the section it just
    // wrote, which means it needs the id the server gave it.
    return { saved: true, value: await save(draft), errors: {} };
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
      return {
        saved: false,
        errors: Object.fromEntries(
          Object.entries(e.errors).map(([field, messages]) => [
            field,
            messages[0],
          ]),
        ),
      };
    }

    toast.error(e instanceof Error ? e.message : "Could not save.");
    return { saved: false, errors: {} };
  }
}

/**
 * Attaches what was staged to the row that now exists.
 *
 * One at a time, in the order they were written. The server appends each
 * material to the end of its owner's list, so sending them together would
 * store them in whatever order the requests happened to land — which is not
 * the order the author put them in.
 *
 * Nothing is rolled back and nothing is retried. The row is already stored and
 * a material that would not go is the author's to add again from the panel that
 * has always done it; undoing a topic because its third handout was refused
 * would throw away the part that worked. So each failure is collected and named
 * rather than thrown, and the ones that did store stay where they are.
 *
 * @returns what could not be stored, in the order they were staged.
 */
async function sendStagedMaterials(
  topicId: number,
  materials: MaterialDraft[],
): Promise<RefusedMaterial[]> {
  const refused: RefusedMaterial[] = [];

  // Which titles are worn by more than one of these, worked out before any of
  // them goes: it is the whole staged list that makes a title ambiguous, not
  // the handful that happen to be refused.
  const titles = materials.map((material) => material.title);
  const duplicated = new Set(
    titles.filter((title, at) => titles.indexOf(title) !== at),
  );

  for (const [index, material] of materials.entries()) {
    try {
      await createMaterial(topicId, material);
    } catch (e) {
      refused.push({
        title: material.title,
        position: duplicated.has(material.title) ? index + 1 : null,
        reason: refusalReason(e),
      });
    }
  }

  return refused;
}

/** A staged material the server would not take, and what it said about it. */
interface RefusedMaterial {
  title: string;
  /**
   * Its number in the staged list, or null when the title says which it is.
   *
   * Two materials may be written under one title — nothing forbids it, and the
   * list numbers them rather than naming them — so "could not be stored:
   * Diagram" identifies nothing when there are two of those. The number is the
   * one shown against the row, so it points at a line the author can see.
   */
  position: number | null;
  reason: string;
}

/** What to say when the refusal carried nothing a person can act on. */
const UNEXPLAINED_REFUSAL = "Unable to store this material";

/**
 * The server's own words for why it refused a material, or a safe fallback.
 *
 * Read in the order MaterialForm reads them: Laravel names the field it
 * rejected, so a 422's field message is the most specific thing there is, and
 * ApiError's own message — the API's `message`, or one written for the status
 * when the body was not the API's JSON at all — is the next best. Neither is
 * ever a stack trace or an error page: api.ts builds both.
 *
 * Anything that is not an ApiError did not come back from the API, so none of
 * it is repeated to the author; it is a fault in this app, and its message is
 * written for whoever is fixing that rather than for whoever is adding a PDF.
 */
function refusalReason(error: unknown): string {
  if (!(error instanceof ApiError)) return UNEXPLAINED_REFUSAL;

  const field = Object.values(error.errors)[0]?.[0];
  // Trimmed of its full stop: it is quoted inside a sentence that brings one.
  const said = (field ?? error.message).trim().replace(/[.;,]+$/, "");

  return said === "" ? UNEXPLAINED_REFUSAL : said;
}

/**
 * Says what would not go, and why, once the row itself is safely stored.
 *
 * Deliberately not phrased as a failure: the topic or section exists, and so
 * does everything else that went with it. What is left is a short list and
 * where to finish it.
 *
 * The reason is carried because by this point it is the only thing that can be
 * acted on. Everything an author can be told before sending has already been
 * asked by validateDraft, so a material that reaches here was refused for
 * something only the server knows — the type of the file, a limit lower than
 * this build expects, a disk that would not take it — and "could not be
 * stored" alone leaves them to guess which.
 */
function reportRefusedMaterials(
  refused: RefusedMaterial[],
  owner: string,
): void {
  if (refused.length === 0) return;

  const named = refused
    .map(
      ({ title, position, reason }) =>
        `${position === null ? "" : `${position}. `}"${title}" — ${reason}`,
    )
    .join("; ");

  toast.error(
    `The ${owner} was created, but ${refused.length === 1 ? "one material could" : `${refused.length} materials could`} not be stored: ` +
      `${named}. Add ${refused.length === 1 ? "it" : "them"} from the ${owner}'s learning materials.`,
  );
}

/** Rewriting a section, in the row that section already occupies. */
function SubtopicEditForm({
  subtopic,
  onClose,
  onSaved,
}: {
  subtopic: Subtopic;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<SubtopicDraft>(() =>
    draftOfSubtopic(subtopic),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    /*
     * Saved through the topic endpoint, because a section is a topic row and
     * this is the same edit. Only the two fields this form carries are sent:
     * updateTopic builds its payload from the draft it is given, and a form
     * that silently cleared a column it never showed would lose an author's
     * work without ever mentioning it.
     */
    const result = await saveSubtopicDraft(draft, (next) =>
      updateTopic(subtopic.id, {
        ...next,
        videoUrl: "",
      }),
    );

    setSaving(false);
    setErrors(result.errors);

    if (result.saved) {
      toast.success("Subtopic saved.");
      onSaved();
    }
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Edit subtopic"
      className="rounded-md border border-brand-teal/30 bg-accent/60 p-3 space-y-3"
    >
      <SubtopicFields
        idPrefix="subtopic-edit"
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
 * Adding a section, in a modal over the roadmap.
 *
 * The same centred modal a topic is added in, so the two acts read alike — but
 * it names the topic it is adding to in its own description, because that is
 * the one thing an author has to be sure of before they start typing.
 */
function AddSubtopicDialog({
  parent,
  onClose,
  onCreated,
}: {
  /** The topic being added to, or null while the modal is shut. */
  parent: Topic | null;
  onClose: () => void;
  /** The section that was written, so the caller can open it. */
  onCreated: (saved: Topic) => void;
}) {
  const [draft, setDraft] = useState<SubtopicDraft>(EMPTY_SUBTOPIC_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** The section's own materials, held until the section exists to hold them. */
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);

  const close = () => {
    setDraft(EMPTY_SUBTOPIC_DRAFT);
    setErrors({});
    setMaterials([]);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (parent === null) return;

    setSaving(true);

    const result = await saveSubtopicDraft(draft, (next) =>
      createSubtopic(parent.id, next),
    );

    // A section owns its materials exactly as a topic does — same endpoint,
    // same ordering — so the same sequencing serves both.
    if (result.saved) {
      reportRefusedMaterials(
        await sendStagedMaterials(result.value.id, materials),
        "subtopic",
      );
    }

    setSaving(false);
    setErrors(result.errors);

    if (result.saved) {
      toast.success("Subtopic added.");
      setDraft(EMPTY_SUBTOPIC_DRAFT);
      setErrors({});
      setMaterials([]);
      onCreated(result.value);
    }
  };

  return (
    <Dialog
      open={parent !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Subtopic</DialogTitle>
          <DialogDescription>
            A section inside &ldquo;{parent?.title}&rdquo;. It joins the end of
            that topic&rsquo;s sections and opens straight onto its own learning
            materials, ready to take a video, a link or a file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} aria-label="Add subtopic" className="space-y-4">
          {/* Scrolled here rather than on the dialog, for the reason given in
              AddTopicDialog: the footer has to stay reachable. */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <SubtopicFields
              idPrefix="subtopic-add"
              draft={draft}
              errors={errors}
              onChange={(field, value) =>
                setDraft((current) => ({ ...current, [field]: value }))
              }
            />

            {/* A section owns its materials the same way a topic does — the
                endpoint takes either — so the same staging serves both. It is
                remounted per opening, keyed on the parent this dialog is for. */}
            <StagedMaterials
              key={parent ? `open-${parent.id}` : "shut"}
              idPrefix="subtopic-add-material"
              materials={materials}
              onChange={setMaterials}
              caption="Added to the section once it is created. Students see them in this order."
            />
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Add subtopic"}
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
