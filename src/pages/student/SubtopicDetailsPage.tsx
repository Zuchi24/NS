import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
} from "lucide-react";

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
 * What it is *not* is a topic. It has no video, no challenges and nothing to
 * finish — a section is a heading with materials under it — and it stays inside
 * the topic holding it: previous and next walk that topic's sections rather
 * than the roadmap's topics. Which topic that is, and which roadmap, is written
 * above the title; back goes to the roadmap, because that is where a section is
 * opened from and so where leaving one should put a student.
 *
 * Whether it may be opened at all is the server's to answer, exactly as it is
 * for a topic: the API refuses a section of an unpublished roadmap outright, so
 * a student who types the URL gets the locked state rather than its contents.
 */

/** What the loader hands back: the section, or why there is not one. */
type SubtopicView =
  | { state: "locked" }
  | { state: "missing" }
  | { state: "ready"; detail: SubtopicDetail };

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
        return { state: "locked" };
      }

      throw e;
    }
  }, [id]);

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
            <p className="text-sm text-gray-600">
              The roadmap this subtopic belongs to has not been published yet.
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
                  disabled={!previous}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous Subtopic
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => goTo(next)}
                  disabled={!next}
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
