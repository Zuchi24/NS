// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SubtopicDetailsPage } from "./SubtopicDetailsPage";
import type { LearningMaterial, Subtopic, Topic } from "@/features/content/types";

/**
 * The student's view of one section, on a page of its own.
 *
 * What these are about is that a section page is a section's page and not a
 * small topic page. Its materials are here and the topic's are not; it says
 * which topic and which roadmap it sits in, because a page about a part is
 * meaningless without the whole; previous and next walk that topic's sections
 * rather than the roadmap's topics, so a student cannot fall out of the topic
 * they are reading by pressing next; and back goes to the roadmap, where the
 * section was opened from.
 *
 * The refusals are here for the same reason they are on the topic page. A URL
 * can be typed, so "this section is in a roadmap nobody has published" and
 * "this id is not a section at all" both have to land somewhere honest rather
 * than on a half-drawn page.
 */

const navigate = vi.fn();
const user = userEvent.setup();

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ subtopicId: "101" }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ isAdmin: false }),
}));

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return { ...actual, fetchSubtopic: vi.fn() };
});

const content = await import("@/features/content/contentService");
const { ApiError } = await import("@/services/api");

function material(over: Partial<LearningMaterial> = {}): LearningMaterial {
  return {
    id: 10,
    topicId: 101,
    title: "Layer chart",
    description: null,
    kind: "link",
    kindLabel: "Link",
    url: "https://example.com",
    downloadUrl: null,
    filename: null,
    mimeType: null,
    sizeBytes: null,
    order: 0,
    isPublished: true,
    ...over,
  };
}

function subtopic(over: Partial<Subtopic> = {}): Subtopic {
  return {
    id: 101,
    roadmapId: 1,
    parentId: 1,
    title: "OSI Model",
    description: "Seven layers.",
    order: 0,
    materials: [],
    ...over,
  };
}

const parent: Topic = {
  id: 1,
  roadmapId: 1,
  title: "Networking Fundamentals",
  description: "How a network holds together.",
  videoUrl: null,
  parentId: null,
  order: 0,
};

const siblings = [
  subtopic({ id: 100, title: "What a Network Is", order: 0 }),
  subtopic({ id: 101, title: "OSI Model", order: 1 }),
  subtopic({ id: 102, title: "TCP/IP", order: 2 }),
];

/** Serves the section at 101, which sits in the middle of three. */
function serve(over: Partial<Subtopic> = {}) {
  const section = subtopic({ order: 1, ...over });

  vi.mocked(content.fetchSubtopic).mockResolvedValue({
    subtopic: section,
    parent,
    roadmapTitle: "Networking Essentials",
    siblings: siblings.map((sibling) =>
      sibling.id === section.id ? section : sibling,
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("a section's own page", () => {
  it("draws the section's materials and nobody else's", async () => {
    serve({
      materials: [
        material({ id: 10, title: "Layer chart" }),
        material({ id: 11, title: "Layer poster", order: 1 }),
      ],
    });

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText("Layer chart")).toBeInTheDocument();
    expect(screen.getByText("Layer poster")).toBeInTheDocument();

    // The heading is the section's own. "Topic Materials" here would be a page
    // claiming to hold something it does not.
    expect(screen.getByText("Learning Materials")).toBeInTheDocument();
    expect(screen.queryByText("Topic Materials")).not.toBeInTheDocument();
  });

  it("says which topic and roadmap the section sits in", async () => {
    serve();

    render(<SubtopicDetailsPage />);

    // A page about a part of something has to name the whole, or a student
    // arriving from a link has no idea what they are reading a part of.
    expect(
      await screen.findByText(/Networking Essentials/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Networking Fundamentals/).length).toBeGreaterThan(0);
  });

  it("places the section among the topic's sections", async () => {
    serve();

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText(/subtopic 2 of 3/i)).toBeInTheDocument();
  });

  it("says a section is empty rather than leaving a gap", async () => {
    serve({ materials: [] });

    render(<SubtopicDetailsPage />);

    expect(
      await screen.findByText(/no learning materials in this subtopic yet/i),
    ).toBeInTheDocument();
  });

  it("shows nothing that paces a section", async () => {
    serve({ materials: [material()] });

    render(<SubtopicDetailsPage />);

    await screen.findByText("Layer chart");

    /*
     * A section is a heading with materials under it. There is no standing to
     * report, nothing to unlock and no challenges of its own — and no video
     * either, which a section cannot be given.
     */
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/challenge/i)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("navigation", () => {
  it("goes back to the roadmap", async () => {
    serve();

    render(<SubtopicDetailsPage />);

    // Where the section was opened from, and so where leaving it puts a
    // student back. Which topic holds it is written above the title instead.
    await user.click(
      await screen.findByRole("button", { name: /back to roadmap/i }),
    );

    expect(navigate).toHaveBeenCalledWith("/roadmap");
    expect(navigate).not.toHaveBeenCalledWith("/topic/1");
  });

  it("walks the topic's sections rather than the roadmap's topics", async () => {
    serve();

    render(<SubtopicDetailsPage />);

    await screen.findByText(/subtopic 2 of 3/i);

    // The section at 101 sits between 100 and 102, so both steps exist and
    // both stay inside this topic.
    await user.click(screen.getByRole("button", { name: /previous subtopic/i }));
    expect(navigate).toHaveBeenCalledWith("/subtopic/100");

    await user.click(screen.getByRole("button", { name: /next subtopic/i }));
    expect(navigate).toHaveBeenCalledWith("/subtopic/102");
  });

  it("stops at the ends of the topic instead of stepping out of it", async () => {
    vi.mocked(content.fetchSubtopic).mockResolvedValue({
      subtopic: siblings[0],
      parent,
      roadmapTitle: "Networking Essentials",
      siblings: [siblings[0]],
    });

    render(<SubtopicDetailsPage />);

    await screen.findByText(/subtopic 1 of 1/i);

    // A topic's only section has nowhere to step in either direction. Enabling
    // either would walk a student into the next topic without saying so.
    expect(
      screen.getByRole("button", { name: /previous subtopic/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /next subtopic/i }),
    ).toBeDisabled();
  });

  it("offers the rest of the topic without going back out for it", async () => {
    serve();

    render(<SubtopicDetailsPage />);

    const list = (await screen.findByText(/in this topic/i)).closest(
      "div",
    ) as HTMLElement;

    // Every section of the topic is reachable from any of them, and the one
    // being read is marked rather than offered as a link to itself.
    await user.click(within(list).getByRole("button", { name: /open TCP\/IP/i }));
    expect(navigate).toHaveBeenCalledWith("/subtopic/102");

    expect(
      within(list).queryByRole("button", { name: /open OSI Model/i }),
    ).not.toBeInTheDocument();
    expect(
      within(list).getByText("OSI Model").closest("[aria-current='page']"),
    ).not.toBeNull();
  });
});

describe("when there is no section to draw", () => {
  it("says so rather than drawing a page when the roadmap is unpublished", async () => {
    vi.mocked(content.fetchSubtopic).mockRejectedValue(
      new ApiError("Forbidden", 403),
    );

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText(/subtopic locked/i)).toBeInTheDocument();
  });

  it("says so when the id names a topic rather than a section", async () => {
    // fetchSubtopic answers null for a root topic: it has a page of its own
    // and this route is not it.
    vi.mocked(content.fetchSubtopic).mockResolvedValue(null);

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText(/subtopic not found/i)).toBeInTheDocument();
  });
});
