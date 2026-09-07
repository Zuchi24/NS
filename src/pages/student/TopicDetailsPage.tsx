import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  Play,
} from "lucide-react";

import { useAuth } from "@/features/auth/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchTopic } from "@/features/content/contentService";
import { fetchTopicMaterials, youtubeId } from "@/features/content/materialService";
import { MaterialList } from "@/features/content/components/MaterialList";
import type { LearningMaterial, Topic } from "@/features/content/types";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";

/**
 * One topic: what it covers, its video, its learning materials, and how
 * far the student has got.
 *
 * Everything here is the server's — including whether the topic is open at all.
 * The roadmap locks topics in order and the API refuses a locked one outright,
 * so a student who types its URL gets the locked state, not its contents.
 */

/** What the loader hands back: the topic, or the fact that it is shut. */
type TopicView =
  | { locked: true }
  | {
      locked: false;
      detail: Awaited<ReturnType<typeof fetchTopic>>;
      materials: LearningMaterial[];
    };

export function TopicDetailsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { topicId } = useParams();
  const id = Number(topicId);

  const { data, error, loading, reload } = useAsync<TopicView>(async () => {
    try {
      const [detail, materials] = await Promise.all([
        fetchTopic(id),
        fetchTopicMaterials(id),
      ]);

      return { locked: false, detail, materials };
    } catch (e) {
      // A locked topic is a 403 by design, not a failure worth an error page.
      if (e instanceof ApiError && e.status === 403) {
        return { locked: true };
      }

      throw e;
    }
  }, [id]);

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

  /** The route sits outside the student layout, so the shell lives here. */
  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );

  if (!Number.isFinite(id)) {
    return shell(
      <EmptyState
        title="Topic not found"
        description="That topic link does not point anywhere."
      />,
    );
  }

  if (loading) return shell(<LoadingState label="Loading topic…" />);
  if (error) return shell(<ErrorState message={error} onRetry={reload} />);
  if (!data) return null;

  if (data.locked) {
    return shell(
      <div className="max-w-3xl mx-auto">
        {backToRoadmap}
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Topic locked</h1>
            <p className="text-sm text-gray-600">
              Finish the topics before this one to open it.
            </p>
            <Button onClick={() => navigate("/roadmap")} className="mt-2">
              Back to Roadmap
            </Button>
          </CardContent>
        </Card>
      </div>,
    );
  }

  const { topic, roadmapTitle, siblings } = data.detail;
  const materials = data.materials;

  const index = siblings.findIndex((sibling) => sibling.id === topic.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  // Nothing is paced: every topic of a roadmap the student can see is open.
  const goTo = (sibling: Topic | null) =>
    sibling && navigate(`/topic/${sibling.id}`);

  const videoId = youtubeId(topic.videoUrl);

  return shell(
    <>
      <div className="mb-6">
        {backToRoadmap}
        {roadmapTitle && (
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">
            {roadmapTitle}
          </p>
        )}
        <h1 className="text-3xl font-bold text-gray-900">{topic.title}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {topic.description && (
            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Overview
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {topic.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* The topic's own materials, as its author ordered them. The API
              serves these only for a topic the student may open, so reaching
              this card at all is already the answer to whether they may. */}
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Learning Materials
              </h2>

              {materials.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    No learning materials for this topic yet.
                  </p>
                </div>
              ) : (
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
          <Card className="border-2 border-blue-300 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                <Play className="w-5 h-5 inline mr-2 text-blue-600" />
                Watch Tutorial
              </h3>

              {videoId ? (
                <div className="space-y-3">
                  <div className="relative w-full pb-[56.25%] bg-gray-900 rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={topic.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={() =>
                      window.open(
                        `https://www.youtube.com/watch?v=${videoId}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Watch on YouTube
                  </Button>
                </div>
              ) : (
                <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No video available yet
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Navigation
              </h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => goTo(previous)}
                  disabled={!previous}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous Topic
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => goTo(next)}
                  disabled={!next}
                >
                  Next Topic
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
