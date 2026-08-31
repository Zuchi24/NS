import { useMemo, useState } from "react";
import { BookOpen, Trophy, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import {
  fetchChallenges,
  fetchRoadmaps,
} from "@/features/content/contentService";
import { useAsync } from "@/services/useAsync";
import { RoadmapTopicsPanel } from "./RoadmapTopicsPanel";
import { TopicMaterialsPanel } from "./TopicMaterialsPanel";

/**
 * The authored catalogue: the roadmaps, their topics in order, the challenges
 * placed in each, and the material attached to them.
 *
 * One roadmap at a time. Topic order only means anything within a roadmap — it
 * is what decides which topics unlock after which — so authoring it across a
 * flattened list of every roadmap at once would be showing an order that does
 * not exist. Picking a roadmap first is what makes "move this up" answerable.
 *
 * Challenges remain read-only here: they are authored in the seeder, and this
 * page says so rather than offering controls that would not outlive a reload.
 */
/**
 * Says a roadmap is not out yet.
 *
 * Only ever rendered on the admin side, because only staff are sent an
 * unpublished roadmap in the first place — the API filters them out of a
 * student's list, so this is labelling what staff can see rather than hiding
 * anything from anyone. Matches the "Draft" mark the materials panel uses.
 */
function DraftBadge() {
  return (
    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      Draft
    </span>
  );
}

export function RoadmapAdminPage() {
  const { data, error, loading, reload } = useAsync(() =>
    Promise.all([fetchRoadmaps(), fetchChallenges()]).then(
      ([roadmaps, challenges]) => ({ roadmaps, challenges }),
    ),
  );

  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(
    null,
  );
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const roadmaps = useMemo(() => data?.roadmaps ?? [], [data]);

  if (loading) return <LoadingState label="Loading catalogue…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (roadmaps.length === 0) {
    return (
      <EmptyState
        title="No roadmaps yet"
        description="The catalogue is empty. Roadmaps are seeded from the backend; topics are authored here once one exists."
      />
    );
  }

  // Falls back to the first rather than to nothing, so the page always has a
  // roadmap in view — including right after the selected one's last topic goes.
  const roadmap =
    roadmaps.find((entry) => entry.id === selectedRoadmapId) ?? roadmaps[0];

  const topics = roadmap.topics;

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null;

  const topicChallenges = selectedTopic
    ? (data?.challenges ?? []).filter((challenge) =>
        challenge.topicIds.includes(selectedTopic.id),
      )
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <div className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Roadmap
              {!roadmap.isPublished && <DraftBadge />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="roadmap-picker">Authoring</Label>
            <select
              id="roadmap-picker"
              value={roadmap.id}
              onChange={(event) => {
                setSelectedRoadmapId(Number(event.target.value));
                // The topic selection belongs to the roadmap that was showing;
                // carrying it across would leave the panels below describing a
                // topic that is no longer in the list.
                setSelectedTopicId(null);
              }}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {roadmaps.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {/* Marked in the option text as well as beside the title: a
                      native select shows only the chosen row when closed, so a
                      badge alone would not say which of the others are drafts. */}
                  {entry.isPublished ? entry.title : `${entry.title} (draft)`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600">{roadmap.description}</p>

            {!roadmap.isPublished && (
              <p className="text-xs text-amber-700">
                This roadmap is unpublished. Students cannot see it, or anything
                in it, until it is published — but you can author it now.
              </p>
            )}
          </CardContent>
        </Card>

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
      </div>

      <div className="space-y-6">
        {selectedTopic === null ? (
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

            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  Challenges in this topic
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topicChallenges.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    No challenges are placed in this topic.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topicChallenges.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="rounded-md border border-gray-200 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {challenge.title}
                        </p>
                        {challenge.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            {challenge.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {challenge.kind.replace("_", " ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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
