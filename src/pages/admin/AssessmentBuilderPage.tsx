import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, ClipboardList, Lock, Pencil } from "lucide-react";
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
  draftOfAssessment,
  fetchAssessment,
  lockStateOf,
  updateAssessment,
  validateAssessmentDraft,
} from "@/features/assessments/adminAssessmentService";
import type {
  Assessment,
  AssessmentDraft,
  AssessmentLockState,
  AssessmentQuestion,
} from "@/features/assessments/adminAssessmentService";

/**
 * Building one of a topic's assessments.
 *
 * A page of its own rather than a panel inside the roadmap: an assessment is a
 * list of questions, each with four choices, and that does not fit inside a
 * topic's card without crowding out the topic.
 *
 * What an author can change here is the title and the description, which stay
 * editable for the assessment's whole life. The questions are shown as they are
 * stored, answer key included, and whether they could still be changed is said
 * rather than left to be discovered: a published assessment's questions are
 * locked until it is unpublished, and a taken one's are locked for good. Both
 * locks are the server's; the notice is here so an author is not surprised by
 * a refusal.
 */

const ROADMAP_PATH = "/admin/roadmap";

/** The id in the address, or null when the address names no assessment. */
function parseAssessmentId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;

  const id = Number(raw);

  return id > 0 ? id : null;
}

export function AssessmentBuilderPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const id = parseAssessmentId(assessmentId);

  // An address with no usable id is not worth a request: it can only 404.
  const load = useCallback(
    () => (id === null ? Promise.resolve(null) : fetchAssessment(id)),
    [id],
  );
  const { data, error, loading, reload } = useAsync(load, [id]);

  const [editing, setEditing] = useState(false);

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
        <LockNotice state={lockStateOf(data)} />
        <QuestionList questions={data.questions ?? []} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Above every state, so the way out is there whether the assessment
          loaded, failed, or is still on its way. */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(ROADMAP_PATH)}>
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

function QuestionList({ questions }: { questions: AssessmentQuestion[] }) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">Questions</CardTitle>
      </CardHeader>

      <CardContent>
        {ordered.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description="This assessment has no questions, and it cannot be published until it has at least one."
          />
        ) : (
          <ol className="space-y-3">
            {ordered.map((question, index) => (
              <li key={question.id}>
                <QuestionCard question={question} number={index + 1} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

const CHOICE_LETTERS = ["A", "B", "C", "D"];

/** One question as it is stored, answer key included — read-only. */
function QuestionCard({
  question,
  number,
}: {
  question: AssessmentQuestion;
  number: number;
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
