import { useNavigate } from "react-router";
import { CheckCircle2, Lock, PlayCircle, Youtube } from "lucide-react";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchRoadmaps } from "@/features/content/contentService";
import type { Roadmap, Topic } from "@/features/content/types";
import { useAsync } from "@/services/useAsync";

interface TopicNode {
  topic: Topic;
  challengeCount: number;
  completed: boolean;
  unlocked: boolean;
  inProgress: boolean;
  /** Share of the topic's required challenges passed, 0-100. */
  percent: number;
}

/**
 * The roadmaps, each topic carrying the student's own standing on it.
 *
 * Unlocking and completion are the server's to decide — it knows which
 * placements are required and which submissions actually passed — so this page
 * reads `topic.progress` rather than working it out from the attempt list.
 */
function loadRoadmapView() {
  return fetchRoadmaps();
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(loadRoadmapView);

  if (loading) return <LoadingState label="Loading your roadmap…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const roadmaps = data;

  const buildNodes = (roadmap: Roadmap): TopicNode[] =>
    roadmap.topics.map((topic) => ({
      topic,
      challengeCount: topic.challengesCount ?? 0,
      completed: topic.progress?.status === "completed",
      inProgress: topic.progress?.status === "in_progress",
      // Locked until the server says otherwise, so a topic never opens by
      // accident when progress is missing from the payload.
      unlocked: topic.progress?.isUnlocked ?? false,
      percent: topic.progress?.percent ?? 0,
    }));

  const sections = roadmaps
    .filter((roadmap) => roadmap.topics.length > 0)
    .map((roadmap) => ({ roadmap, nodes: buildNodes(roadmap) }));

  const allNodes = sections.flatMap((section) => section.nodes);
  const completedCount = allNodes.filter((node) => node.completed).length;
  const totalCount = allNodes.length;
  const progressPercentage =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const openTopic = (node: TopicNode) => {
    if (!node.unlocked) {
      toast.error("Finish the topic before this one to unlock it");
      return;
    }
    navigate(`/topic/${node.topic.id}`);
  };

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No roadmap published yet"
        description="Your instructor has not published a roadmap with topics. Check back once one is available."
      />
    );
  }

  return (
    <div className="-m-8">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">
              Networking Roadmap
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={progressPercentage} className="h-2.5" />
            </div>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {completedCount}/{totalCount} Complete
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="relative">
          <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-gray-200" />

          <div className="space-y-16">
            {sections.map(({ roadmap, nodes }) => (
              <div key={roadmap.id} className="relative">
                <div className="flex justify-center mb-8">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg z-10 relative">
                    <h2 className="text-sm font-bold uppercase tracking-wide">
                      {roadmap.title}
                    </h2>
                  </div>
                </div>

                <div className="space-y-6">
                  {nodes.map((node, index) => {
                    const position =
                      index === 0
                        ? "center"
                        : index % 2 === 1
                          ? "left"
                          : "right";

                    return (
                      <div
                        key={node.topic.id}
                        className={`relative flex ${
                          position === "center"
                            ? "justify-center"
                            : position === "left"
                              ? "justify-start pr-[55%]"
                              : "justify-end pl-[55%]"
                        }`}
                      >
                        {position !== "center" && (
                          <svg
                            className="absolute top-1/2 transform -translate-y-1/2"
                            style={{
                              left: position === "left" ? "calc(100% - 8%)" : "47%",
                              width:
                                position === "left"
                                  ? "calc(50% - 42%)"
                                  : "calc(53% - 47%)",
                              height: "2px",
                            }}
                          >
                            <line
                              x1="0"
                              y1="1"
                              x2="100%"
                              y2="1"
                              stroke={
                                node.completed
                                  ? "#22c55e"
                                  : node.unlocked
                                    ? "#3b82f6"
                                    : "#d1d5db"
                              }
                              strokeWidth="2"
                            />
                          </svg>
                        )}

                        <button
                          type="button"
                          onClick={() => openTopic(node)}
                          aria-label={`Open ${node.topic.title}`}
                          className={`relative bg-white rounded-xl shadow-md border-2 p-5 w-80 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            node.completed
                              ? "border-green-500 hover:shadow-lg"
                              : node.unlocked
                                ? "border-blue-400 hover:border-blue-500 hover:shadow-lg"
                                : "border-gray-200 opacity-60 cursor-not-allowed"
                          }`}
                        >
                          <div className="absolute -right-3 -top-3">
                            {node.completed ? (
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              </div>
                            ) : node.unlocked ? (
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                <div className="w-3 h-3 bg-white rounded-full" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                                <Lock className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-gray-900 mb-2 pr-6">
                            {node.topic.title}
                          </h3>
                          {node.topic.description && (
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                              {node.topic.description}
                            </p>
                          )}

                          {node.inProgress && (
                            <div className="mt-3 space-y-1">
                              <Progress value={node.percent} className="h-1.5" />
                              <p className="text-xs text-gray-500">In progress</p>
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <PlayCircle className="w-3.5 h-3.5" />
                              {node.challengeCount}{" "}
                              {node.challengeCount === 1
                                ? "challenge"
                                : "challenges"}
                            </span>
                            {node.topic.videoUrl && (
                              <span className="flex items-center gap-1.5 text-gray-500">
                                <Youtube className="w-3.5 h-3.5" />
                                Video
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
