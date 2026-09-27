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
import { RouterProvider, createMemoryRouter } from "react-router";

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

// The materials panel does its own fetching, and hangs off whichever topic
// card is open; stubbed so these tests are about the page rather than about it.
vi.mock("./TopicMaterialsPanel", () => ({
  TopicMaterialsPanel: () => <div data-testid="materials-panel" />,
}));

// The same for a topic's assessments, which fetch and navigate on their own.
vi.mock("./TopicAssessmentsPanel", () => ({
  TopicAssessmentsPanel: () => <div data-testid="assessments-panel" />,
}));

// The roadmap writes go to their own service; stubbed so these say what the
// page does with a write rather than exercising the network layer again.
vi.mock("@/features/content/roadmapService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/roadmapService")
  >();

  return {
    ...actual,
    createRoadmap: vi.fn(),
    updateRoadmap: vi.fn(),
    publishRoadmap: vi.fn(),
    unpublishRoadmap: vi.fn(),
    deleteRoadmap: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const content = await import("@/features/content/contentService");
const roadmapService = await import("@/features/content/roadmapService");

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 1,
    title: "Released topic",
    description: null,
    videoUrl: null,
    parentId: null,
    order: 0,
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

async function renderWith(
  roadmaps: Roadmap[],
  challenges: Challenge[] = [],
  path = "/admin/roadmap",
) {
  vi.mocked(content.fetchRoadmaps).mockResolvedValue(roadmaps);
  vi.mocked(content.fetchChallenges).mockResolvedValue(challenges);

  // Inside a router, because the selected roadmap lives in the address.
  const router = createMemoryRouter(
    [{ path: "/admin/roadmap", element: <RoadmapAdminPage /> }],
    { initialEntries: [path] },
  );

  const result = render(<RouterProvider router={router} />);

  await waitFor(() =>
    expect(screen.queryByText(/loading catalogue/i)).not.toBeInTheDocument(),
  );

  return { ...result, router };
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
    // what the authoring panel works on. Each topic is one card, folded until
    // the author opens it.
    expect(screen.getByText("Unreleased topic")).toBeInTheDocument();
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

/**
 * The roadmap layer and the topic layer, on one page.
 *
 * These are about the seam between them rather than about either panel's own
 * behaviour — that a write to a roadmap reloads the catalogue and leaves the
 * right one selected, and that selecting a roadmap still puts its topics in
 * front of the author, which is the whole reason the picker is here.
 */
describe("managing roadmaps alongside their topics", () => {
  it("keeps managing the selected roadmap's topics", async () => {
    const user = userEvent.setup();

    await renderWith([roadmap(), draft]);

    await user.selectOptions(screen.getByLabelText(/authoring/i), "2");

    // The topics panel is the thing the selection exists to feed.
    expect(
      screen.getByText(/1 topic in Unreleased roadmap/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add topic/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unreleased topic").length).toBeGreaterThan(0);
  });

  it("reloads the catalogue and lands on the roadmap just created", async () => {
    const user = userEvent.setup();
    const created = roadmap({
      id: 3,
      title: "Network Security",
      description: "New.",
      isPublished: false,
      topics: [],
    });

    await renderWith([roadmap()]);

    vi.mocked(roadmapService.createRoadmap).mockResolvedValueOnce(created);
    // The reload sees the roadmap the write added.
    vi.mocked(content.fetchRoadmaps).mockResolvedValue([roadmap(), created]);

    await user.click(screen.getByRole("button", { name: /new roadmap/i }));
    await user.type(screen.getByLabelText(/^title$/i), "Network Security");
    await user.click(
      within(screen.getByRole("form")).getByRole("button", {
        name: /^add roadmap$/i,
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/authoring/i)).toHaveValue("3"),
    );

    // The new roadmap is a draft with nothing in it, and the page says so
    // rather than leaving the author on the roadmap they were on before.
    expect(screen.getByText(/is unpublished/i)).toBeInTheDocument();
    expect(screen.getByText(/no topics in this roadmap/i)).toBeInTheDocument();
  });

  it("falls back to what is left after the selected roadmap is deleted", async () => {
    const user = userEvent.setup();

    await renderWith([roadmap(), draft]);

    await user.selectOptions(screen.getByLabelText(/authoring/i), "2");

    vi.mocked(roadmapService.deleteRoadmap).mockResolvedValueOnce(undefined);
    vi.mocked(content.fetchRoadmaps).mockResolvedValue([roadmap()]);

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /delete roadmap/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/authoring/i)).toHaveValue("1"),
    );

    expect(
      screen.queryByRole("option", { name: "Unreleased roadmap (draft)" }),
    ).not.toBeInTheDocument();
  });

  it("offers a create form on an empty catalogue instead of a dead end", async () => {
    await renderWith([]);

    expect(
      screen.getByRole("button", { name: /new roadmap/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing to author yet/i)).toBeInTheDocument();
  });
});

/**
 * The selection, held in the address.
 *
 * The assessment builder is a page of its own, and its Back link can only
 * return an author to where they were if where they were is written down
 * somewhere both pages can read. These say the page reads it, writes it, and
 * degrades to its old behaviour when there is nothing usable there.
 */
describe("remembering where the author was", () => {
  it("opens on the roadmap the address names", async () => {
    await renderWith([roadmap(), draft], [], "/admin/roadmap?roadmap=2");

    expect(screen.getByLabelText(/authoring/i)).toHaveValue("2");
    expect(
      screen.getByText(/1 topic in Unreleased roadmap/i),
    ).toBeInTheDocument();
  });

  it("falls back to the first roadmap when the one named is not there", async () => {
    await renderWith([roadmap(), draft], [], "/admin/roadmap?roadmap=99");

    expect(screen.getByLabelText(/authoring/i)).toHaveValue("1");
  });

  it("writes the picked roadmap into the address", async () => {
    const user = userEvent.setup();

    const { router } = await renderWith([roadmap(), draft]);

    expect(router.state.location.search).toBe("");

    await user.selectOptions(screen.getByLabelText(/authoring/i), "2");

    await waitFor(() =>
      expect(router.state.location.search).toBe("?roadmap=2"),
    );
    expect(screen.getByLabelText(/authoring/i)).toHaveValue("2");
  });

  it("reopens the topic the address names", async () => {
    await renderWith([roadmap(), draft], [], "/admin/roadmap?roadmap=2&topic=2");

    expect(
      screen.getByRole("button", { name: /collapse unreleased topic/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("assessments-panel")).toBeInTheDocument();
  });

  it("forgets the topic once another roadmap is picked", async () => {
    const user = userEvent.setup();

    const { router } = await renderWith(
      [roadmap(), draft],
      [],
      "/admin/roadmap?roadmap=2&topic=2",
    );

    await user.selectOptions(screen.getByLabelText(/authoring/i), "1");

    await waitFor(() =>
      expect(router.state.location.search).toBe("?roadmap=1"),
    );
    expect(
      screen.getByRole("button", { name: /expand released topic/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

/*
 * Layout is not measured in jsdom, so these pin the classes that keep the page
 * inside a phone-width screen: a long roadmap name in the picker once widened
 * the whole column past the viewport, and the topic rows' controls squeezed
 * the titles out.
 */
describe("RoadmapAdminPage on a narrow screen", () => {
  it("keeps the single column to the width of the screen", async () => {
    await renderWith([roadmap()]);

    const layout = screen.getByLabelText(/authoring/i).closest(".grid");

    expect(layout).toHaveClass("grid-cols-1", "lg:grid-cols-[400px_1fr]");
  });

  it("lets each card's heading controls wrap below the title", async () => {
    await renderWith([roadmap()]);

    expect(
      screen.getByRole("button", { name: /new roadmap/i }).parentElement,
    ).toHaveClass("flex-wrap");
    expect(
      screen.getByRole("button", { name: /add topic/i }).parentElement,
    ).toHaveClass("flex-wrap");
  });

  it("lets a topic's controls wrap below it rather than crush its title", async () => {
    await renderWith([roadmap()]);

    const title = screen.getByRole("button", { name: /expand released topic/i })
      .parentElement as HTMLElement;

    expect(title).toHaveClass("min-w-0", "flex-[1_1_10rem]");
    expect(title.parentElement).toHaveClass("flex-wrap");
  });
});
