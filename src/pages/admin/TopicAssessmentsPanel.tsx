import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABELS,
  EMPTY_ASSESSMENT_DRAFT,
  createAssessment,
  fetchTopicAssessments,
} from "@/features/assessments/adminAssessmentService";
import type {
  Assessment,
  AssessmentType,
} from "@/features/assessments/adminAssessmentService";
import { assessmentBuilderPath } from "@/features/assessments/assessmentPaths";

/**
 * A root topic's pre-test and post-test, from inside its open card.
 *
 * Discovery and a way in — nothing more. A topic holds at most one of each, so
 * the panel always draws the same two slots and says, for each, whether it
 * exists: an empty slot offers to create it, a filled one says where it stands
 * and opens the builder. The questions, and their answer key, are the builder's
 * business; the listing this reads carries counts and nothing else.
 *
 * Creating writes a draft and goes straight to the builder, because an
 * assessment with no questions is the thing an author is about to fill in.
 * Nothing is assumed about what was created: the page moves only once the
 * server has answered with it, and a refusal leaves the author here with the
 * server's reason.
 *
 * Only ever mounted for a topic of the roadmap. A section cannot own an
 * assessment — the server refuses it — and the topic card is where that is
 * kept from being offered.
 */

const CREATE_LABEL: Record<AssessmentType, string> = {
  pre_test: "Create pre-test",
  post_test: "Create post-test",
};

/** Where each one sits in the topic, in the words an author would use. */
const SLOT_CAPTION: Record<AssessmentType, string> = {
  pre_test: "Taken before the subtopics, as a diagnostic.",
  post_test: "Taken after the subtopics.",
};

/** A refusal about the fields of a create, held against the slot it came from. */
type Refusal = { type: AssessmentType; messages: string[] };

function counted(count: number | null, noun: string): string {
  if (count === null) return `${noun}s not counted`;

  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function TopicAssessmentsPanel({
  topicId,
  roadmapId,
}: {
  topicId: number;
  /** Carried to the builder, so its Back link returns to this roadmap. */
  roadmapId: number;
}) {
  const navigate = useNavigate();

  const load = useCallback(() => fetchTopicAssessments(topicId), [topicId]);
  const { data, error, loading, reload } = useAsync(load, [topicId]);

  const [creating, setCreating] = useState<AssessmentType | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  // The disabled button is what an author sees; this is what actually stops a
  // second request, which state alone cannot do before the next render.
  const inFlight = useRef(false);

  const builderPath = (assessmentId: number) =>
    assessmentBuilderPath(assessmentId, { roadmapId, topicId });

  const create = async (type: AssessmentType) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setCreating(type);
    setRefusal(null);

    const label = ASSESSMENT_TYPE_LABELS[type];

    try {
      // A draft, always: the payload has no publish flag, and the server would
      // refuse one. Titled after what it is, so it is recognisable in the list
      // until the author gives it a better name in the builder.
      const created = await createAssessment(topicId, {
        ...EMPTY_ASSESSMENT_DRAFT,
        type,
        title: label,
      });

      if (created.topicId !== topicId || created.type !== type) {
        // Not the assessment that was asked for. Nothing is made of it — the
        // list is read again, and the server's answer is what gets shown.
        toast.error(
          `The server did not confirm a new ${label.toLowerCase()} for this topic. The list has been refreshed.`,
        );
        reload();
        return;
      }

      toast.success(`${label} created as a draft.`);
      navigate(builderPath(created.id));
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        // This panel has no boxes to put them under, so they go against the
        // slot the create was for.
        setRefusal({
          type,
          messages: Object.values(e.errors)
            .map((messages) => messages[0])
            .filter((message): message is string => Boolean(message)),
        });
      } else {
        toast.error(
          e instanceof Error ? e.message : `Could not create the ${label.toLowerCase()}.`,
        );

        // A refusal with no field behind it is most often this list being out
        // of date — someone else created that one first. Read it again so the
        // slot shows what the server holds rather than offering the same
        // refused create twice.
        if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
          reload();
        }
      }
    } finally {
      inFlight.current = false;
      setCreating(null);
    }
  };

  const byType = new Map((data ?? []).map((assessment) => [assessment.type, assessment]));

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />
          Assessments
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          This topic&apos;s pre-test and post-test. Each starts as a draft that
          students cannot see.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && <LoadingState label="Loading assessments…" />}

        {error && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && (
          <ul className="space-y-2">
            {ASSESSMENT_TYPES.map((type) => {
              const assessment = byType.get(type) ?? null;

              return (
                <li key={type}>
                  <AssessmentSlot
                    topicId={topicId}
                    type={type}
                    assessment={assessment}
                    creating={creating === type}
                    locked={creating !== null}
                    refusal={refusal?.type === type ? refusal.messages : null}
                    onCreate={() => create(type)}
                    onOpen={() => assessment && navigate(builderPath(assessment.id))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
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

function AssessmentSlot({
  topicId,
  type,
  assessment,
  creating,
  locked,
  refusal,
  onCreate,
  onOpen,
}: {
  topicId: number;
  type: AssessmentType;
  assessment: Assessment | null;
  /** This slot's create is the one in flight. */
  creating: boolean;
  /** Some create is in flight, this one or the other. */
  locked: boolean;
  refusal: string[] | null;
  onCreate: () => void;
  onOpen: () => void;
}) {
  const label = ASSESSMENT_TYPE_LABELS[type];
  const headingId = `topic-${topicId}-${type}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-gray-200 p-3 space-y-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h4 id={headingId} className="text-sm font-semibold text-gray-900">
            {label}
          </h4>

          {assessment ? (
            <>
              <p className="text-sm text-gray-700 break-words">
                {assessment.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                <StatusBadge isPublished={assessment.isPublished} />
                <span>{counted(assessment.questionsCount, "question")}</span>
                <span>{counted(assessment.attemptsCount, "attempt")}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Not created yet</p>
              <p className="text-xs text-gray-500">{SLOT_CAPTION[type]}</p>
            </>
          )}
        </div>

        {assessment ? (
          // Named by its visible words; the slot heading says which one.
          <Button
            size="sm"
            variant="outline"
            aria-describedby={headingId}
            onClick={onOpen}
          >
            Open builder
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={locked}
            aria-busy={creating || undefined}
            onClick={onCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Creating…" : CREATE_LABEL[type]}
          </Button>
        )}
      </div>

      {refusal && refusal.length > 0 && (
        <div role="alert" className="text-xs text-red-600 space-y-0.5">
          {refusal.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </section>
  );
}
