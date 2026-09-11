// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TopicDetailsPage } from "./TopicDetailsPage";
import type { LearningMaterial, Subtopic, Topic } from "@/features/content/types";

/**
 * The student's view of one topic and the sections inside it.
 *
 * A section has a page of its own now, so what this page owes a student about
 * one is a way in and enough to decide whether to take it — not the section's
 * contents. These hold that line from both sides: the sections are listed and
 * they open, and no material filed under a section is drawn here, because the
 * same reading in two places is how the two places drift apart.
 *
 * What has not changed is that a section is part of the topic rather than a
 * topic of its own. The topic's own materials stay the topic's, nothing about a
 * section suggests it is something to finish — a section paces nothing, and a
 * progress bar or a lock on one would be telling a student something untrue —
 * and previous and next still walk topics, so a section never appears in that
 * walk and sends a student sideways out of what they are reading.
 */

const navigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ topicId: "1" }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ isAdmin: false }),
}));

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return { ...actual, fetchTopic: vi.fn() };
});

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return { ...actual, fetchTopicMaterials: vi.fn() };
});

const content = await import("@/features/content/contentService");
const materials = await import("@/features/content/materialService");

function material(over: Partial<LearningMaterial> = {}): LearningMaterial {
  return {
    id: 1,
    topicId: 1,
    title: "A handout",
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

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 1,
    title: "Networking Fundamentals",
    description: "How a network holds together.",
    videoUrl: null,
    parentId: null,
    order: 0,
    ...over,
  };
}

function subtopic(over: Partial<Subtopic> = {}): Subtopic {
  return {
    id: 101,
    roadmapId: 1,
    parentId: 1,
    title: "OSI Model",
    description: null,
    order: 0,
    materials: [],
    ...over,
  };
}

const siblings = [
  topic({ id: 1, title: "Networking Fundamentals", order: 0 }),
  topic({ id: 2, title: "Routing", order: 1 }),
];

/** Stubs one topic page's two requests. */
function serve({
  subtopics = [] as Subtopic[],
  topicMaterials = [] as LearningMaterial[],
}) {
  vi.mocked(content.fetchTopic).mockResolvedValue({
    topic: topic(),
    roadmapTitle: "Networking Essentials",
    siblings,
    subtopics,
  });

  vi.mocked(materials.fetchTopicMaterials).mockResolvedValue(topicMaterials);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("a topic that is divided into subtopics", () => {
  /** A topic with two subtopics, each holding a material of its own. */
  function withSubtopics() {
    serve({
      topicMaterials: [material({ id: 1, title: "Topic handout" })],
      subtopics: [
        subtopic({
          id: 101,
          title: "OSI Model",
          materials: [material({ id: 10, topicId: 101, title: "Layer chart" })],
        }),
        subtopic({
          id: 102,
          title: "TCP/IP",
          order: 1,
          materials: [material({ id: 11, topicId: 102, title: "Handshake" })],
        }),
      ],
    });
  }

  it("says nothing about its subtopics at all", async () => {
    withSubtopics();

    render(<TopicDetailsPage />);

    await screen.findByText("Topic handout");

    /*
     * Not the block, not the titles, not a count. A subtopic is reached from
     * the roadmap and read on a page of its own; repeating any of it here is
     * the same reading in two places, which is what having that page was for.
     */
    expect(
      screen.queryByRole("region", { name: /subtopics/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("OSI Model")).not.toBeInTheDocument();
    expect(screen.queryByText("TCP/IP")).not.toBeInTheDocument();
    expect(screen.queryByText(/sections? in this topic/i)).not.toBeInTheDocument();
  });

  it("draws its own materials and no subtopic's", async () => {
    withSubtopics();

    render(<TopicDetailsPage />);

    expect(await screen.findByText("Topic handout")).toBeInTheDocument();
    expect(screen.queryByText("Layer chart")).not.toBeInTheDocument();
    expect(screen.queryByText("Handshake")).not.toBeInTheDocument();
  });

  it("reads under one heading however the topic is divided", async () => {
    withSubtopics();

    render(<TopicDetailsPage />);

    // "Topic Materials" only made sense while a second list of somebody else's
    // sat under it. With that gone there is nothing to be told apart from.
    expect(await screen.findByText("Learning Materials")).toBeInTheDocument();
    expect(screen.queryByText("Topic Materials")).not.toBeInTheDocument();
  });

  it("still says when the topic has no materials of its own", async () => {
    serve({
      topicMaterials: [],
      subtopics: [
        subtopic({
          id: 101,
          materials: [material({ id: 10, topicId: 101, title: "Layer chart" })],
        }),
      ],
    });

    render(<TopicDetailsPage />);

    // A topic whose material all lives in its subtopics used to have this card
    // suppressed, because the subtopics were underneath it. Now there is
    // nothing underneath, and a column drawn empty would look broken.
    expect(
      await screen.findByText(/no learning materials for this topic yet/i),
    ).toBeInTheDocument();
  });
});

describe("a topic with no sections", () => {
  it("reads exactly as it did before sections existed", async () => {
    serve({ topicMaterials: [material({ title: "Topic handout" })] });

    render(<TopicDetailsPage />);

    // The original heading, and no sections block at all.
    expect(await screen.findByText("Learning Materials")).toBeInTheDocument();
    expect(screen.queryByText("Topic Materials")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /subtopics/i }),
    ).not.toBeInTheDocument();
  });

  it("still says when a topic has no materials at all", async () => {
    serve({});

    render(<TopicDetailsPage />);

    expect(
      await screen.findByText(/no learning materials for this topic yet/i),
    ).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("walks topics rather than stepping into a subtopic", async () => {
    serve({
      topicMaterials: [material({ title: "Topic handout" })],
      subtopics: [
        subtopic({ id: 101, title: "OSI Model" }),
        subtopic({ id: 102, title: "TCP/IP", order: 1 }),
      ],
    });

    render(<TopicDetailsPage />);

    await screen.findByText("Topic handout");

    // Previous is disabled on the first topic; next goes to the second topic.
    // The sections are not in this walk at all — the server sends root topics
    // as the sibling list, and the page pages through exactly that.
    expect(
      screen.getByRole("button", { name: /previous topic/i }),
    ).toBeDisabled();

    const next = screen.getByRole("button", { name: /next topic/i });
    expect(next).toBeEnabled();

    next.click();
    expect(navigate).toHaveBeenCalledWith("/topic/2");
  });
});
