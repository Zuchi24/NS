import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchRoadmaps } from "@/features/content/contentService";
import { useAsync } from "@/services/useAsync";
import { RoadmapPanel } from "./RoadmapPanel";
import { RoadmapTopicsPanel } from "./RoadmapTopicsPanel";

/**
 * The authored catalogue: the roadmaps, their topics in order, and the material
 * attached to them.
 *
 * One roadmap at a time. Topic order only means anything within a roadmap — it
 * is what decides which topics unlock after which — so authoring it across a
 * flattened list of every roadmap at once would be showing an order that does
 * not exist. Picking a roadmap first is what makes "move this up" answerable,
 * and it is why the roadmap picker and the roadmap's own controls are the same
 * card: the one being managed is the one being authored.
 *
 * Below that picker the roadmap is its topics, each one a card that opens onto
 * its own content and materials. A topic's detail is inside the topic rather
 * than in a panel beside the list, so there is one place a topic is authored
 * and no second copy of it to keep in step.
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

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">
      <RoadmapPanel
        roadmaps={roadmaps}
        roadmap={roadmap}
        onSelect={setSelectedRoadmapId}
        onChanged={(next) => {
          setSelectedRoadmapId(next);
          reload();
        }}
      />

      {roadmap === null ? (
        <EmptyState
          title="Nothing to author yet"
          description="Add a roadmap on the left. Topics, and the learning materials in them, hang off one."
        />
      ) : (
        <RoadmapTopicsPanel
          // Keyed on the roadmap so switching resets the panel's own form and
          // its open card rather than leaving a half-written topic pointed at
          // another roadmap.
          key={roadmap.id}
          roadmapId={roadmap.id}
          roadmapTitle={roadmap.title}
          topics={roadmap.topics}
          onChanged={reload}
        />
      )}
    </div>
  );
}
