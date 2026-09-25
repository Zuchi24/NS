import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ChevronDown, ChevronUp, Lock, Route, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/AsyncStates";
import { fetchRoadmaps } from "@/features/content/contentService";
import {
  SUBTOPIC_STATUS_LABEL,
  SUBTOPIC_STATUS_STYLE,
  labelWithStatus,
} from "@/features/content/subtopicStatus";
import type { Roadmap, Subtopic, SubtopicStatus, Topic } from "@/features/content/types";
import { useAsync } from "@/services/useAsync";

/**
 * The published roadmaps, drawn as the path a student walks down.
 *
 * A roadmap is a sequence — its topics are stored in the order an instructor
 * put them in — and a list of cards says that far less plainly than a line
 * running through them does. So each roadmap is one continuous vertical path:
 * a spine, a numbered node on it for every topic, and the card that node opens.
 *
 * The path itself draws no standing: a topic of a roadmap is not paced behind
 * the topics before it, so its node and its card look the same whatever the
 * student has done. The sections inside a topic are paced, and each one the
 * server judged says which of the three it is — finished, open now, or not yet
 * reached. That judgement arrives with the section and is only drawn here;
 * nothing on this page works one out, and a section the server said nothing
 * about is drawn without one rather than guessed at.
 *
 * A locked section still opens. The badge is there to save a student the trip,
 * not to stop them making it: the lock is the server's, enforced when the
 * section is asked for, and pressing one lands on the server's own reason.
 * (The server also leaves a locked section's description out of the roadmap,
 * which is why some section cards have none.)
 *
 * Challenges are a separate top-level feature, in no topic and behind no
 * roadmap, so this page neither fetches nor mentions them.
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

  /*
   * With the sections, which the table of contents did not use to ask for.
   *
   * They cost little: the roadmap list nests a section's title and its place,
   * not its materials — those are loaded per topic, by the topic page. What
   * they buy is the shape of the roadmap being readable from the roadmap
   * itself, rather than only after opening a topic to find out it had parts.
   */
  const load = useCallback(() => fetchRoadmaps({ withSubtopics: true }), []);
  const { data, error, loading, reload } = useAsync(load);

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
    /*
      Out of the gutter StudentLayout puts every page in, so the title bar below
      reaches both edges of the scroller the way the app header above it does.
      The size is not a guess: it is StudentLayout's PAGE_GUTTER, and a test
      holds the two together, because a negative margin that stops matching the
      padding it cancels is a page hanging over its own edges.
    */
    <div className="-m-8">
      {/*
        Pinned, so every pixel of it is taken from the path for as long as the
        page is open — on a 768px-tall laptop, under the app header, that is a
        real share of the screen. From sm the title and the count share one line
        rather than stacking, which keeps the bar to a single row.
      */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:flex sm:items-baseline sm:gap-x-3 sm:flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">
            Networking Roadmap
          </h1>
          {/* Counts the topics and stops there. The sections below carry the
              standing the server sent for each of them; a topic has none to
              carry, so the line above them claims nothing about order or
              access, and the topic's own page is where the rest is shown. */}
          <p className="text-sm text-gray-600 mt-1 sm:mt-0">
            {totalCount} topic{totalCount === 1 ? "" : "s"}. Open a topic to
            see your progress through it.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-10 space-y-16">
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
            onOpenSubtopic={(subtopic) => navigate(`/subtopic/${subtopic.id}`)}
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
 * The spine runs down the left until `xl`, and centres from there, with the
 * cards alternating either side of it. Not from `lg`: the sidebar takes 256px
 * of a laptop's width, and at 1024–1279px what is left cannot hold a card and
 * its sections on *both* sides of a centred spine — they hung off both edges of
 * the page, under the sidebar on one side and past the screen on the other.
 * The DOM order is the roadmap's order in every layout, so what is read aloud
 * and what is tabbed through is the sequence the instructor authored.
 */
function RoadmapPath({
  roadmap,
  shown,
  onShowMore,
  onShowLess,
  onOpen,
  onOpenSubtopic,
}: {
  roadmap: Roadmap;
  /** How many of this roadmap's topics to draw. */
  shown: number;
  onShowMore: () => void;
  onShowLess: () => void;
  onOpen: (topic: Topic) => void;
  onOpenSubtopic: (subtopic: Subtopic) => void;
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
      <div className="flex flex-col items-start xl:items-center gap-2 mb-6 lg:mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-white shadow-md">
          <Route className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h2
            id={headingId}
            className="text-sm font-bold uppercase tracking-wide"
          >
            {roadmap.title}
          </h2>
        </span>

        {/*
          w-full before the cap, because this sits in a flex column: without a
          width a flex item is sized to its content, so max-w-xl stopped being a
          ceiling and became the width — 576px of paragraph inside a 485px
          phone, which was the whole of the sideways scroll this page had.
          break-words handles the rest, since a description can arrive as one
          unbroken run of characters.
        */}
        {roadmap.description && (
          <p className="w-full text-sm text-gray-600 xl:text-center max-w-xl break-words">
            {roadmap.description}
          </p>
        )}
      </div>

      <div className="relative">
        {/* The path itself. One element, behind everything, from the first node
            to whatever ends the path. */}
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-5 xl:left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-300 via-blue-200 to-blue-100"
        />

        <ol className="space-y-6 lg:space-y-8">
          {visible.map((topic, index) => (
            <TopicNode
              key={topic.id}
              topic={topic}
              position={index + 1}
              // Alternating from the second node, so the path visibly weaves
              // rather than running down one side.
              cardOnLeft={index % 2 === 0}
              onOpen={() => onOpen(topic)}
              onOpenSubtopic={onOpenSubtopic}
            />
          ))}
        </ol>

        {(remaining > 0 || canCollapse) && (
          <div className="relative pt-8 pl-14 xl:pl-0 xl:flex xl:justify-center">
            {/* The node the path ends on. It points the way the path can still
                go: down while there is more to reveal, back up once there is
                not. */}
            <span
              aria-hidden="true"
              className="absolute top-8 left-5 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-blue-300 bg-white xl:left-1/2"
            >
              {remaining > 0 ? (
                <ChevronDown className="w-4 h-4 text-blue-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-blue-500" />
              )}
            </span>

            <div className="xl:mt-14 flex flex-col items-start xl:items-center gap-2">
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
 * One topic: a node on the line, the card it opens, and the sections branching
 * off it sideways.
 *
 * One row over three columns. The middle column is the spine's; the topic takes
 * an outer one and is pushed hard against the spine, so whatever else it
 * carries has to grow the other way — outward, into the margin of the page.
 * That is where the sections go: not under the card but beside it, on the far
 * side of it from the line, so the card sits between its own sections and the
 * roadmap they belong to.
 *
 * Which side that is falls straight out of which side the card is on. A card in
 * the left column branches left; a card in the right column branches right. The
 * branch is never between the card and the spine, because that space is the arm
 * joining the two, and a section standing in it would read as part of the path
 * rather than as part of the topic.
 *
 * Card and branch are centred against each other, which is what keeps the
 * numbered node level with the card it points at however many sections hang off
 * it — the node is centred on the row, and the card is centred in the row.
 *
 * That is the layout from `xl`. Between `lg` and `xl` the spine is still down
 * the left, so every card is on its right and there is only one outward margin:
 * the card sits against the spine and its sections branch off beside it, to the
 * right, exactly as a right-hand card does from `xl`.
 *
 * Below `lg` there is not room for even that. There is one column, and the
 * sections fall back under the card, which is the same tree read top to bottom.
 */
function TopicNode({
  topic,
  position,
  cardOnLeft,
  onOpen,
  onOpenSubtopic,
}: {
  topic: Topic;
  position: number;
  /** Which side of the spine the card sits on, from `xl` up. */
  cardOnLeft: boolean;
  onOpen: () => void;
  onOpenSubtopic: (subtopic: Subtopic) => void;
}) {
  const sections = topic.subtopics ?? [];

  // The outer column, and — since the card is pinned to the spine end of it —
  // the direction everything else in the row has to grow.
  const column = cardOnLeft
    ? "min-w-0 w-full xl:col-start-1 xl:justify-self-end"
    : "min-w-0 w-full xl:col-start-3 xl:justify-self-start";

  /*
   * Card and branch, side by side from `lg`.
   *
   * The card is first in the DOM either way, because that is the order it is
   * read and tabbed in: the topic, then what the topic is made of. On the left
   * of the spine the row is reversed visually so the card still ends up nearest
   * the line, which puts the branch out at the page's edge — and only from
   * `xl`, since before that no card is on the left.
   */
  const row = cardOnLeft
    ? "lg:flex lg:items-center lg:gap-6 xl:flex-row-reverse"
    : "lg:flex lg:items-center lg:gap-6";

  /*
   * The same width for every card on the path, so the branches all set off
   * from the same distance out rather than each row finding its own shape from
   * its own text.
   *
   * Between lg and xl that is a fixed width; the branch beside it takes what is
   * left. From xl it is a share of the column rather than a length. The column
   * is half of what is left of the page once the sidebar and the spine are
   * taken out, and on a laptop — 1280 or 1366 wide — that is under the 536px a
   * card and branch at their full size need; fixed widths there pushed both out
   * past the edges of the page. As shares, card and branch always sum to the
   * column, and the caps give them back their full size wherever it fits.
   */
  const cardWidth = "w-full lg:w-72 lg:shrink-0 xl:w-[52%] xl:max-w-[17rem]";

  return (
    <li className="relative min-w-0">
      <div className="relative min-w-0 pl-14 xl:pl-0 xl:grid xl:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] xl:items-center">
        {/* The arm from the spine to the card. Until xl every card is to the
            right of the line; from xl it reaches out to whichever side the
            card is on, and its inner end disappears under the node. From lg
            the card is centred in its row, so the arm and node are too. */}
        <span
          aria-hidden="true"
          className={`absolute top-8 left-5 h-0.5 w-7 -translate-y-1/2 bg-blue-200 lg:top-1/2 xl:w-8 ${
            cardOnLeft ? "xl:left-auto xl:right-1/2" : "xl:left-1/2"
          }`}
        />

        <span className="absolute top-8 left-5 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-xs font-bold text-blue-700 shadow-sm lg:top-1/2 xl:left-1/2">
          {position}
        </span>

        <div className={column}>
          <div className={row}>
            <div className={cardWidth}>
              <button
                type="button"
                onClick={onOpen}
                aria-label={`Open ${topic.title}`}
                className="group w-full min-w-0 text-left bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5 transition-all hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-700 break-words">
                  {topic.title}
                </h3>

                {topic.description && (
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3 break-words">
                    {topic.description}
                  </p>
                )}

                {topic.videoUrl && (
                  <span className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                    <Youtube
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Video
                  </span>
                )}
              </button>
            </div>

            {/* Beside the card, and outside the button: the card is one control,
                and a list of sections nested inside it would be read out as
                part of the label on the way in. */}
            {sections.length > 0 && (
              <TopicSections
                sections={sections}
                position={position}
                cardOnLeft={cardOnLeft}
                onOpen={onOpenSubtopic}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * The badge a section carries: what the server said about this student and it.
 *
 * Small, and deliberately quieter than the title above it — a section is
 * already subordinate to its topic, and a standing is subordinate to the
 * section. The word is what carries it; the icon only agrees with the word, so
 * nothing here rests on colour or on a shape alone.
 */
function SectionStatus({ status }: { status: SubtopicStatus }) {
  const Icon = status === "locked" ? Lock : status === "completed" ? CheckCircle2 : null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${SUBTOPIC_STATUS_STYLE[status]}`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {SUBTOPIC_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The sections inside one topic, branching off the outer edge of its card.
 *
 * Off the *card*, deliberately, and never off the spine. The spine is the
 * roadmap's sequence — a node on it is a topic a student walks to — so a
 * section standing on it would announce itself as the next topic along. This
 * hangs off the card's far edge instead, which says the opposite: these are
 * what that milestone is made of.
 *
 * The branch mirrors. A stem leaves the card's outer edge and meets a trunk;
 * the trunk runs down past every section, throwing an arm out to each. On the
 * left of the spine the trunk sits on the *right* of the section cards and the
 * arms reach left; on the right of the spine it is the other way about. Both
 * sides therefore grow away from the spine, which is what the arms joining the
 * cards to the spine already do.
 *
 * The stem enters the trunk halfway down, level with the middle of the list,
 * and every arm meets the middle of its own card. That is the difference from a
 * list hanging below a card: the trunk is a spine of its own, entered from the
 * side, and the sections read as siblings of one another rather than as a
 * sequence carrying on from the topic.
 *
 * Below `lg` there is one column with the roadmap's spine down its left and no
 * outward margin to branch into. There the whole branch falls back under the
 * card: trunk on the left, arms reaching right, entered from the top rather
 * than from the side. Every class below therefore names the stacked layout
 * first, moves the branch beside the card from `lg` — still on the card's
 * right, as every card is right of the spine until `xl` — and mirrors it for a
 * left-hand card only from `xl`.
 *
 * The cards are the topic card, stepped down: one border instead of two, no
 * shadow, a tinted ground and smaller type. Same design language, plainly
 * subordinate — a section must never read as a milestone of its own.
 *
 * Each one opens. A section has a page of its own — its materials live there
 * rather than inside the topic — so a section card is a way in, exactly as the
 * topic card beside it is. What keeps the two from reading alike is size and
 * weight, not one of them being inert: a section is plainly the smaller card,
 * hanging off the larger one, off the path rather than on it.
 */
function TopicSections({
  sections,
  position,
  cardOnLeft,
  onOpen,
}: {
  sections: Subtopic[];
  /** The parent topic's place on the path, so cards can carry it. */
  position: number;
  /** The parent's side from `xl`, which the branch mirrors rather than recomputes. */
  cardOnLeft: boolean;
  onOpen: (subtopic: Subtopic) => void;
}) {
  /*
   * The branch, as four kinds of line.
   *
   * Written out as whole class strings rather than assembled from parts: these
   * have to survive Tailwind's scanner, which reads source text and never sees
   * a name that was built at runtime.
   *
   * The trunk is drawn per section rather than as one rule down the list, which
   * is what lets it start at the first arm and stop at the last instead of
   * overshooting either. A run of segments reads as one line because the rows
   * are flush — the gap between them is padding inside a row, not margin
   * between rows, so there is nothing for the line to fall through.
   */

  // Between lg and xl, whatever the fixed card beside it leaves, up to a
  // readable measure. From xl, the rest of the column after the card's share
  // and the gap between them (see the card's width in TopicNode), capped the
  // same way — so every branch down a roadmap reaches the same distance out.
  const width =
    "w-full lg:flex-1 lg:min-w-0 lg:max-w-sm xl:flex-none xl:w-[calc(48%_-_1.5rem)] xl:max-w-[15rem]";

  const side = cardOnLeft
    ? "ml-6 pl-5 pt-3 lg:ml-0 lg:pt-0 xl:pl-0 xl:pr-5"
    : "ml-6 pl-5 pt-3 lg:ml-0 lg:pt-0";

  /*
   * The stem: the piece that leaves the card and reaches the trunk, level with
   * the middle of the list. It spans the gap the flex row puts between card and
   * branch, so it only exists once that row does — stacked, the top of the
   * trunk does this job instead.
   */
  const stem = cardOnLeft
    ? "hidden lg:block absolute top-1/2 -left-6 h-0.5 w-6 -translate-y-1/2 bg-blue-200 xl:left-auto xl:-right-6"
    : "hidden lg:block absolute top-1/2 -left-6 h-0.5 w-6 -translate-y-1/2 bg-blue-200";

  const trunkX = cardOnLeft
    ? "absolute w-0.5 bg-blue-200 -left-5 xl:left-auto xl:-right-5"
    : "absolute w-0.5 bg-blue-200 -left-5";

  const arm = cardOnLeft
    ? "absolute top-6 -left-5 h-0.5 w-5 -translate-y-1/2 bg-blue-200 lg:top-1/2 xl:left-auto xl:-right-5"
    : "absolute top-6 -left-5 h-0.5 w-5 -translate-y-1/2 bg-blue-200 lg:top-1/2";

  // The junction, drawn on the trunk: the spine's own node, three sizes down.
  const joint = cardOnLeft
    ? "absolute top-6 -left-5 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-blue-300 bg-white lg:top-1/2 xl:left-auto xl:-right-5"
    : "absolute top-6 -left-5 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-blue-300 bg-white lg:top-1/2";

  // Level with the section cards it heads: indented with them when stacked,
  // flush with them once they stand beside the card.
  const caption = cardOnLeft
    ? "ml-6 pl-5 text-xs font-medium text-gray-500 lg:ml-0 xl:pl-0 xl:pr-5 xl:text-right"
    : "ml-6 pl-5 text-xs font-medium text-gray-500 lg:ml-0";

  return (
    <div className={`mt-2 lg:mt-0 ${width}`}>
      <p className={caption}>
        {sections.length} section{sections.length === 1 ? "" : "s"} in this
        topic
      </p>

      {/*
        The stem is measured against the list rather than against the block as a
        whole, so that "halfway down" means halfway down the sections and not
        halfway down the caption plus the sections — which is what keeps it
        landing on the trunk however few sections there are.
      */}
      <div className="relative mt-1">
        <span aria-hidden="true" className={stem} />

        <ul className={side}>
          {sections.map((section, index) => {
            const isFirst = index === 0;
            const isLast = index === sections.length - 1;

            /*
             * How far this segment runs.
             *
             * Stacked, the first reaches up through the list's own top padding,
             * which is the stem coming down from the card, and the last stops
             * dead at its arm — a trunk continuing past the final section would
             * promise one more that never arrives.
             *
             * Beside the card the arms move to the middle of their own rows, so
             * the ends of the trunk move with them: it begins at the first
             * section's middle and finishes at the last one's. A lone section
             * needs no trunk at all — the stem arrives exactly where its arm
             * leaves.
             */
            const trunk = isLast
              ? isFirst
                ? "-top-3 h-9 lg:top-1/2 lg:h-0"
                : "top-0 h-6 lg:h-1/2"
              : isFirst
                ? "-top-3 bottom-0 lg:top-1/2"
                : "top-0 bottom-0";

            return (
              <li key={section.id} className="relative pb-2 last:pb-0">
                <span aria-hidden="true" className={`${trunkX} ${trunk}`} />
                <span aria-hidden="true" className={arm} />
                <span aria-hidden="true" className={joint} />

                <button
                  type="button"
                  onClick={() => onOpen(section)}
                  /*
                   * The standing goes in the name rather than beside it, so it
                   * is read once and reads as part of what the control is. No
                   * `disabled` and no `aria-disabled`, on a locked section
                   * least of all: it still opens, and saying otherwise here
                   * would be this page answering an authorization question
                   * that is the server's.
                   */
                  aria-label={labelWithStatus(`Open ${section.title}`, section.status)}
                  className="group block w-full text-left rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-blue-600 tabular-nums">
                      {position}.{index + 1}
                    </p>

                    {/* Only where the server judged. Undefined is "nothing was
                        said", which is not "locked" — a badge drawn for it
                        would be this page inventing the one state a student
                        cannot act on. */}
                    {section.status !== undefined && (
                      <SectionStatus status={section.status} />
                    )}
                  </div>

                  <p
                    className={`mt-0.5 text-sm font-semibold break-words group-hover:text-blue-700 ${
                      section.status === "locked" ? "text-gray-500" : "text-gray-800"
                    }`}
                  >
                    {section.title}
                  </p>
                  {section.description && (
                    <p className="mt-1 text-xs text-gray-600 leading-relaxed line-clamp-2 break-words">
                      {section.description}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
