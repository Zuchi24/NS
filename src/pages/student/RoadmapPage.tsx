import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronUp, Route, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchRoadmaps } from "@/features/content/contentService";
import type { Roadmap, Topic } from "@/features/content/types";
import { useAsync } from "@/services/useAsync";

/**
 * The published roadmaps, drawn as the path a student walks down.
 *
 * A roadmap is a sequence — its topics are stored in the order an instructor
 * put them in — and a list of cards says that far less plainly than a line
 * running through them does. So each roadmap is one continuous vertical path:
 * a spine, a numbered node on it for every topic, and the card that node opens.
 *
 * Nothing here is gated. Every topic of a roadmap the student can see is open
 * to them: a topic carries reading and watching, and no challenge stands in
 * front of one. Challenges are a separate top-level feature, in no topic and
 * behind no roadmap, so this page neither fetches nor mentions them.
 */

/**
 * Topics on screen before the student asks for more, and the size of a step in
 * either direction after that.
 *
 * The same number for both, so the path only ever stands at a multiple of it:
 * five, ten, fifteen. A reveal and a collapse of the same size are each other's
 * undo, which is what lets a student open a long roadmap, look, and put it back
 * the way it was.
 */
const TOPICS_AT_FIRST = 5;
const TOPICS_PER_STEP = 5;

export function RoadmapPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(fetchRoadmaps);

  /**
   * How much of each roadmap has been revealed, by roadmap id.
   *
   * Per roadmap rather than per page: they are separate paths, and asking for
   * more of one says nothing about the others. Absent means the first five —
   * which keeps a reload from having to seed this before the data lands.
   */
  const [shown, setShown] = useState<Record<number, number>>({});

  /** Moves one roadmap's path, leaving every other roadmap where it was. */
  const step = (roadmapId: number, next: (from: number) => number) =>
    setShown((current) => ({
      ...current,
      [roadmapId]: next(current[roadmapId] ?? TOPICS_AT_FIRST),
    }));

  if (loading) return <LoadingState label="Loading your roadmap…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  // A roadmap with nothing in it is not a path yet, and drawing an empty one
  // would say the student has arrived somewhere there is nothing to read.
  const roadmaps = data.filter((roadmap) => roadmap.topics.length > 0);

  const totalCount = roadmaps.reduce(
    (count, roadmap) => count + roadmap.topics.length,
    0,
  );

  if (roadmaps.length === 0) {
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            Networking Roadmap
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {totalCount} topic{totalCount === 1 ? "" : "s"} of reading and
            watching. Read them in any order.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-16">
        {roadmaps.map((roadmap) => (
          <RoadmapPath
            key={roadmap.id}
            roadmap={roadmap}
            shown={shown[roadmap.id] ?? TOPICS_AT_FIRST}
            onShowMore={() => step(roadmap.id, (from) => from + TOPICS_PER_STEP)}
            onShowLess={() =>
              step(roadmap.id, (from) =>
                Math.max(
                  TOPICS_AT_FIRST,
                  // From what is on screen rather than from the stored count:
                  // after the last reveal those differ, and a step measured
                  // against the stored one would take a topic fewer away than
                  // the button says.
                  Math.min(from, roadmap.topics.length) - TOPICS_PER_STEP,
                ),
              )
            }
            onOpen={(topic) => navigate(`/topic/${topic.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One roadmap, as a path.
 *
 * The spine is drawn once behind the whole path rather than in pieces between
 * nodes, so it stays unbroken whatever the cards do — different heights, a
 * wrapped title, a revealed batch — and it runs on past the last node into the
 * controls that reveal or put away the next few, which is what makes them read
 * as more path rather than as the end of one.
 *
 * The path is a single column on a phone, with the spine down the left; from
 * `lg` it centres and the cards alternate either side of it. The DOM order is
 * the roadmap's order in both, so what is read aloud and what is tabbed
 * through is the sequence the instructor authored, whatever the layout does.
 */
function RoadmapPath({
  roadmap,
  shown,
  onShowMore,
  onShowLess,
  onOpen,
}: {
  roadmap: Roadmap;
  /** How many of this roadmap's topics to draw. */
  shown: number;
  onShowMore: () => void;
  onShowLess: () => void;
  onOpen: (topic: Topic) => void;
}) {
  const headingId = `roadmap-${roadmap.id}-title`;

  const visible = roadmap.topics.slice(0, shown);
  const remaining = roadmap.topics.length - visible.length;
  // The last reveal of a roadmap is usually short of a full step, and a button
  // promising five that produces one is a button that lied.
  const next = Math.min(remaining, TOPICS_PER_STEP);
  // There is something to put away once the path has grown past its first
  // batch. Below that there is nothing a collapse could take that the student
  // did not arrive with — and the first topic is never one of them.
  const canCollapse = visible.length > TOPICS_AT_FIRST;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-col items-start lg:items-center gap-2 mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-white shadow-md">
          <Route className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h2
            id={headingId}
            className="text-sm font-bold uppercase tracking-wide"
          >
            {roadmap.title}
          </h2>
        </span>

        {roadmap.description && (
          <p className="text-sm text-gray-600 lg:text-center max-w-xl">
            {roadmap.description}
          </p>
        )}
      </div>

      <div className="relative">
        {/* The path itself. One element, behind everything, from the first node
            to whatever ends the path. */}
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-5 lg:left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-300 via-blue-200 to-blue-100"
        />

        <ol className="space-y-6 lg:space-y-10">
          {visible.map((topic, index) => (
            <TopicNode
              key={topic.id}
              topic={topic}
              position={index + 1}
              // Alternating from the second node, so the path visibly weaves
              // rather than running down one side.
              cardOnLeft={index % 2 === 0}
              onOpen={() => onOpen(topic)}
            />
          ))}
        </ol>

        {(remaining > 0 || canCollapse) && (
          <div className="relative pt-8 pl-14 lg:pl-0 lg:flex lg:justify-center">
            {/* The node the path ends on. It points the way the path can still
                go: down while there is more to reveal, back up once there is
                not. */}
            <span
              aria-hidden="true"
              className="absolute top-8 left-5 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-blue-300 bg-white lg:left-1/2"
            >
              {remaining > 0 ? (
                <ChevronDown className="w-4 h-4 text-blue-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-blue-500" />
              )}
            </span>

            <div className="lg:mt-14 flex flex-col items-start lg:items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {remaining > 0 && (
                  <Button
                    variant="outline"
                    onClick={onShowMore}
                    className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                  >
                    Show {next} More Topic{next === 1 ? "" : "s"}
                  </Button>
                )}

                {/* Offered as soon as there is more on the path than the
                    student started with, rather than only at the very bottom:
                    a roadmap opened three steps deep is exactly where putting
                    some of it away is worth doing. */}
                {canCollapse && (
                  <Button
                    variant="ghost"
                    onClick={onShowLess}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Show Less
                  </Button>
                )}
              </div>

              {/* Not pagination: what is already on the path stays there, and
                  this says how much of it is showing. */}
              <p className="text-xs text-gray-500">
                Showing {visible.length} of {roadmap.topics.length} topics.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One topic: a node on the line, and the card it opens.
 *
 * The node and the short arm joining it to the card are drawn from the row
 * itself rather than from the card, so a taller card grows around them and the
 * node stays on the spine.
 */
function TopicNode({
  topic,
  position,
  cardOnLeft,
  onOpen,
}: {
  topic: Topic;
  position: number;
  /** Which side of the spine the card sits on, from `lg` up. */
  cardOnLeft: boolean;
  onOpen: () => void;
}) {
  return (
    <li className="relative pl-14 lg:pl-0 lg:grid lg:grid-cols-[1fr_4rem_1fr] lg:items-center">
      {/* The arm from the spine to the card. On a phone every card is to the
          right of the line; from lg it reaches out to whichever side the card
          is on, and its inner end disappears under the node. */}
      <span
        aria-hidden="true"
        className={`absolute top-8 left-5 h-0.5 w-7 -translate-y-1/2 bg-blue-200 lg:top-1/2 lg:w-8 ${
          cardOnLeft ? "lg:left-auto lg:right-1/2" : "lg:left-1/2"
        }`}
      />

      <span className="absolute top-8 left-5 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-xs font-bold text-blue-700 shadow-sm lg:top-1/2 lg:left-1/2">
        {position}
      </span>

      <div
        className={
          cardOnLeft
            ? "lg:col-start-1 lg:justify-self-end"
            : "lg:col-start-3 lg:justify-self-start"
        }
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${topic.title}`}
          className="group w-full lg:max-w-sm text-left bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5 transition-all hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-700">
            {topic.title}
          </h3>

          {topic.description && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3">
              {topic.description}
            </p>
          )}

          {topic.videoUrl && (
            <span className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
              <Youtube className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Video
            </span>
          )}
        </button>
      </div>
    </li>
  );
}
