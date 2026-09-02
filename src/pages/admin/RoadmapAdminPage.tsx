import { useState } from "react";
import { BookOpen, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchRoadmaps } from "@/features/content/contentService";
import { useAsync } from "@/services/useAsync";
import { DraftBadge, RoadmapPanel } from "./RoadmapPanel";
import { RoadmapTopicsPanel } from "./RoadmapTopicsPanel";
import { TopicMaterialsPanel } from "./TopicMaterialsPanel";

/**
 * The authored catalogue: the roadmaps, their topics in order, the challenges
 * placed in each, and the material attached to them.
 *
 * One roadmap at a time. Topic order only means anything within a roadmap — it
 * is what decides which topics unlock after which — so authoring it across a
 * flattened list of every roadmap at once would be showing an order that does
 * not exist. Picking a roadmap first is what makes "move this up" answerable,
 * and it is why the roadmap picker and the roadmap's own controls are the same
 * card: the one being managed is the one being authored.
 *
 * Challenges are not part of this page at all. They are a top-level feature of
 * their own, placed in no topic and gated by no roadmap, so nothing authored
 * here can reach one.
 */
export function RoadmapAdminPage() {
  const { data, error, loading, reload } = useAsync(() =>
    fetchRoadmaps().then((roadmaps) => ({ roadmaps })),
  );

  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(
    null,
  );
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  if (loading) return <LoadingState label="Loading catalogue…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const roadmaps = data?.roadmaps ?? [];

  // Falls back to the first rather than to nothing, so the page always has a
  // roadmap in view — including right after the selected one is deleted. Null
  // only when there is genuinely nothing yet, which is a catalogue waiting for
  // its first roadmap rather than an error.
  const roadmap =
    roadmaps.find((entry) => entry.id === selectedRoadmapId) ??
    roadmaps[0] ??
    null;

  const topics = roadmap?.topics ?? [];

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null;

  /**
   * A topic selection belongs to the roadmap that was showing. Carrying it
   * across would leave the panels describing a topic no longer in the list.
   */
  const showRoadmap = (roadmapId: number | null) => {
    setSelectedRoadmapId(roadmapId);
    setSelectedTopicId(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <div className="space-y-6">
        <RoadmapPanel
          roadmaps={roadmaps}
          roadmap={roadmap}
          onSelect={showRoadmap}
          onChanged={(next) => {
            showRoadmap(next);
            reload();
          }}
        />

        {roadmap && (
          <RoadmapTopicsPanel
            // Keyed on the roadmap so switching resets the panel's own form
            // rather than leaving a half-written topic pointed at another
            // roadmap.
            key={roadmap.id}
            roadmapId={roadmap.id}
            roadmapTitle={roadmap.title}
            topics={topics}
            selectedTopicId={selectedTopic?.id ?? null}
            onSelect={setSelectedTopicId}
            onChanged={reload}
          />
        )}
      </div>

      <div className="space-y-6">
        {roadmap === null ? (
          <EmptyState
            title="Nothing to author yet"
            description="Add a roadmap on the left. Topics, and the learning materials in them, hang off one."
          />
        ) : selectedTopic === null ? (
          <EmptyState
            title="No topics in this roadmap"
            description="Add the first topic on the left, then attach its materials here."
          />
        ) : (
          <>
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  {selectedTopic.title}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                  {roadmap.title}
                  {!roadmap.isPublished && <DraftBadge />}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTopic.description ? (
                  <p className="text-sm text-gray-700">
                    {selectedTopic.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    This topic has no description.
                  </p>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Video className="w-4 h-4 text-gray-400 shrink-0" />
                  {selectedTopic.videoUrl ? (
                    <a
                      href={selectedTopic.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {selectedTopic.videoUrl}
                    </a>
                  ) : (
                    <span className="text-gray-500">No video linked</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Keyed on the topic so switching selection resets the panel rather
                than showing the previous topic's list while the next one loads. */}
            <TopicMaterialsPanel
              key={selectedTopic.id}
              topicId={selectedTopic.id}
            />
          </>
        )}
      </div>
    </div>
  );
}
