// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoadmapAdminPage } from "./RoadmapAdminPage";
import type { Challenge, Roadmap, Topic } from "@/features/content/types";

/**
 * The authoring page's roadmap picker.
 *
 * What matters here is that a draft roadmap is offered and is visibly marked as
 * one. The page does no filtering of its own — the API sends students published
 * roadmaps and nothing else, and sends staff both — so these say the page shows
 * what it was given and labels it honestly, not that it hides anything.
 */

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return {
    ...actual,
    fetchRoadmaps: vi.fn(),
    fetchChallenges: vi.fn(),
  };
});

// The materials panel does its own fetching; stubbed so these tests are about
// the page rather than about what hangs off the selected topic.
vi.mock("./TopicMaterialsPanel", () => ({
  TopicMaterialsPanel: () => <div data-testid="materials-panel" />,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const content = await import("@/features/content/contentService");

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 1,
    title: "Released topic",
    description: null,
    videoUrl: null,
    order: 0,
    challengesCount: 0,
    progress: null,
    ...over,
  };
}

function roadmap(over: Partial<Roadmap> = {}): Roadmap {
  return {
    id: 1,
    title: "Released roadmap",
    description: "Out already.",
    order: 0,
    isPublished: true,
    topics: [topic()],
    ...over,
  };
}

const draft = roadmap({
  id: 2,
  title: "Unreleased roadmap",
  description: "Still being written.",
  order: 1,
  isPublished: false,
  topics: [topic({ id: 2, roadmapId: 2, title: "Unreleased topic" })],
});

async function renderWith(roadmaps: Roadmap[], challenges: Challenge[] = []) {
  vi.mocked(content.fetchRoadmaps).mockResolvedValue(roadmaps);
  vi.mocked(content.fetchChallenges).mockResolvedValue(challenges);

  const result = render(<RoadmapAdminPage />);

  await waitFor(() =>
    expect(screen.queryByText(/loading catalogue/i)).not.toBeInTheDocument(),
  );

  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("RoadmapAdminPage", () => {
  it("offers every roadmap the API returned, drafts included", async () => {
    await renderWith([roadmap(), draft]);

    const picker = screen.getByLabelText(/authoring/i);

    expect(picker).toBeInTheDocument();
    // Exact names: "Unreleased roadmap" contains "Released roadmap", so a
    // loose match here would pass on either option alone.
    expect(
      screen.getByRole("option", { name: "Released roadmap" }),
    ).toBeInTheDocument();
    // Before the fix the list simply did not contain this one, so there was no
    // way to reach an unpublished roadmap from this page at all.
    expect(
      screen.getByRole("option", { name: "Unreleased roadmap (draft)" }),
    ).toBeInTheDocument();
  });

  it("marks a draft in the option text, not only beside the title", async () => {
    await renderWith([roadmap(), draft]);

    // A native select shows only the chosen row when it is closed, so a badge
    // alone would not say which of the *others* are still drafts.
    expect(
      screen.getByRole("option", { name: "Released roadmap" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Unreleased roadmap (draft)" }),
    ).toBeInTheDocument();
  });

  it("says nothing about drafts when every roadmap is published", async () => {
    await renderWith([roadmap()]);

    expect(screen.queryByText(/^draft$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/is unpublished/i)).not.toBeInTheDocument();
  });

  it("marks the selected roadmap as a draft and says what that means", async () => {
    const user = userEvent.setup();

    await renderWith([roadmap(), draft]);

    await user.selectOptions(screen.getByLabelText(/authoring/i), "2");

    expect(screen.getAllByText(/^draft$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/students cannot see it/i)).toBeInTheDocument();
  });

  it("shows the selected draft roadmap's topics for authoring", async () => {
    const user = userEvent.setup();

    await renderWith([roadmap(), draft]);

    await user.selectOptions(screen.getByLabelText(/authoring/i), "2");

    // Selecting the draft is only useful if its topics come with it — that is
    // what the authoring panel works on. The title appears twice on the page,
    // in the authoring list and again as the selected topic's heading.
    expect(screen.getAllByText("Unreleased topic").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 topic in Unreleased roadmap/i)).toBeInTheDocument();
  });

  it("starts on the first roadmap when none has been picked", async () => {
    await renderWith([roadmap(), draft]);

    expect(screen.getByLabelText(/authoring/i)).toHaveValue("1");
    expect(screen.queryByText(/is unpublished/i)).not.toBeInTheDocument();
  });

  it("offers a draft-only catalogue rather than claiming it is empty", async () => {
    // An instructor whose only roadmap is still unpublished has to be able to
    // work on it. Before the fix this page showed them an empty catalogue.
    await renderWith([draft]);

    expect(screen.queryByText(/no roadmaps yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/is unpublished/i)).toBeInTheDocument();
    expect(screen.getAllByText("Unreleased topic").length).toBeGreaterThan(0);
  });

  it("says the catalogue is empty only when it really is", async () => {
    await renderWith([]);

    expect(screen.getByText(/no roadmaps yet/i)).toBeInTheDocument();
  });
});
