import { useSearchParams } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { readRoadmapContext } from "@/features/assessments/assessmentPaths";
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
    // With subtopics: this page draws the hierarchy, so it needs the sections
    // inside each topic as well as the topics themselves.
    fetchRoadmaps({ withSubtopics: true }).then((roadmaps) => ({ roadmaps })),
  );

  /*
   * Which roadmap is being authored, and which topic to open on arrival, are
   * held in the address rather than in state. The assessment builder is a page
   * of its own, and this is what lets its Back link return an author to the
   * roadmap and topic they left from. Picking a roadmap replaces the entry
   * rather than adding one: Back should leave the page, not step through every
   * roadmap that was glanced at.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const { roadmapId: selectedRoadmapId, topicId: arrivalTopicId } =
    readRoadmapContext(searchParams);

  const setSelectedRoadmapId = (next: number | null) =>
    setSearchParams(next === null ? {} : { roadmap: String(next) }, {
      replace: true,
    });

  // The whole page waits only for the first load. A reload after a write keeps
  // the catalogue it has on screen — replacing it would unmount the topics
  // panel and fold up everything the author had open — and the panel is told
  // it is refreshing instead. A reload that fails still clears the data, so
  // the error below still takes the page.
  if (loading && data === null) return <LoadingState label="Loading catalogue…" />;
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

  // Stacked, the roadmap above its topics, at every width. Side by side, the
  // short roadmap card left an empty column beside a long topic list. Still a
  // one-column grid: its minmax(0, 1fr) track is what keeps a long roadmap
  // name in the picker from widening the page past a phone's screen.
  return (
    <div className="grid grid-cols-1 gap-6">
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
          description="Add a roadmap above. Topics, and the learning materials in them, hang off one."
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
          refreshing={loading}
          // Only on arrival: picking another roadmap writes an address with no
          // topic in it, so this does not follow the author into it.
          initialExpandedTopicId={arrivalTopicId}
        />
      )}
    </div>
  );
}
