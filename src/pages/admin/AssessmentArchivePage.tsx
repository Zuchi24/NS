import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Archive, ArchiveRestore, BarChart3, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/AsyncStates";
import { ApiError } from "@/services/api";
import { shortDate } from "@/services/time";
import { useAsync } from "@/services/useAsync";
import { fetchRoadmaps } from "@/features/content/contentService";
import {
  ASSESSMENT_TYPE_LABELS,
  deleteAssessment,
  fetchArchivedAssessments,
  restoreAssessment,
  versionLabel,
} from "@/features/assessments/adminAssessmentService";
import type {
  ArchivedAssessment,
  AssessmentType,
} from "@/features/assessments/adminAssessmentService";
import {
  archiveTypeOfSlug,
  archivedAssessmentBuilderPath,
} from "@/features/assessments/assessmentPaths";
import { AssessmentResultsPanel } from "./AssessmentResultsPanel";

/**
 * The archive: archived versions of one type, across every topic.
 *
 * Versions, not slots. Each row is one assessment version by its own id,
 * because results belong to the exact version they were taken on — so View,
 * Results, Restore and Delete all act on that id and never on "the pre-test".
 *
 * Nothing here deletes on its own. The scheduled purge (a server job) may
 * remove an untaken version 30 days after it was archived, and the page only
 * says whether it is eligible. Delete is an author's explicit act, offered only
 * on untaken versions, and sent with `expected: "archived"` so a version
 * another author has restored since is refused rather than removed.
 *
 * Restore puts a version back as an unpublished draft. Publishing it is the
 * Roadmap's business, never this page's.
 *
 * Which type is in the address (`:type`, pre-test or post-test). The topic,
 * taken filter and page are in the query string, so Back and a refresh keep
 * them.
 */

/** "Archived pre-tests" — the type label, lowercased as the admin UI writes it. */
function heading(type: AssessmentType): string {
  return `Archived ${ASSESSMENT_TYPE_LABELS[type].toLowerCase()}s`;
}

function positiveInt(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  return value > 0 && Number.isSafeInteger(value) ? value : null;
}

/** The taken filter as the address spells it, and as the API reads it. */
const TAKEN_OPTIONS = [
  { value: "", label: "All", taken: undefined },
  { value: "yes", label: "Taken", taken: true },
  { value: "no", label: "Never taken", taken: false },
] as const;

export function AssessmentArchivePage() {
  const { type: slug } = useParams();
  const type = archiveTypeOfSlug(slug);

  if (type === null) {
    return (
      <EmptyState
        title="No such archive"
        description="Choose Pre-Test or Post-Test under Archive in the sidebar."
      />
    );
  }

  // Keyed on the type so switching archives starts a fresh list.
  return <ArchiveOfType key={type} type={type} />;
}

function ArchiveOfType({ type }: { type: AssessmentType }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const topicId = positiveInt(searchParams.get("topic"));
  const takenValue = TAKEN_OPTIONS.find((option) => option.value === (searchParams.get("taken") ?? ""))
    ?? TAKEN_OPTIONS[0];
  const page = positiveInt(searchParams.get("page")) ?? 1;

  /** Writes filters into the address. Any filter change goes back to page 1. */
  const setQuery = (next: { topic?: number | null; taken?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    const set = (key: string, value: string | null) =>
      value === null || value === "" ? params.delete(key) : params.set(key, value);

    if ("topic" in next) set("topic", next.topic ? String(next.topic) : null);
    if ("taken" in next) set("taken", next.taken ?? null);
    set("page", next.page && next.page > 1 ? String(next.page) : null);

    setSearchParams(params);
  };

  const loadList = useCallback(
    () => fetchArchivedAssessments({ type, topicId: topicId ?? undefined, taken: takenValue.taken, page }),
    [type, topicId, takenValue.taken, page],
  );
  const list = useAsync(loadList, [loadList]);

  // Roots only: an assessment belongs to a topic of a roadmap, never a section.
  const topics = useAsync(async () => {
    const roadmaps = await fetchRoadmaps();

    return roadmaps.flatMap((roadmap) =>
      roadmap.topics
        .filter((topic) => topic.parentId === null)
        .map((topic) => ({ id: topic.id, label: `${roadmap.title} › ${topic.title}` })),
    );
  }, []);

  // A page emptied by a restore or delete steps back to the last one that has
  // rows, rather than showing "nothing archived" with more behind it.
  useEffect(() => {
    if (list.data && list.data.items.length === 0 && list.data.total > 0 && page > 1) {
      setQuery({ page: Math.max(1, list.data.lastPage) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  const [busy, setBusy] = useState<{ id: number; kind: "restore" | "delete" } | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [resultsId, setResultsId] = useState<number | null>(null);

  // The disabled buttons are what an author sees; this is what actually stops
  // a second request going out before the next render.
  const inFlight = useRef(false);

  const act = async (
    version: ArchivedAssessment,
    kind: "restore" | "delete",
    request: () => Promise<void>,
  ) => {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy({ id: version.id, kind });

    try {
      await request();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        // Somebody else restored, deleted or changed it since this list was
        // read. Not retried — the list is read again, and that is the answer.
        toast.error(
          "This assessment was changed by another administrator. The Archive list has been refreshed.",
        );
        list.reload();
      } else {
        toast.error(e instanceof Error ? e.message : "That did not go through.");
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const restore = (version: ArchivedAssessment) =>
    act(version, "restore", async () => {
      await restoreAssessment(version.id);
      toast.success(
        `${versionLabel(version)} of “${version.topic.title}” restored as an unpublished draft. Publish it from the Roadmap.`,
      );
      list.reload();
    });

  const remove = (version: ArchivedAssessment) =>
    act(version, "delete", async () => {
      setConfirmingId(null);
      await deleteAssessment(version.id, { expected: "archived" });
      toast.success(`Deleted ${versionLabel(version)} of “${version.topic.title}”.`);
      list.reload();
    });

  const data = list.data;

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Archive className="w-5 h-5 text-blue-600" aria-hidden="true" />
          {heading(type)}
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Archived versions are read-only, and every student result on them is
          kept. A version nobody has taken becomes eligible for the scheduled
          purge 30 days after it was archived; a version students have taken is
          kept for good.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label htmlFor="archive-topic">Topic</Label>
            <select
              id="archive-topic"
              value={topicId ?? ""}
              onChange={(event) => setQuery({ topic: positiveInt(event.target.value) })}
              className="h-10 min-w-64 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All topics</option>
              {(topics.data ?? []).map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="archive-taken">Taken</Label>
            <select
              id="archive-taken"
              value={takenValue.value}
              onChange={(event) => setQuery({ taken: event.target.value })}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {TAKEN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {list.loading && data === null && <LoadingState label="Loading the archive…" />}

        {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

        {data !== null && !list.error && (
          <div className="space-y-3" aria-busy={list.loading || undefined}>
            {list.loading && (
              <p role="status" className="text-xs text-gray-500">
                Refreshing…
              </p>
            )}

            {data.items.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No archived {ASSESSMENT_TYPE_LABELS[type].toLowerCase()}s
                {topicId !== null || takenValue.taken !== undefined ? " match these filters" : " yet"}.
              </p>
            ) : (
              <ul className="space-y-2" aria-label={heading(type)}>
                {data.items.map((version) => (
                  <li key={version.id}>
                    <ArchivedRow
                      version={version}
                      busy={busy !== null}
                      working={busy?.id === version.id ? busy.kind : null}
                      confirming={confirmingId === version.id}
                      showingResults={resultsId === version.id}
                      onView={() => navigate(archivedAssessmentBuilderPath(version.id, type))}
                      onResults={() =>
                        setResultsId((current) => (current === version.id ? null : version.id))
                      }
                      onRestore={() => void restore(version)}
                      onDelete={() => setConfirmingId(version.id)}
                      onConfirmDelete={() => void remove(version)}
                      onCancelDelete={() => setConfirmingId(null)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {data.lastPage > 1 && (
              <nav
                aria-label="Archive pages"
                className="flex items-center justify-between gap-3 pt-2 text-sm text-gray-600"
              >
                <span>
                  Page {data.page} of {data.lastPage} · {data.total} archived
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page <= 1 || list.loading}
                    onClick={() => setQuery({ page: data.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page >= data.lastPage || list.loading}
                    onClick={() => setQuery({ page: data.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Where a version stands with the scheduled purge, in words. */
function PurgeStatus({ version }: { version: ArchivedAssessment }) {
  if (version.attemptsCount > 0 || version.purge.eligibleAt === null) {
    return (
      <span className="text-xs font-medium rounded px-1.5 py-0.5 border text-gray-700 bg-white border-gray-200">
        Kept — has student results
      </span>
    );
  }

  if (version.purge.eligible) {
    return (
      <span className="text-xs font-medium rounded px-1.5 py-0.5 border text-amber-700 bg-amber-50 border-amber-200">
        Eligible for deletion
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-600">
      <span className="font-medium rounded px-1.5 py-0.5 border text-gray-600 bg-gray-50 border-gray-200">
        Not yet eligible
      </span>{" "}
      Eligible on {shortDate(version.purge.eligibleAt)}
    </span>
  );
}

function ArchivedRow({
  version,
  busy,
  working,
  confirming,
  showingResults,
  onView,
  onResults,
  onRestore,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  version: ArchivedAssessment;
  /** Some action on the page is in flight. */
  busy: boolean;
  /** The action in flight on this row, if any. */
  working: "restore" | "delete" | null;
  confirming: boolean;
  showingResults: boolean;
  onView: () => void;
  onResults: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const nameId = `archived-version-${version.id}-name`;
  const taken = version.attemptsCount > 0;
  const kind = ASSESSMENT_TYPE_LABELS[version.type];

  return (
    <div className="rounded border border-gray-100 bg-gray-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p id={nameId} className="text-sm text-gray-700 break-words">
            <span className="font-semibold text-gray-900">
              {kind} {versionLabel(version)}
            </span>
            {" · "}
            <span>{version.title}</span>
          </p>
          <p className="text-xs text-gray-600">
            {version.roadmap.title} › {version.topic.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            <span>Archived {shortDate(version.archivedAt)}</span>
            <span>
              {version.attemptsCount} attempt{version.attemptsCount === 1 ? "" : "s"}
            </span>
            <span>
              {version.questionsCount} question{version.questionsCount === 1 ? "" : "s"}
            </span>
            <PurgeStatus version={version} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" aria-describedby={nameId} onClick={onView}>
            <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-describedby={nameId}
            aria-expanded={showingResults}
            onClick={onResults}
          >
            <BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" />
            {showingResults ? "Hide results" : "Results"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-describedby={nameId}
            disabled={busy}
            aria-busy={working === "restore" || undefined}
            onClick={onRestore}
          >
            <ArchiveRestore className="w-4 h-4 mr-2" aria-hidden="true" />
            {working === "restore" ? "Restoring…" : "Restore"}
          </Button>
          {!taken && (
            <Button
              size="sm"
              variant="ghost"
              aria-describedby={nameId}
              disabled={busy}
              aria-busy={working === "delete" || undefined}
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 mr-2 text-red-600" aria-hidden="true" />
              {working === "delete" ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label={`Delete ${kind} ${versionLabel(version)} of “${version.topic.title}”?`}
          className="rounded-md border border-red-200 bg-red-50/60 p-3 space-y-2"
        >
          <p className="text-xs text-gray-700">
            Permanently delete {kind} {versionLabel(version)} of “{version.topic.title}”? No
            student has taken this version. Its questions and choices are removed,
            and this cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={onConfirmDelete}>
              Delete permanently
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* This version's own results — by its id, never the slot's live one. */}
      {showingResults && <AssessmentResultsPanel assessmentId={version.id} />}
    </div>
  );
}
