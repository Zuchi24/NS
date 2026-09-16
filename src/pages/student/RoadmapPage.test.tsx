// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoadmapPage } from "./RoadmapPage";
import { PAGE_GUTTER } from "@/layouts/StudentLayout";
import { TOPIC_DESCRIPTION_MAX } from "@/features/content/topicService";
import type { Roadmap, Subtopic, Topic } from "@/features/content/types";

/**
 * The student's roadmap, as a path.
 *
 * These are about what a student can reach: every topic drawn is a way into
 * that topic, a long roadmap arrives five at a time rather than all at once,
 * and what has been revealed stays revealed until the student puts it away
 * themselves — the controls add to and take from one path, they do not page
 * through it.
 *
 * Challenges are deliberately absent. They hang off no topic and no roadmap, so
 * a page that fetched or drew one here would be inventing a relationship the
 * API does not have; one of these says the page never asks for them.
 */

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return { ...actual, fetchRoadmaps: vi.fn(), fetchChallenges: vi.fn() };
});

const navigate = vi.fn();

vi.mock("react-router", () => ({ useNavigate: () => navigate }));

const content = await import("@/features/content/contentService");

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 1,
    title: "Hardware and Cabling",
    description: "Building a machine and making a cable.",
    videoUrl: null,
    parentId: null,
    order: 0,
    ...over,
  };
}

/** A roadmap of `count` topics, numbered so each one is nameable. */
function roadmapOf(count: number, over: Partial<Roadmap> = {}): Roadmap {
  const id = over.id ?? 1;

  return {
    id,
    title: "Networking Essentials",
    description: "Where everyone starts.",
    order: 0,
    isPublished: true,
    topics: Array.from({ length: count }, (_, index) =>
      topic({
        id: id * 1000 + index + 1,
        roadmapId: id,
        title: `Topic ${index + 1}`,
        order: index,
      }),
    ),
    ...over,
  };
}

async function renderWith(roadmaps: Roadmap[]) {
  vi.mocked(content.fetchRoadmaps).mockResolvedValue(roadmaps);

  const result = render(<RoadmapPage />);

  await waitFor(() =>
    expect(screen.queryByText(/loading your roadmap/i)).not.toBeInTheDocument(),
  );

  return result;
}

/** The reveal control of the only roadmap on screen. */
function showMoreButton() {
  return screen.getByRole("button", { name: /show \d+ more topics?/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("fitting inside the student layout", () => {
  /**
   * The one piece of this page's layout that is not this page's to decide.
   *
   * StudentLayout puts every page in a gutter and leaves the scroller itself
   * unpadded, so that a sticky page header pins to the top of the viewport
   * rather than to the inside of a padding box. This page's title bar runs to
   * both edges, and the only way for a child to get back out of an ancestor's
   * padding is a negative margin of exactly that size.
   *
   * CSS cannot state that relationship, so it is stated here. If the layout's
   * gutter changes and this margin does not, the roadmap hangs over its own
   * edges and scrolls sideways, which is precisely what it used to do.
   */
  it("bleeds back out of exactly the gutter the layout puts it in", async () => {
    const { container } = await renderWith([roadmapOf(3)]);

    const expected = `-m-${PAGE_GUTTER.replace(/^p-/, "")}`;

    expect(PAGE_GUTTER).toMatch(/^p-\d+$/);
    expect(container.firstElementChild).toHaveClass(expected);
  });

  it("lets a long unbroken word wrap instead of widening the page", async () => {
    // A roadmap description is authored text and can arrive as one run of
    // characters with nowhere to break. Before this it set the width of the
    // paragraph, and the paragraph set the width of the page.
    const roadmap = roadmapOf(1);

    await renderWith([{ ...roadmap, description: "x".repeat(300) }]);

    const description = screen.getByText("x".repeat(300));

    // w-full so the cap below is a ceiling rather than the width itself, in a
    // flex column where an item is otherwise sized to its content.
    expect(description).toHaveClass("w-full", "max-w-xl", "break-words");
  });
});

describe("RoadmapPage", () => {
  it("draws every topic of a short roadmap as a node on the path", async () => {
    await renderWith([roadmapOf(3)]);

    expect(
      screen.getByRole("heading", { name: /networking essentials/i }),
    ).toBeInTheDocument();

    // Numbered in the order the instructor put them in, and each one a way in.
    expect(
      screen.getByRole("button", { name: "Open Topic 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Topic 3" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("opens the topic that was clicked", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(3)]);

    await user.click(screen.getByRole("button", { name: "Open Topic 2" }));

    // The topic page is where reading and learning materials live; this page
    // only leads to it.
    expect(navigate).toHaveBeenCalledWith("/topic/1002");
  });

  it("points to a topic for progress, and claims nothing about order or access", async () => {
    await renderWith([roadmapOf(3)]);

    // The page is not given the student's standing: sections inside a topic
    // are paced, so it neither promises "any order" nor draws a lock or a tick
    // it would have to make up.
    expect(
      screen.getByText("3 topics. Open a topic to see your progress through it."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/any order/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b(locked|completed|available)\b/i)).not.toBeInTheDocument();
  });

  it("says there is nothing to walk yet when no roadmap has topics", async () => {
    await renderWith([roadmapOf(0)]);

    expect(screen.getByText(/no roadmap published yet/i)).toBeInTheDocument();
  });

  it("keeps a node the same shape at the longest overview allowed", async () => {
    // 280 is the most an author can write (TOPIC_DESCRIPTION_MAX, enforced by
    // the API too), so it is the worst case the path has to draw. The card
    // holds its shape by clamping to three lines rather than by the layout
    // hoping descriptions stay short.
    const longest = "word ".repeat(56).trim();

    expect(longest).toHaveLength(TOPIC_DESCRIPTION_MAX - 1);

    await renderWith([
      roadmapOf(1, {
        id: 3,
        title: "Long overviews",
        topics: [
          topic({ id: 31, roadmapId: 3, title: "Wordy", description: longest }),
        ],
      }),
    ]);

    const overview = screen.getByText(longest);

    expect(overview).toBeInTheDocument();
    expect(overview.className).toContain("line-clamp-3");

    // And it is still one node on the path, opening the topic like any other.
    expect(
      screen.getByRole("button", { name: "Open Wordy" }),
    ).toBeInTheDocument();
  });

  it("never asks the API for challenges", async () => {
    await renderWith([roadmapOf(3)]);

    // Challenges are placed in no topic and gated by no roadmap. Drawing one
    // here would be inventing a link the API does not have.
    expect(content.fetchChallenges).not.toHaveBeenCalled();
  });

  /*
   * Walking a long roadmap open, and back
   *
   * Five at a time, in both directions. The path is not paginated: revealing
   * adds to what is already drawn and collapsing takes the same step back, so
   * a student can open a twenty-topic roadmap, look down it, and put it back
   * the way they found it.
   */

  it("starts a long roadmap at five topics, and offers the next five", async () => {
    await renderWith([roadmapOf(24)]);

    expect(
      screen.getByRole("button", { name: "Open Topic 5" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Topic 6" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Show 5 More Topics" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/showing 5 of 24 topics/i)).toBeInTheDocument();

    // Nothing to put away yet: a collapse could only take topics the student
    // arrived with.
    expect(
      screen.queryByRole("button", { name: /show less/i }),
    ).not.toBeInTheDocument();
  });

  it("adds the next five to the path rather than replacing them", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(24)]);

    await user.click(showMoreButton());

    // Not pagination: the first five are still on the path.
    expect(
      screen.getByRole("button", { name: "Open Topic 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Topic 10" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Topic 11" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/showing 10 of 24 topics/i)).toBeInTheDocument();
  });

  it("offers only what is left when fewer than five remain", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(6)]);

    // One left, said in the singular: a button promising five that produces
    // one is a button that lied.
    expect(
      screen.getByRole("button", { name: "Show 1 More Topic" }),
    ).toBeInTheDocument();

    await user.click(showMoreButton());

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(
      screen.queryByRole("button", { name: /show \d+ more/i }),
    ).not.toBeInTheDocument();
  });

  it("says how many are left over each step of a long roadmap", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(12)]);

    expect(
      screen.getByRole("button", { name: "Show 5 More Topics" }),
    ).toBeInTheDocument();

    await user.click(showMoreButton());
    expect(screen.getByText(/showing 10 of 12 topics/i)).toBeInTheDocument();

    // Two left over, so the last step offers two.
    expect(
      screen.getByRole("button", { name: "Show 2 More Topics" }),
    ).toBeInTheDocument();

    await user.click(showMoreButton());

    expect(screen.getByText(/showing 12 of 12 topics/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show \d+ more/i }),
    ).not.toBeInTheDocument();
  });

  it("offers Show Less once the whole roadmap is on the path", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(12)]);

    await user.click(showMoreButton());
    await user.click(showMoreButton());

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument();
    // The count line stays: it is what the controls are about.
    expect(screen.getByText(/showing 12 of 12 topics/i)).toBeInTheDocument();
  });

  it("collapses five at a time, and offers them back", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(12)]);

    await user.click(showMoreButton());
    await user.click(showMoreButton());

    await user.click(screen.getByRole("button", { name: /show less/i }));

    // Twelve less five, counted from what was on screen rather than from the
    // step that got there.
    expect(screen.getByText(/showing 7 of 12 topics/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Topic 7" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Topic 8" }),
    ).not.toBeInTheDocument();

    // What was put away can be asked for again.
    expect(
      screen.getByRole("button", { name: "Show 5 More Topics" }),
    ).toBeInTheDocument();
  });

  it("never collapses past the first five, so the path always starts somewhere", async () => {
    const user = userEvent.setup();

    await renderWith([roadmapOf(24)]);

    for (let reveal = 0; reveal < 4; reveal += 1) {
      await user.click(showMoreButton());
    }

    expect(screen.getAllByRole("listitem")).toHaveLength(24);

    // Collapsed all the way back down, one press at a time.
    for (let collapse = 0; collapse < 10; collapse += 1) {
      const button = screen.queryByRole("button", { name: /show less/i });

      if (button === null) break;

      await user.click(button);
    }

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText(/showing 5 of 24 topics/i)).toBeInTheDocument();
    // The first topic is never one of the ones put away.
    expect(
      screen.getByRole("button", { name: "Open Topic 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show less/i }),
    ).not.toBeInTheDocument();
  });

  it("offers neither control when the whole roadmap already fits", async () => {
    await renderWith([roadmapOf(5)]);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(
      screen.queryByRole("button", { name: /show \d+ more/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show less/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/showing \d+ of/i)).not.toBeInTheDocument();
  });

  it("moves one roadmap without touching another", async () => {
    const user = userEvent.setup();

    await renderWith([
      roadmapOf(12, { id: 1, title: "First roadmap" }),
      roadmapOf(12, { id: 2, title: "Second roadmap" }),
    ]);

    const first = screen.getByRole("region", { name: /first roadmap/i });
    const second = screen.getByRole("region", { name: /second roadmap/i });

    await user.click(
      within(second).getByRole("button", { name: /show 5 more topics/i }),
    );

    // The second path grew; the first is where the student left it.
    expect(within(second).getAllByRole("listitem")).toHaveLength(10);
    expect(within(first).getAllByRole("listitem")).toHaveLength(5);

    // And collapsing the second leaves the first alone in the same way.
    await user.click(within(second).getByRole("button", { name: /show less/i }));

    expect(within(second).getAllByRole("listitem")).toHaveLength(5);
    expect(within(first).getAllByRole("listitem")).toHaveLength(5);
  });
});

/**
 * The sections inside a topic, branching off the outer edge of its card.
 *
 * The risk these guard is a specific one: a section drawn as a node of the
 * spine would read as the next topic a student walks to, and the roadmap would
 * claim more milestones than the instructor wrote. So these are about
 * containment — a section belongs inside its topic's row, on its topic's side
 * — and about the path itself being untouched: the same nodes, the same
 * alternation, the same reveal.
 *
 * On top of that they hold the branch *beside* its card rather than under it.
 * Which side it takes is not a choice the branch makes: it is the side the card
 * already took, read outward, so the card always stands between the spine and
 * its own sections.
 *
 * The side assertions read class names, which is usually a poor way to test.
 * Here it is the thing itself: "the branch is on the far side of its card from
 * the spine" is a statement about layout and about nothing else, and a branch
 * that crossed back over the card would look wrong while every query about text
 * and nesting still passed.
 */
describe("the sections branching off a topic", () => {
  /** The list item for one topic — a section of it has to be found inside. */
  function nodeFor(title: string): HTMLElement {
    return screen.getByText(title).closest("li") as HTMLElement;
  }

  /** The block holding one topic's sections, found from the caption above it. */
  function branchOf(title: string): HTMLElement {
    return within(nodeFor(title))
      .getByText(/sections? in this topic/i)
      .closest("div") as HTMLElement;
  }

  /** The card for one topic — the control the node on the path opens. */
  function cardOf(title: string): HTMLElement {
    return within(nodeFor(title)).getByRole("button", {
      name: new RegExp(`^open ${title}$`, "i"),
    });
  }

  /**
   * The grid column something sits in: the nearest ancestor that picks one.
   *
   * Walked rather than selected, because which element carries the column is
   * exactly the layout detail these tests should not be pinned to — only that
   * the card and its branch end up in the same one.
   */
  function columnOf(start: HTMLElement): HTMLElement {
    let node: HTMLElement | null = start;

    while (node && !/lg:col-start-\d/.test(node.className)) {
      node = node.parentElement;
    }

    if (!node) throw new Error("nothing on the way up picks a column");
    return node;
  }

  function section(over: Partial<Subtopic> = {}): Subtopic {
    return {
      id: 900,
      roadmapId: 1,
      parentId: 1001,
      title: "A section",
      description: null,
      order: 0,
      materials: [],
      ...over,
    };
  }

  /**
   * Two topics with sections apiece.
   *
   * Two, because the page alternates sides from one topic to the next: one
   * topic could only ever prove the side it happened to land on.
   */
  function bothSides(counts: [number, number] = [2, 2]): Roadmap {
    const base = roadmapOf(2);

    return {
      ...base,
      topics: base.topics.map((parent, side) => ({
        ...parent,
        subtopics: Array.from({ length: counts[side] }, (_, index) =>
          section({
            id: 900 + side * 10 + index,
            parentId: parent.id,
            title: `Topic ${side + 1} section ${index + 1}`,
            order: index,
          }),
        ),
      })),
    };
  }

  it("asks for the sections along with the topics", async () => {
    await renderWith([roadmapOf(1)]);

    // Without this the page would draw a roadmap that never mentions its own
    // sections — the shape right, the content simply absent.
    expect(content.fetchRoadmaps).toHaveBeenCalledWith({ withSubtopics: true });
  });

  it("draws each section inside the topic holding it", async () => {
    await renderWith([bothSides()]);

    const first = nodeFor("Topic 1");

    // Nested, not merely adjacent. A flat path showing the same titles would
    // pass a query that only asked whether the words were on screen.
    expect(within(first).getByText("Topic 1 section 1")).toBeInTheDocument();
    expect(within(first).getByText("Topic 1 section 2")).toBeInTheDocument();
    expect(within(first).queryByText("Topic 2 section 1")).toBeNull();

    const second = nodeFor("Topic 2");
    expect(within(second).getByText("Topic 2 section 1")).toBeInTheDocument();
    expect(within(second).queryByText("Topic 1 section 1")).toBeNull();
  });

  it("branches a left-hand topic to the left of the spine", async () => {
    await renderWith([bothSides()]);

    // The first topic takes the left column, so its branch takes it too: the
    // same `lg:col-start-1` the card uses, never the right-hand column.
    const column = columnOf(branchOf("Topic 1"));

    expect(column.className).toContain("lg:col-start-1");
    expect(column.className).not.toContain("lg:col-start-3");
  });

  it("branches a right-hand topic to the right of the spine", async () => {
    await renderWith([bothSides()]);

    const column = columnOf(branchOf("Topic 2"));

    expect(column.className).toContain("lg:col-start-3");
    expect(column.className).not.toContain("lg:col-start-1");
  });

  it("sets the sections beside their card rather than under it", async () => {
    await renderWith([bothSides()]);

    // The card and the branch share one row. Under the old shape they were in
    // two, stacked, and every other assertion in this file still passed — so
    // this is the one that says the branch grew sideways.
    for (const title of ["Topic 1", "Topic 2"]) {
      const row = branchOf(title).parentElement as HTMLElement;

      expect(row).toContain(cardOf(title));
      expect(row.className).toContain("lg:flex");
      expect(row.className).toContain("lg:items-center");
    }
  });

  it("puts a left-hand card between the spine and its own sections", async () => {
    await renderWith([bothSides()]);

    // Reversing the row is what moves the branch to the outside: the card is
    // first in the DOM on both sides, so on the left of the spine it has to be
    // drawn last to stay the nearer of the two to the line.
    const left = branchOf("Topic 1").parentElement as HTMLElement;
    const right = branchOf("Topic 2").parentElement as HTMLElement;

    expect(left.className).toContain("lg:flex-row-reverse");
    expect(right.className).not.toContain("lg:flex-row-reverse");
  });

  it("mirrors the branch rail so both sides grow away from the spine", async () => {
    await renderWith([bothSides()]);

    const left = within(branchOf("Topic 1")).getByRole("list");
    const right = within(branchOf("Topic 2")).getByRole("list");

    // The list makes room on the side its trunk runs down...
    expect(left.className).toContain("lg:pr-5");
    expect(right.className).not.toContain("lg:pr-5");
    expect(right.className).toContain("pl-5");

    // ...and the trunk itself moves to that side. On the left of the spine it
    // sits on the right of its column so the arms reach outward; on the right
    // it stays put and they reach outward the other way. Below lg there is one
    // column and both use the left trunk, which is why each keeps `-left-5`.
    const trunk = (list: HTMLElement) =>
      (list.querySelector("li > span") as HTMLElement).className;

    expect(trunk(left)).toContain("lg:-right-5");
    expect(trunk(left)).toContain("lg:left-auto");
    expect(trunk(left)).toContain("-left-5");
    expect(trunk(right)).not.toContain("lg:-right-5");
    expect(trunk(right)).toContain("-left-5");
  });

  it("numbers a section inside its topic rather than along the path", async () => {
    await renderWith([bothSides()]);

    // "1.1"/"1.2" under the first topic, "2.1"/"2.2" under the second — a
    // section can never be read as the next milestone.
    expect(within(nodeFor("Topic 1")).getByText("1.1")).toBeInTheDocument();
    expect(within(nodeFor("Topic 1")).getByText("1.2")).toBeInTheDocument();
    expect(within(nodeFor("Topic 2")).getByText("2.1")).toBeInTheDocument();
    expect(within(nodeFor("Topic 2")).getByText("2.2")).toBeInTheDocument();
  });

  it("says how many sections a topic is divided into", async () => {
    await renderWith([bothSides([1, 3])]);

    expect(
      within(nodeFor("Topic 1")).getByText(/1 section in this topic/i),
    ).toBeInTheDocument();
    expect(
      within(nodeFor("Topic 2")).getByText(/3 sections in this topic/i),
    ).toBeInTheDocument();
  });

  it("keeps every section off the path itself", async () => {
    await renderWith([bothSides()]);

    /*
     * Two stops on the path, for the two topics — whatever those topics hold.
     * A section standing on the path would be a further stop on a roadmap the
     * instructor wrote two.
     *
     * Counted as the path's own children rather than as controls, because a
     * section is a control of its own now: what keeps it off the path is that
     * it hangs inside a topic's stop, not that it cannot be clicked.
     */
    const path = nodeFor("Topic 1").parentElement as HTMLElement;

    expect(path.tagName).toBe("OL");
    expect(path.children).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /open Topic 1$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open Topic 2$/i }),
    ).toBeInTheDocument();
  });

  it("opens a section on a page of its own", async () => {
    const user = userEvent.setup();
    await renderWith([bothSides()]);

    // A section is a way in now, not a label. It goes to its own address —
    // never to the topic holding it, which would make the click a lie about
    // where it landed.
    await user.click(
      screen.getByRole("button", { name: /Topic 1 section 2/i }),
    );

    expect(navigate).toHaveBeenCalledWith("/subtopic/901");
  });

  it("draws one section, four sections, or none at all", async () => {
    await renderWith([bothSides([1, 4])]);

    expect(within(nodeFor("Topic 1")).getAllByRole("listitem")).toHaveLength(1);
    expect(within(nodeFor("Topic 2")).getAllByRole("listitem")).toHaveLength(4);

    cleanup();

    // And a topic with none draws no branch at all, rather than an empty rail.
    await renderWith([roadmapOf(1)]);
    expect(
      screen.queryByText(/sections? in this topic/i),
    ).not.toBeInTheDocument();
  });

  it("still opens the topic a section belongs to", async () => {
    const user = userEvent.setup();
    await renderWith([bothSides()]);

    // Anchored: the sections of Topic 1 are controls too, and their labels
    // start with the same words.
    await user.click(screen.getByRole("button", { name: /open Topic 1$/i }));

    expect(navigate).toHaveBeenCalledWith("/topic/1001");
  });

  it("leaves the spine and the alternation alone", async () => {
    await renderWith([bothSides()]);

    // The card rows still alternate: first left, second right. The branch
    // reads its side from this rather than deciding one of its own.
    expect(columnOf(cardOf("Topic 1")).className).toContain("lg:col-start-1");
    expect(columnOf(cardOf("Topic 2")).className).toContain("lg:col-start-3");
  });
});
