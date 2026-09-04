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
import { TOPIC_DESCRIPTION_MAX } from "@/features/content/topicService";
import type { Roadmap, Topic } from "@/features/content/types";

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
