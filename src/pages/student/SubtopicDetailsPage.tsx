import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchSubtopic } from "@/features/content/contentService";
import type { SubtopicDetail } from "@/features/content/contentService";
import { MaterialList } from "@/features/content/components/MaterialList";
import {
  completeSubtopic,
  fetchTopicProgression,
  openNextSubtopic,
  subtopicStatus,
} from "@/features/content/progressionService";
import type { TopicProgression } from "@/features/content/progressionService";
import type { Subtopic } from "@/features/content/types";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";

/**
 * One section of a topic, on a page of its own.
 *
 * A section used to be drawn inside its topic, which meant a topic page grew
 * with every section added to it and a student had no way to point at one part
 * of it. So a section is now opened the way a topic is: from the roadmap, by
 * clicking it, at an address of its own.
 *
 * What it is *not* is a topic. It has no video and no challenges — a section is
 * a heading with materials under it — and it stays inside the topic holding it:
 * previous and next walk that topic's sections rather than the roadmap's
 * topics. Which topic that is, and which roadmap, is written above the title;
 * back goes to the roadmap, because that is where a section is opened from and
 * so where leaving one should put a student.
 *
 * A student works through a topic's sections in order, and finishes each one
 * by saying so: reading a section completes nothing, and "Mark as Complete" is
 * the only thing that does. What it opens next is the server's answer, shown as
 * it came back — never a guess made before it arrives.
 *
 * Whether it may be opened at all is the server's to answer, exactly as it is
 * for a topic: the API refuses a section of an unpublished roadmap, or one the
 * student has not reached yet, so a student who types the URL gets the locked
 * state and the reason rather than its contents.
 */

/** What the loader hands back: the section, or why there is not one. */
type SubtopicView =
  | { state: "locked"; message: string }
  | { state: "missing" }
  | { state: "ready"; detail: SubtopicDetail };

/** Laravel's wording for a refusal with no reason of its own. */
const UNEXPLAINED_REFUSAL = "This action is unauthorized.";

export function SubtopicDetailsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { subtopicId } = useParams();
  const id = Number(subtopicId);

  const { data, error, loading, reload } = useAsync<SubtopicView>(async () => {
    try {
      const detail = await fetchSubtopic(id);

      // Not a section: a root topic has its own page, and this route is not
      // it. Told apart from a locked one, which is a 403 and caught below.
      return detail ? { state: "ready", detail } : { state: "missing" };
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        return { state: "locked", message: e.message };
      }

      throw e;
    }
  }, [id]);

  const parentId = data?.state === "ready" ? data.detail.parent.id : null;

  /*
   * The student's standing on the topic this section is in: which sections are
   * open, and whether this one is finished. Staff read everything and have no
   * progress to record, so none is asked for on their behalf.
   */
  const loadProgression = useCallback(
    () =>
      isAdmin || parentId === null
        ? Promise.resolve(null)
        : fetchTopicProgression(parentId),
    [isAdmin, parentId],
  );
  const progressionState = useAsync(loadProgression, [isAdmin, parentId]);

  /**
   * The progression the server answered a completion made on this page with.
   * Fresher than what was loaded, so it is preferred — but only for the topic
   * it belongs to.
   */
  const [answered, setAnswered] = useState<TopicProgression | null>(null);
  const progression =
    answered !== null && answered.topicId === parentId
      ? answered
      : progressionState.data;

  const [completing, setCompleting] = useState(false);

  // The disabled button is what a student sees; this is what actually stops a
  // second completion going out before the next render.
  const completingRef = useRef(false);

  const complete = async (subtopic: Subtopic) => {
    if (completingRef.current) return;

    completingRef.current = true;
    setCompleting(true);

    try {
      setAnswered(await completeSubtopic(subtopic.id));
      toast.success(`Marked “${subtopic.title}” complete.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not mark this subtopic complete.",
      );

      // The page is out of date — the section was locked, moved or removed
      // since it loaded. Read both again and show what is true now.
      if (e instanceof ApiError && [403, 404, 422].includes(e.status)) {
        setAnswered(null);
        reload();
        progressionState.reload();
      }
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  };

  /** The route sits outside the student layout, so the shell lives here. */
  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );

  const backToRoadmap = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate("/roadmap")}
      className="mb-4 text-gray-600 hover:text-gray-900"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Roadmap
    </Button>
  );

  if (!Number.isFinite(id)) {
    return shell(
      <EmptyState
        title="Subtopic not found"
        description="That subtopic link does not point anywhere."
      />,
    );
  }

  if (loading) return shell(<LoadingState label="Loading subtopic…" />);
  if (error) return shell(<ErrorState message={error} onRetry={reload} />);
  if (!data) return null;

  if (data.state === "locked") {
    return shell(
      <div className="max-w-3xl mx-auto">
        {backToRoadmap}
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Subtopic locked</h1>
            {/* The server's reason — take the pre-test first, finish the
                section before this one — so the student knows what to do. */}
            <p className="text-sm text-gray-600">
              {data.message && data.message !== UNEXPLAINED_REFUSAL
                ? data.message
                : "This subtopic is not open to you yet. Its roadmap may not be published, or there is something to finish first in its topic."}
            </p>
            <Button onClick={() => navigate("/roadmap")} className="mt-2">
              Back to Roadmap
            </Button>
          </CardContent>
        </Card>
      </div>,
    );
  }

  if (data.state === "missing") {
    return shell(
      <div className="max-w-3xl mx-auto">
        {backToRoadmap}
        <EmptyState
          title="Subtopic not found"
          description="That link does not point at a subtopic. It may have been moved, or it may be a topic — open it from the roadmap."
        />
      </div>,
    );
  }

  const { subtopic, parent, roadmapTitle, siblings } = data.detail;
  const materials = subtopic.materials;

  const index = siblings.findIndex((sibling) => sibling.id === subtopic.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  /**
   * Whether the server has shut a section to this student. Unknown — no
   * progression, or staff — is not shut: the server answers the request.
   */
  const isLocked = (sibling: Subtopic) =>
    subtopicStatus(progression, sibling.id) === "locked";

  const goTo = (sibling: Subtopic | null) =>
    sibling && navigate(`/subtopic/${sibling.id}`);

  return shell(
    <>
      <div className="mb-6">
        {/* Back goes to the roadmap, the same place the topic page's does — and
            the same place the student clicked this subtopic from, since that is
            where subtopics are opened. The topic is still named just below, so
            nothing is lost by not making it the way out. */}
        {backToRoadmap}

        {/* Where this section sits, said before its own title: the roadmap,
            then the topic. Without it a section page is a page about something
            with no indication of what it is part of. */}
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">
          {roadmapTitle && <span>{roadmapTitle} · </span>}
          {parent.title}
        </p>

        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold text-gray-900 break-words">
            {subtopic.title}
          </h1>

          {index >= 0 && (
            <span className="text-sm text-gray-500 tabular-nums">
              Subtopic {index + 1} of {siblings.length}
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {subtopic.description && (
            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Overview
                </h2>
                <p className="text-gray-700 leading-relaxed break-words">
                  {subtopic.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* The section's own materials, and the only ones on this page. The
              topic's own stay on the topic's page — which is the whole point of
              a section having one. */}
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Learning Materials
              </h2>

              {materials.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    No learning materials in this subtopic yet.
                  </p>
                </div>
              ) : (
                // The same list the topic's own materials are drawn in: a
                // material reads and opens the same wherever it is filed.
                <MaterialList materials={materials} />
              )}

              {isAdmin && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  Add and reorder materials from Roadmap management.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {!isAdmin && (
            <SubtopicProgressPanel
              subtopic={subtopic}
              progression={progression}
              loading={progressionState.loading}
              error={progressionState.error}
              completing={completing}
              onRetry={progressionState.reload}
              onComplete={() => void complete(subtopic)}
              onOpen={(path) => navigate(path)}
            />
          )}

          {/* The rest of the topic, so a student can move between its sections
              without going back out to the roadmap to do it. */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" aria-hidden="true" />
                In this topic
              </h2>

              <ul className="space-y-1">
                {siblings.map((sibling, position) => {
                  const isCurrent = sibling.id === subtopic.id;

                  return (
                    <li key={sibling.id}>
                      {/* The one being read is not a link to itself. Drawn as
                          the same row so the list still reads as a list, and
                          marked so it is not only colour saying which. */}
                      {isCurrent ? (
                        <span
                          aria-current="page"
                          className="flex gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800"
                        >
                          <span className="tabular-nums shrink-0">
                            {position + 1}.
                          </span>
                          <span className="break-words">{sibling.title}</span>
                        </span>
                      ) : isLocked(sibling) ? (
                        // Shut by the server: listed, so the topic still reads
                        // whole, but not offered as somewhere to go.
                        <span
                          aria-disabled="true"
                          className="flex gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-gray-400"
                        >
                          <span className="tabular-nums shrink-0">
                            {position + 1}.
                          </span>
                          <span className="break-words">{sibling.title}</span>
                          <Lock
                            className="w-3.5 h-3.5 ml-auto mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="sr-only">(locked)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goTo(sibling)}
                          aria-label={`Open ${sibling.title}`}
                          className="flex w-full gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span className="tabular-nums shrink-0 text-gray-400">
                            {position + 1}.
                          </span>
                          <span className="break-words">{sibling.title}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                Navigation
              </h2>

              {/* Sections of this topic, never the roadmap's topics. Walking
                  off the end of a topic's sections is stepping out of the
                  topic, which is what the button above is for. */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => goTo(previous)}
                  disabled={!previous || isLocked(previous)}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous Subtopic
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => goTo(next)}
                  disabled={!next || isLocked(next)}
                >
                  Next Subtopic
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>,
  );
}

/**
 * Where the student stands on this section, and the one thing they can do
 * about it: mark it complete. Once it is, what that opened — the next section,
 * or the topic's post-test — as the server said.
 */
function SubtopicProgressPanel({
  subtopic,
  progression,
  loading,
  error,
  completing,
  onRetry,
  onComplete,
  onOpen,
}: {
  subtopic: Subtopic;
  progression: TopicProgression | null;
  loading: boolean;
  error: string | null;
  completing: boolean;
  onRetry: () => void;
  onComplete: () => void;
  onOpen: (path: string) => void;
}) {
  const status = subtopicStatus(progression, subtopic.id);

  let body: React.ReactNode = null;

  if (progression === null && loading) {
    body = <p className="text-sm text-gray-500">Checking your progress…</p>;
  } else if (progression === null && error) {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (progression !== null && status === "completed") {
    const next = openNextSubtopic(progression);
    const postTest = progression.postTest;

    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Completed
        </p>

        {next ? (
          <Button className="w-full" onClick={() => onOpen(`/subtopic/${next.id}`)}>
            Continue to {next.title}
          </Button>
        ) : postTest && postTest.available ? (
          <Button
            className="w-full"
            onClick={() => onOpen(`/assessments/${postTest.id}`)}
          >
            Take the post-test
          </Button>
        ) : null}
      </div>
    );
  } else if (progression !== null && status === "available") {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Finished with this subtopic? Mark it complete to open what comes next.
        </p>
        <Button className="w-full" disabled={completing} onClick={onComplete}>
          {completing ? "Marking complete…" : "Mark as Complete"}
        </Button>
      </div>
    );
  } else if (progression !== null && status === "locked") {
    body = (
      <p className="flex items-center gap-2 text-sm text-gray-600">
        <Lock className="w-4 h-4" aria-hidden="true" />
        This subtopic is locked.
      </p>
    );
  }

  if (body === null) return null;

  return (
    <Card
      role="region"
      aria-labelledby="subtopic-progress-title"
      className="border border-gray-200 shadow-sm"
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="subtopic-progress-title" className="text-lg font-bold text-gray-900">
            Your progress
          </h2>
          {progression && (
            <span className="text-xs text-gray-500 tabular-nums">
              {progression.completedCount} of {progression.totalCount} completed
            </span>
          )}
        </div>
        {body}
      </CardContent>
    </Card>
  );
}
