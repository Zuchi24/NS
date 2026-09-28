import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Archive, ArchiveRestore, ClipboardList, Copy, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_SLOT_CAPTIONS,
  ASSESSMENT_TYPE_LABELS,
  EMPTY_ASSESSMENT_DRAFT,
  archiveAssessment,
  createAssessment,
  createAssessmentVersion,
  fetchTopicAssessments,
  publishAssessment,
  restoreAssessment,
  versionLabel,
} from "@/features/assessments/adminAssessmentService";
import type {
  Assessment,
  AssessmentType,
} from "@/features/assessments/adminAssessmentService";
import { assessmentBuilderPath } from "@/features/assessments/assessmentPaths";

/**
 * A root topic's pre-test and post-test, from inside its open card.
 *
 * Discovery and a way in. A topic has two slots, and each slot holds versions:
 * the panel always draws the same two slots and lists, for each, the versions
 * it has — which one students are offered, which are drafts, which have been
 * taken and so are read-only — with the moves each version has. An empty slot
 * offers to create its first version. The questions, and their answer key, are
 * the builder's business; the listing this reads carries counts and nothing
 * else.
 *
 * Creating a version — the first, or a copy of an existing one — writes a
 * draft and goes straight to the builder, because a new version is the thing
 * an author is about to fill in or change. Nothing is assumed about what was
 * created: the page moves only once the server has answered with it, and a
 * refusal leaves the author here with the server's reason.
 *
 * Publishing, archiving and restoring happen here, in place: each is one
 * request, and the list is read again afterwards so it shows what the server
 * holds — publishing one version retires another, which this list would
 * otherwise have to guess at.
 *
 * Only ever mounted for a topic of the roadmap. A section cannot own an
 * assessment — the server refuses it — and the topic card is where that is
 * kept from being offered.
 */

const CREATE_LABEL: Record<AssessmentType, string> = {
  pre_test: "Create pre-test",
  post_test: "Create post-test",
};

/** A refusal about the fields of a create, held against the slot it came from. */
type Refusal = { type: AssessmentType; messages: string[] };

/** One request in flight against the panel: what it is, and against what. */
type Busy =
  | { kind: "create"; type: AssessmentType }
  | { kind: "version"; type: AssessmentType }
  | { kind: "publish" | "archive" | "restore"; id: number };

function counted(count: number | null, noun: string): string {
  if (count === null) return `${noun}s not counted`;

  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The version a new one is copied from: the one students are offered, or —
 * with none offered — the newest one still in use, or the newest of all.
 */
function copySource(versions: Assessment[]): Assessment | null {
  return (
    versions.find((version) => version.isPublished) ??
    [...versions].reverse().find((version) => version.archivedAt === null) ??
    versions[versions.length - 1] ??
    null
  );
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

  // Archived versions come too: the panel shows them, folded away, so that
  // restoring one is possible from here.
  const load = useCallback(
    () => fetchTopicAssessments(topicId, { includeArchived: true }),
    [topicId],
  );
  const { data, error, loading, reload } = useAsync(load, [topicId]);

  const [busy, setBusy] = useState<Busy | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  // The disabled button is what an author sees; this is what actually stops a
  // second request, which state alone cannot do before the next render.
  const inFlight = useRef(false);

  const builderPath = (assessmentId: number) =>
    assessmentBuilderPath(assessmentId, { roadmapId, topicId });

  /** Runs one request at a time; a refusal is shown, and the list re-read. */
  const run = async (next: Busy, request: () => Promise<void>) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(next);
    setRefusal(null);

    try {
      await request();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not go through.");

      // A refusal is most often this list being out of date — another author
      // published, archived or created a version first. Read it again so the
      // slot shows what the server holds.
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        reload();
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const create = async (type: AssessmentType) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy({ kind: "create", type });
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
      setBusy(null);
    }
  };

  const newVersion = (type: AssessmentType, from: Assessment) =>
    run({ kind: "version", type }, async () => {
      const created = await createAssessmentVersion(from.id);

      toast.success(
        `${versionLabel(created)} of the ${ASSESSMENT_TYPE_LABELS[type].toLowerCase()} created as a draft, copied from ${versionLabel(from)}.`,
      );
      navigate(builderPath(created.id));
    });

  const publish = (version: Assessment) =>
    run({ kind: "publish", id: version.id }, async () => {
      await publishAssessment(version.id);
      toast.success(`${versionLabel(version)} is now the version students take.`);
      reload();
    });

  const archive = (version: Assessment) =>
    run({ kind: "archive", id: version.id }, async () => {
      await archiveAssessment(version.id);
      toast.success(`${versionLabel(version)} archived. Its results are kept.`);
      reload();
    });

  const restore = (version: Assessment) =>
    run({ kind: "restore", id: version.id }, async () => {
      await restoreAssessment(version.id);
      toast.success(`${versionLabel(version)} restored, unpublished.`);
      reload();
    });

  const byType = (type: AssessmentType) =>
    (data ?? [])
      .filter((assessment) => assessment.type === type)
      .sort((a, b) => a.version - b.version);

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" aria-hidden="true" />
          Assessments
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          This topic&apos;s pre-test and post-test. Each starts as a draft that
          students cannot see. Once students have taken a version it is
          read-only; create a new version to change it.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && <LoadingState label="Loading assessments…" />}

        {error && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && (
          <ul className="space-y-2">
            {ASSESSMENT_TYPES.map((type) => (
              <li key={type}>
                <AssessmentSlot
                  topicId={topicId}
                  type={type}
                  versions={byType(type)}
                  busy={busy}
                  refusal={refusal?.type === type ? refusal.messages : null}
                  onCreate={() => create(type)}
                  onNewVersion={(from) => newVersion(type, from)}
                  onOpen={(version) => navigate(builderPath(version.id))}
                  onPublish={publish}
                  onArchive={archive}
                  onRestore={restore}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ version }: { version: Assessment }) {
  const [label, tone] = version.isPublished
    ? ["Published", "text-emerald-700 bg-emerald-50 border-emerald-200"]
    : version.archivedAt
      ? ["Archived", "text-gray-600 bg-gray-50 border-gray-200"]
      : ["Draft", "text-amber-700 bg-amber-50 border-amber-200"];

  return (
    <span className={`text-xs font-medium rounded px-1.5 py-0.5 border ${tone}`}>
      {label}
    </span>
  );
}

function AssessmentSlot({
  topicId,
  type,
  versions,
  busy,
  refusal,
  onCreate,
  onNewVersion,
  onOpen,
  onPublish,
  onArchive,
  onRestore,
}: {
  topicId: number;
  type: AssessmentType;
  /** Every version of this slot, archived ones included, oldest first. */
  versions: Assessment[];
  /** The request in flight, if any — this slot's or another's. */
  busy: Busy | null;
  refusal: string[] | null;
  onCreate: () => void;
  onNewVersion: (from: Assessment) => void;
  onOpen: (version: Assessment) => void;
  onPublish: (version: Assessment) => void;
  onArchive: (version: Assessment) => void;
  onRestore: (version: Assessment) => void;
}) {
  const label = ASSESSMENT_TYPE_LABELS[type];
  const headingId = `topic-${topicId}-${type}-heading`;
  const [showArchived, setShowArchived] = useState(false);

  const inUse = versions.filter((version) => version.archivedAt === null);
  const archived = versions.filter((version) => version.archivedAt !== null);
  const source = copySource(versions);

  const creating = busy?.kind === "create" && busy.type === type;
  const copying = busy?.kind === "version" && busy.type === type;

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

          {versions.length === 0 && (
            <>
              <p className="text-sm text-gray-500">Not created yet</p>
              <p className="text-xs text-gray-500">
                {ASSESSMENT_SLOT_CAPTIONS[type]}
              </p>
            </>
          )}
        </div>

        {source === null ? (
          <Button
            size="sm"
            disabled={busy !== null}
            aria-busy={creating || undefined}
            onClick={onCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? "Creating…" : CREATE_LABEL[type]}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            aria-busy={copying || undefined}
            aria-describedby={headingId}
            title={`Copies ${versionLabel(source)} into a new draft`}
            onClick={() => onNewVersion(source)}
          >
            <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
            {copying ? "Creating…" : "New version"}
          </Button>
        )}
      </div>

      {inUse.length > 0 && (
        <ul className="space-y-2" aria-label={`${label} versions`}>
          {inUse.map((version) => (
            <li key={version.id}>
              <VersionRow
                version={version}
                busy={busy}
                onOpen={() => onOpen(version)}
                onPublish={() => onPublish(version)}
                onArchive={() => onArchive(version)}
                onRestore={() => onRestore(version)}
              />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="text-xs text-gray-600 underline underline-offset-2"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((shown) => !shown)}
          >
            {showArchived ? "Hide" : "Show"} {archived.length} archived{" "}
            {archived.length === 1 ? "version" : "versions"}
          </button>

          {showArchived && (
            <ul className="space-y-2" aria-label={`Archived ${label.toLowerCase()} versions`}>
              {archived.map((version) => (
                <li key={version.id}>
                  <VersionRow
                    version={version}
                    busy={busy}
                    onOpen={() => onOpen(version)}
                    onPublish={() => onPublish(version)}
                    onArchive={() => onArchive(version)}
                    onRestore={() => onRestore(version)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

/**
 * One version: its number, where it stands, its counts, and the moves it has.
 *
 * Publish while it is an unarchived draft; archive while it is unpublished and
 * in use; restore while archived. The builder opens for every version — a
 * taken or archived one opens read-only there, and results are read there too.
 */
function VersionRow({
  version,
  busy,
  onOpen,
  onPublish,
  onArchive,
  onRestore,
}: {
  version: Assessment;
  busy: Busy | null;
  onOpen: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const nameId = `assessment-version-${version.id}-name`;
  const readOnly = (version.attemptsCount ?? 0) > 0 || version.archivedAt !== null;
  const doing = (kind: "publish" | "archive" | "restore") =>
    busy?.kind === kind && busy.id === version.id;

  return (
    <div className="rounded border border-gray-100 bg-gray-50/60 p-2 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <p id={nameId} className="text-sm text-gray-700 break-words">
          <span className="font-semibold text-gray-900">{versionLabel(version)}</span>
          {version.isPublished && <span className="text-gray-600"> (Active)</span>}
          {" · "}
          <span>{version.title}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
          <StatusBadge version={version} />
          {readOnly && (
            <span className="text-xs font-medium rounded px-1.5 py-0.5 border text-gray-600 bg-white border-gray-200">
              Read-only
            </span>
          )}
          <span>{counted(version.questionsCount, "question")}</span>
          <span>{counted(version.attemptsCount, "attempt")}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Named by their visible words; the version name says which one. */}
        <Button size="sm" variant="outline" aria-describedby={nameId} onClick={onOpen}>
          Open builder
        </Button>

        {!version.isPublished && version.archivedAt === null && (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-describedby={nameId}
              disabled={busy !== null}
              aria-busy={doing("publish") || undefined}
              onClick={onPublish}
            >
              <Send className="w-4 h-4 mr-2" aria-hidden="true" />
              {doing("publish") ? "Publishing…" : "Publish"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-describedby={nameId}
              disabled={busy !== null}
              aria-busy={doing("archive") || undefined}
              onClick={onArchive}
            >
              <Archive className="w-4 h-4 mr-2" aria-hidden="true" />
              {doing("archive") ? "Archiving…" : "Archive"}
            </Button>
          </>
        )}

        {version.archivedAt !== null && (
          <Button
            size="sm"
            variant="outline"
            aria-describedby={nameId}
            disabled={busy !== null}
            aria-busy={doing("restore") || undefined}
            onClick={onRestore}
          >
            <ArchiveRestore className="w-4 h-4 mr-2" aria-hidden="true" />
            {doing("restore") ? "Restoring…" : "Restore"}
          </Button>
        )}
      </div>
    </div>
  );
}
