import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  ASSESSMENT_TYPE_LABELS,
  EMPTY_QUESTION_DRAFT,
  createQuestion,
  deleteAssessment,
  deleteQuestion,
  draftOfAssessment,
  draftOfQuestion,
  fetchAssessment,
  lockStateOf,
  publishAssessment,
  reorderQuestions,
  unpublishAssessment,
  updateAssessment,
  updateQuestion,
  validateAssessmentDraft,
  validateQuestionDraft,
} from "@/features/assessments/adminAssessmentService";
import type {
  Assessment,
  AssessmentChoiceDraft,
  AssessmentDraft,
  AssessmentLockState,
  AssessmentQuestion,
  AssessmentQuestionDraft,
} from "@/features/assessments/adminAssessmentService";
import {
  readRoadmapContext,
  roadmapAdminPath,
} from "@/features/assessments/assessmentPaths";

/**
 * Building one of a topic's assessments.
 *
 * A page of its own rather than a panel inside the roadmap: an assessment is a
 * list of questions, each with four choices, and that does not fit inside a
 * topic's card without crowding out the topic.
 *
 * Title and description stay editable for the assessment's whole life. The
 * questions are authored here too — written, rewritten, deleted and put in
 * order — but only while nothing has settled them: a published assessment's
 * questions are locked until it is unpublished, and a taken one's are locked
 * for good. Both locks are the server's. The page reads them to decide what to
 * offer, and when a write is refused anyway — another author published it, a
 * student submitted it — it shows the server's reason and reloads, so what is
 * on screen is the lock as it now stands rather than as it was.
 *
 * Its release is here as well: publishing, unpublishing, and deleting one that
 * nobody has taken. Publishing is refused by the server until every question is
 * complete, and the page does not second-guess that — it shows the refusal. A
 * taken assessment is never deleted, and unpublishing one withdraws it from
 * students without unlocking its questions.
 */

/** The id in the address, or null when the address names no assessment. */
function parseAssessmentId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);

  return id > 0 ? id : null;
}

/**
 * A refusal that says this page is out of date rather than that the input was
 * wrong: 409 once the assessment has been taken, and a 422 carrying no field
 * errors once it has been published (or its questions changed under a reorder).
 * Either way the answer is the same — say why, and read the assessment again.
 */
function isStaleRefusal(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    Object.keys(e.errors).length === 0 &&
    (e.status === 409 || e.status === 422)
  );
}

export function AssessmentBuilderPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const id = parseAssessmentId(assessmentId);

  // Back to where the author came from: the roadmap and topic the builder was
  // opened from ride along in the address, and it is the plain roadmap page
  // when they do not.
  const [searchParams] = useSearchParams();
  const roadmapPath = roadmapAdminPath(readRoadmapContext(searchParams));

  // An address with no usable id is not worth a request: it can only 404.
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchAssessment(id)),
    [id],
  );
  const { data, error, loading, reload } = useAsync(load, [id]);

  const [editing, setEditing] = useState(false);

  /*
   * Publishing, unpublishing and deleting the assessment itself.
   *
   * Held here rather than in the release card: a refusal that reloads the page
   * has to outlive the reload to be read, and the card is unmounted while the
   * assessment loads again where this component is not.
   */
  const [releasing, setReleasing] = useState<ReleaseAction | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // The disabled buttons are what an author sees; this is what actually stops a
  // second publish or delete going out before the next render.
  const releaseInFlight = useRef(false);

  const release = async (assessment: Assessment, action: ReleaseAction) => {
    if (releaseInFlight.current) return;

    releaseInFlight.current = true;
    setReleasing(action);
    setReleaseError(null);

    try {
      if (action === "publish") {
        await publishAssessment(assessment.id);
        toast.success(`“${assessment.title}” is published. Students can open it.`);
        reload();
      } else if (action === "unpublish") {
        await unpublishAssessment(assessment.id);
        toast.success(
          `“${assessment.title}” is unpublished. Students can no longer open it.`,
        );
        reload();
      } else {
        await deleteAssessment(assessment.id);
        toast.success(`Deleted “${assessment.title}”.`);
        // Back to the roadmap and topic it was opened from, where its slot now
        // offers to create it again.
        navigate(roadmapPath);
      }
    } catch (e) {
      // The server's own words: it names what is incomplete, or that the
      // assessment has been taken, better than this page could.
      setReleaseError(
        e instanceof Error ? e.message : "Could not change this assessment.",
      );

      // Out of date rather than refused on its merits — taken since the page
      // loaded (409), or gone altogether (404) — so read it again. A publish
      // refused because a question is incomplete is not: the page is right and
      // the assessment is not ready, so everything on it, open forms included,
      // stays as it was.
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        reload();
      }
    } finally {
      releaseInFlight.current = false;
      setReleasing(null);
    }
  };

  let body: React.ReactNode;

  if (loading) {
    body = <LoadingState label="Loading assessment…" />;
  } else if (error) {
    body = <ErrorState message={error} onRetry={reload} />;
  } else if (data === null) {
    body = (
      <EmptyState
        title="No such assessment"
        description="This address does not name an assessment. Open it from its topic on the roadmap."
      />
    );
  } else {
    body = (
      <>
        <AssessmentHeader
          assessment={data}
          editing={editing}
          onEdit={() => setEditing(true)}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
        <ReleaseCard
          assessment={data}
          releasing={releasing}
          error={releaseError}
          onPublish={() => void release(data, "publish")}
          onUnpublish={() => void release(data, "unpublish")}
          onDelete={() => void release(data, "delete")}
        />
        <LockNotice state={lockStateOf(data)} />
        <QuestionList assessment={data} onChanged={reload} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Above every state, so the way out is there whether the assessment
          loaded, failed, or is still on its way. */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(roadmapPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to roadmap
        </Button>
      </div>

      {body}
    </div>
  );
}

function PublicationBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <span
      className={`text-xs font-medium rounded px-1.5 py-0.5 border ${
        isPublished
          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
          : "text-amber-700 bg-amber-50 border-amber-200"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function AssessmentHeader({
  assessment,
  editing,
  onEdit,
  onClose,
  onSaved,
}: {
  assessment: Assessment;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const questionCount =
    assessment.questions?.length ?? assessment.questionsCount ?? 0;

  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium rounded px-1.5 py-0.5 border text-blue-700 bg-blue-50 border-blue-200">
              {ASSESSMENT_TYPE_LABELS[assessment.type]}
            </span>
            <PublicationBadge isPublished={assessment.isPublished} />
          </div>

          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />
            {assessment.title}
          </CardTitle>

          {assessment.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {assessment.description}
            </p>
          ) : (
            <p className="text-sm text-gray-500">No description.</p>
          )}
        </div>

        {/* Never locked: title and description do not change what a student's
            result was measured against. */}
        <Button size="sm" variant="outline" onClick={onEdit} disabled={editing}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit details
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="flex flex-wrap gap-6">
          <div>
            <dt className="text-xs font-semibold text-gray-600">Questions</dt>
            <dd className="text-gray-900 font-medium" data-testid="question-count">
              {questionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-gray-600">Attempts</dt>
            <dd className="text-gray-900 font-medium" data-testid="attempt-count">
              {assessment.attemptsCount ?? "Not counted"}
            </dd>
          </div>
        </dl>

        {editing && (
          <DetailsForm
            key={assessment.id}
            assessment={assessment}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** A move on the assessment itself, as against on one of its questions. */
type ReleaseAction = "publish" | "unpublish" | "delete";

/** Where the assessment stands with students, in a sentence. */
function releaseStatus(assessment: Assessment): string {
  const taken = (assessment.attemptsCount ?? 0) > 0;

  if (assessment.isPublished) {
    return taken
      ? "Published. Students can open it, and some have already taken it."
      : "Published. Students can open it.";
  }

  return taken
    ? "Draft. It has been withdrawn from students, and the results of those who took it are kept."
    : "Draft. Students cannot see it until it is published.";
}

/**
 * Putting the assessment in front of students, taking it back, or removing it.
 *
 * Only the moves this assessment actually has. Publish while it is a draft —
 * including one withdrawn after being taken, which the server allows — and
 * unpublish while it is out. Delete only while nobody has taken it, and hidden
 * rather than disabled once somebody has: that never changes back, so a
 * greyed-out button would be promising something that does not arrive.
 */
function ReleaseCard({
  assessment,
  releasing,
  error,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  assessment: Assessment;
  releasing: ReleaseAction | null;
  error: string | null;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState<"unpublish" | "delete" | null>(
    null,
  );

  const busy = releasing !== null;
  const taken = (assessment.attemptsCount ?? 0) > 0;
  // Only when the server counted nobody: an uncounted total is no promise that
  // the delete would be allowed.
  const deletable = assessment.attemptsCount === 0;
  const kind = ASSESSMENT_TYPE_LABELS[assessment.type].toLowerCase();

  const confirm =
    confirming === "delete"
      ? {
          question: `Delete “${assessment.title}”?`,
          detail: `This removes the ${kind} from its topic, with all of its questions and choices. It cannot be undone.`,
          verb: "Delete assessment",
          destructive: true,
          run: onDelete,
        }
      : confirming === "unpublish"
        ? {
            question: `Unpublish “${assessment.title}”?`,
            detail: taken
              ? "Students can no longer open it. Their results are kept, and its questions stay locked because it has been taken."
              : "Students can no longer open it, and its questions can be edited again.",
            verb: "Unpublish",
            destructive: false,
            run: onUnpublish,
          }
        : null;

  return (
    <Card
      className="border-gray-200"
      role="region"
      aria-labelledby="assessment-release-title"
    >
      <CardHeader>
        <CardTitle id="assessment-release-title" className="text-lg">
          Release
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700">{releaseStatus(assessment)}</p>

        <div className="flex flex-wrap items-center gap-2">
          {assessment.isPublished ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming("unpublish")}
            >
              <EyeOff className="w-4 h-4 mr-2" />
              {releasing === "unpublish" ? "Unpublishing…" : "Unpublish assessment"}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setConfirming(null);
                onPublish();
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              {releasing === "publish" ? "Publishing…" : "Publish assessment"}
            </Button>
          )}

          {deletable && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming("delete")}
            >
              <Trash2 className="w-4 h-4 mr-2 text-red-600" />
              {releasing === "delete" ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>

        {taken && (
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
            This assessment cannot be deleted because students have attempted
            it. Unpublish it to withdraw it instead.
          </p>
        )}

        {confirm && (
          <div
            role="alertdialog"
            aria-label={confirm.question}
            className={`rounded-md border p-3 space-y-2 ${
              confirm.destructive
                ? "border-red-200 bg-red-50/60"
                : "border-blue-200 bg-blue-50/50"
            }`}
          >
            <p className="text-xs text-gray-700">
              {confirm.question} {confirm.detail}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={confirm.destructive ? "destructive" : "default"}
                disabled={busy}
                onClick={() => {
                  setConfirming(null);
                  confirm.run();
                }}
              >
                {confirm.verb}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirming(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Why the questions cannot be changed, for each way they can be locked. */
const LOCK_COPY: Record<Exclude<AssessmentLockState, "editable">, string> = {
  published:
    "This assessment is published, so its questions and choices cannot be changed. Unpublishing it lifts the lock. Its title and description can still be edited.",
  taken:
    "Students have already taken this assessment, so its questions and choices can no longer be changed — their results were scored against them. Its title and description can still be edited.",
  published_and_taken:
    "This assessment is published and students have already taken it, so its questions and choices can no longer be changed, even if it is unpublished. Its title and description can still be edited.",
};

function LockNotice({ state }: { state: AssessmentLockState }) {
  if (state === "editable") return null;

  return (
    <div
      role="note"
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2"
    >
      <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <p>{LOCK_COPY[state]}</p>
    </div>
  );
}

function DetailsForm({
  assessment,
  onClose,
  onSaved,
}: {
  assessment: Assessment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<AssessmentDraft>(() =>
    draftOfAssessment(assessment),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AssessmentDraft>(
    field: K,
    value: AssessmentDraft[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here so the author is told which box to fix without a round trip.
    // The server checks all of it again and has the final say.
    const found = validateAssessmentDraft(draft);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      await updateAssessment(assessment.id, draft);
      toast.success("Assessment details saved.");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        const fields = Object.fromEntries(
          Object.entries(e.errors).map(([field, messages]) => [
            field,
            messages[0],
          ]),
        );

        setErrors(fields);

        // A refusal about a field this form does not have would otherwise land
        // under no box at all.
        if (!("title" in fields) && !("description" in fields)) {
          toast.error(e.message);
        }
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
      noValidate
      aria-label="Edit assessment details"
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="assessment-title">Title</Label>
        <Input
          id="assessment-title"
          value={draft.title}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "assessment-title-error" : undefined}
          onChange={(e) => set("title", e.target.value)}
        />
        {errors.title && (
          <FieldError id="assessment-title-error" message={errors.title} />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="assessment-description">Description (optional)</Label>
        <Textarea
          id="assessment-description"
          value={draft.description}
          rows={4}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? "assessment-description-error" : undefined
          }
          onChange={(e) => set("description", e.target.value)}
        />
        <p className="text-xs text-gray-600">
          Instructions students read above the questions.
        </p>
        {errors.description && (
          <FieldError
            id="assessment-description-error"
            message={errors.description}
          />
        )}
      </div>

      <p className="text-xs text-gray-600">
        Whether this is the pre-test or the post-test is fixed once it exists.
      </p>

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

/** Which question form is open, if any. One at a time, like every other list. */
type QuestionEditing = { mode: "new" } | { mode: "edit"; questionId: number };

/**
 * The questions, and — while the assessment is editable — writing them.
 *
 * While it is locked nothing here offers a write at all: no add, no edit, no
 * delete, no reorder. The lock notice above says why. Hidden rather than
 * disabled, because a taken assessment never unlocks and a greyed-out button
 * would be promising something that does not arrive.
 *
 * Every write reloads the whole assessment afterwards rather than patching the
 * list: the server decides a new question's place and renumbers after a delete,
 * and the page shows what it stored.
 */
function QuestionList({
  assessment,
  onChanged,
}: {
  assessment: Assessment;
  onChanged: () => void;
}) {
  const ordered = [...(assessment.questions ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const authoring = lockStateOf(assessment) === "editable";

  const [editing, setEditing] = useState<QuestionEditing | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // The disabled buttons are what an author sees; this is what actually stops
  // a second reorder or delete going out before the next render.
  const inFlight = useRef(false);

  const formOpen = editing !== null;

  /** One list-level write at a time, reloading on success or a stale refusal. */
  const write = async (action: () => Promise<void>, fallback: string) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);

    try {
      await action();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallback);

      if (isStaleRefusal(e)) onChanged();
    } finally {
      inFlight.current = false;
      setBusy(false);
      setConfirmingId(null);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= ordered.length) return;

    // The whole order, as the server insists: what is stored is the list the
    // author is looking at, not a guess assembled from one move.
    const ids = ordered.map((question) => question.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    void write(async () => {
      await reorderQuestions(assessment.id, ids);
    }, "Could not reorder the questions.");
  };

  const remove = (question: AssessmentQuestion, number: number) =>
    void write(async () => {
      await deleteQuestion(question.id);
      toast.success(`Question ${number} deleted.`);
    }, "Could not delete the question.");

  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <CardTitle className="text-lg">Questions</CardTitle>

        {authoring && (
          <Button
            size="sm"
            disabled={formOpen || busy}
            onClick={() => {
              setConfirmingId(null);
              setEditing({ mode: "new" });
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add question
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {ordered.length === 0 && !(authoring && editing?.mode === "new") && (
          <EmptyState
            title="No questions yet."
            description={
              authoring
                ? "Add your first question."
                : "This assessment is locked, so questions cannot be added to it."
            }
          />
        )}

        {ordered.length > 0 && (
          <ol className="space-y-3">
            {ordered.map((question, index) => {
              const number = index + 1;

              return (
                <li key={question.id}>
                  {authoring &&
                  editing?.mode === "edit" &&
                  editing.questionId === question.id ? (
                    <QuestionForm
                      key={question.id}
                      assessmentId={assessment.id}
                      question={question}
                      number={number}
                      onClose={() => setEditing(null)}
                      onSaved={onChanged}
                      onStale={onChanged}
                    />
                  ) : (
                    <QuestionCard question={question} number={number}>
                      {authoring && (
                        <QuestionControls
                          number={number}
                          isFirst={index === 0}
                          isLast={index === ordered.length - 1}
                          // A reload under an open form would take the
                          // author's unsaved typing with it.
                          disabled={busy || formOpen}
                          busy={busy}
                          confirming={confirmingId === question.id}
                          onUp={() => move(index, -1)}
                          onDown={() => move(index, 1)}
                          onEdit={() => {
                            setConfirmingId(null);
                            setEditing({ mode: "edit", questionId: question.id });
                          }}
                          onAskDelete={() => setConfirmingId(question.id)}
                          onCancelDelete={() => setConfirmingId(null)}
                          onDelete={() => remove(question, number)}
                        />
                      )}
                    </QuestionCard>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {authoring && editing?.mode === "new" && (
          <QuestionForm
            key="new"
            assessmentId={assessment.id}
            question={null}
            number={ordered.length + 1}
            onClose={() => setEditing(null)}
            onSaved={onChanged}
            onStale={onChanged}
          />
        )}
      </CardContent>
    </Card>
  );
}

function QuestionControls({
  number,
  isFirst,
  isLast,
  disabled,
  busy,
  confirming,
  onUp,
  onDown,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  number: number;
  isFirst: boolean;
  isLast: boolean;
  /** A write is out, or a form is open. */
  disabled: boolean;
  /** A write is out. */
  busy: boolean;
  confirming: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move question ${number} up`}
          disabled={isFirst || disabled}
          onClick={onUp}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move question ${number} down`}
          disabled={isLast || disabled}
          onClick={onDown}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Edit question ${number}`}
          disabled={disabled}
          onClick={onEdit}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete question ${number}`}
          disabled={disabled}
          onClick={onAskDelete}
        >
          <Trash2 className="w-4 h-4 mr-2 text-red-600" />
          Delete
        </Button>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label={`Delete question ${number}?`}
          className="rounded-md border border-red-200 bg-red-50/60 p-3 space-y-2"
        >
          <p className="text-xs text-gray-700">
            Delete question {number}? Its four choices go with it, and this
            cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const CHOICE_LETTERS = ["A", "B", "C", "D"];

/** A blank question, with the first choice marked correct to start from. */
function newQuestionDraft(): AssessmentQuestionDraft {
  return {
    ...EMPTY_QUESTION_DRAFT,
    choices: EMPTY_QUESTION_DRAFT.choices.map((choice, index) => ({
      ...choice,
      isCorrect: index === 0,
    })),
  };
}

/**
 * Where a server field error belongs in the question form.
 *
 * A choice's label keeps its own key, so the message sits under that choice. A
 * complaint about the set, or about a choice as a whole or its is_correct flag,
 * goes under the choices together — there is no separate box for any of those.
 */
function questionFieldOf(field: string): string {
  if (/^choices\.\d+\.label$/.test(field)) return field;
  if (field === "choices" || field.startsWith("choices.")) return "choices";

  return field;
}

const QUESTION_FORM_FIELD = /^(prompt|points|choices|choices\.\d+\.label)$/;

/** One question being written, new or existing. */
function QuestionForm({
  assessmentId,
  question,
  number,
  onClose,
  onSaved,
  onStale,
}: {
  assessmentId: number;
  question: AssessmentQuestion | null;
  number: number;
  onClose: () => void;
  onSaved: () => void;
  /** The server says the page is out of date — reload it. */
  onStale: () => void;
}) {
  const isNew = question === null;
  const prefix = isNew ? "question-new" : `question-${question.id}`;

  const [draft, setDraft] = useState<AssessmentQuestionDraft>(() =>
    question === null ? newQuestionDraft() : draftOfQuestion(question),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const setChoice = (index: number, patch: Partial<AssessmentChoiceDraft>) =>
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((choice, at) =>
        at === index ? { ...choice, ...patch } : choice,
      ),
    }));

  // One correct answer: choosing one un-chooses the rest.
  const markCorrect = (index: number) =>
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((choice, at) => ({
        ...choice,
        isCorrect: at === index,
      })),
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (inFlight.current) return;

    // Checked here so the author is told which box to fix without a round trip,
    // and what they typed stays where it is. The server checks all of it again
    // and has the final say.
    const found = validateQuestionDraft(draft);

    if (Object.keys(found).length > 0) {
      // Keyed as Laravel keys them (`choices.2.label`), which is a string key
      // like any other to the error state this form keeps.
      setErrors(found as Record<string, string>);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setSaving(true);

    try {
      if (question === null) {
        await createQuestion(assessmentId, draft);
        toast.success("Question added.");
      } else {
        await updateQuestion(question.id, draft);
        toast.success(`Question ${number} saved.`);
      }

      onSaved();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        const fields: Record<string, string> = {};

        for (const [field, messages] of Object.entries(e.errors)) {
          const key = questionFieldOf(field);

          if (fields[key] === undefined && messages[0]) fields[key] = messages[0];
        }

        setErrors(fields);

        // A refusal about nothing this form has would otherwise land nowhere.
        if (!Object.keys(fields).some((key) => QUESTION_FORM_FIELD.test(key))) {
          toast.error(e.message);
        }
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save the question.");

        if (isStaleRefusal(e)) onStale();
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const describedBy = (key: string) =>
    errors[key] ? `${prefix}-${key.replace(/\./g, "-")}-error` : undefined;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={isNew ? "Add question" : `Edit question ${number}`}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-prompt`}>Prompt</Label>
        <Textarea
          id={`${prefix}-prompt`}
          value={draft.prompt}
          rows={3}
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={describedBy("prompt")}
          onChange={(e) => setDraft((current) => ({ ...current, prompt: e.target.value }))}
        />
        {errors.prompt && (
          <FieldError id={describedBy("prompt")!} message={errors.prompt} />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-points`}>Points</Label>
        <Input
          id={`${prefix}-points`}
          inputMode="numeric"
          className="w-24"
          value={draft.points}
          aria-invalid={errors.points ? true : undefined}
          aria-describedby={describedBy("points")}
          onChange={(e) => setDraft((current) => ({ ...current, points: e.target.value }))}
        />
        {errors.points && (
          <FieldError id={describedBy("points")!} message={errors.points} />
        )}
      </div>

      <fieldset className="space-y-2" aria-describedby={describedBy("choices")}>
        <legend className="text-sm font-medium text-gray-900">Choices</legend>
        <p className="text-xs text-gray-600">
          Four choices. Select the one that is correct.
        </p>

        {draft.choices.map((choice, index) => {
          const letter = CHOICE_LETTERS[index] ?? String(index + 1);
          const labelKey = `choices.${index}.label`;
          const inputId = `${prefix}-choice-${index}`;

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${prefix}-correct`}
                  checked={choice.isCorrect}
                  onChange={() => markCorrect(index)}
                  aria-label={`Choice ${letter} is correct`}
                  className="h-4 w-4 shrink-0 accent-emerald-600"
                />
                <Label htmlFor={inputId} className="w-16 shrink-0">
                  Choice {letter}
                </Label>
                <Input
                  id={inputId}
                  value={choice.label}
                  aria-invalid={errors[labelKey] ? true : undefined}
                  aria-describedby={describedBy(labelKey)}
                  onChange={(e) => setChoice(index, { label: e.target.value })}
                />
              </div>
              {errors[labelKey] && (
                <FieldError id={describedBy(labelKey)!} message={errors[labelKey]} />
              )}
            </div>
          );
        })}

        {errors.choices && (
          <FieldError id={describedBy("choices")!} message={errors.choices} />
        )}
      </fieldset>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add question" : "Save question"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** One question as it is stored, answer key included. */
function QuestionCard({
  question,
  number,
  children,
}: {
  question: AssessmentQuestion;
  number: number;
  /** The authoring controls, while the assessment is editable. */
  children?: React.ReactNode;
}) {
  const choices = [...question.choices].sort((a, b) => a.order - b.order);

  return (
    <article
      aria-label={`Question ${number}`}
      data-testid={`question-${question.id}`}
      className="rounded-md border border-gray-200 p-3 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-gray-600">Question {number}</p>
          <p className="text-sm text-gray-900 whitespace-pre-line">
            {question.prompt}
          </p>
        </div>

        <span className="text-xs text-gray-600 whitespace-nowrap">
          {question.points === 1 ? "1 point" : `${question.points} points`}
        </span>
      </div>

      <ul aria-label={`Choices for question ${number}`} className="space-y-1.5">
        {choices.map((choice, index) => (
          <li
            key={choice.id}
            className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-sm ${
              choice.isCorrect
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-gray-200 text-gray-700"
            }`}
          >
            <span className="font-medium tabular-nums w-5">
              {CHOICE_LETTERS[index] ?? index + 1}.
            </span>
            <span className="flex-1 min-w-0">{choice.label}</span>
            {/* Said in words as well as colour, so the key does not depend on
                telling green from grey. */}
            {choice.isCorrect && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Correct answer
              </span>
            )}
          </li>
        ))}
      </ul>

      {children}
    </article>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}
