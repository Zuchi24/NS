import { useNavigate } from "react-router";
import { Youtube } from "lucide-react";

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

  // Every topic of a roadmap the student can see is open to them: a topic
  // carries reading and watching, and nothing paces it.
  const buildNodes = (roadmap: Roadmap): TopicNode[] =>
    roadmap.topics.map((topic) => ({ topic }));

  const sections = roadmaps
    .filter((roadmap) => roadmap.topics.length > 0)
    .map((roadmap) => ({ roadmap, nodes: buildNodes(roadmap) }));

  const totalCount = sections.flatMap((section) => section.nodes).length;

  // Nothing is paced: every topic of a roadmap the student can see is open.
  const openTopic = (node: TopicNode) => navigate(`/topic/${node.topic.id}`);

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
          <p className="text-sm text-gray-600">
            {totalCount} topic{totalCount === 1 ? "" : "s"} of reading and
            watching. Read them in any order.
          </p>
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
                              stroke="#3b82f6"
                              strokeWidth="2"
                            />
                          </svg>
                        )}

                        <button
                          type="button"
                          onClick={() => openTopic(node)}
                          aria-label={`Open ${node.topic.title}`}
                          className="relative bg-white rounded-xl shadow-md border-2 border-blue-400 p-5 w-80 text-left transition-all hover:border-blue-500 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <h3 className="text-lg font-bold text-gray-900 mb-2 pr-6">
                            {node.topic.title}
                          </h3>
                          {node.topic.description && (
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                              {node.topic.description}
                            </p>
                          )}

                          <div className="mt-3 flex items-center gap-4 text-xs">
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
