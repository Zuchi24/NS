// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SubtopicDetailsPage } from "./SubtopicDetailsPage";
import type { LearningMaterial, Subtopic, Topic } from "@/features/content/types";
import type { TopicProgression } from "@/features/content/progressionService";

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
 *
 * And a section is finished only by saying so. Opening it completes nothing;
 * "Mark as Complete" does, once, and what that opened is what the server
 * answered — never assumed before it arrives. The progression service is
 * stubbed, so each test hands the page the server's judgement to draw.
 */

const navigate = vi.fn();
const user = userEvent.setup();
let isAdmin = false;

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ subtopicId: "101" }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ isAdmin }),
}));

vi.mock("@/features/content/progressionService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/progressionService")
  >();

  return { ...actual, fetchTopicProgression: vi.fn(), completeSubtopic: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return { ...actual, fetchSubtopic: vi.fn() };
});

const content = await import("@/features/content/contentService");
const progress = await import("@/features/content/progressionService");
const { toast } = await import("sonner");
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

/**
 * The topic's progression as the server would answer it.
 *
 * By default the student is past 100 and 101 and on to 102 — so every section
 * the navigation tests walk to is one the server has opened.
 */
function progression(over: Partial<TopicProgression> = {}): TopicProgression {
  return {
    topicId: 1,
    preTest: null,
    subtopics: [
      { id: 100, title: "What a Network Is", order: 0, status: "completed" },
      { id: 101, title: "OSI Model", order: 1, status: "completed" },
      { id: 102, title: "TCP/IP", order: 2, status: "available" },
    ],
    nextSubtopicId: 102,
    completedCount: 2,
    totalCount: 3,
    remainingCount: 1,
    postTest: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = false;
  vi.mocked(progress.fetchTopicProgression).mockResolvedValue(progression());
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

  it("shows no challenge, video or progress bar", async () => {
    serve({ materials: [material()] });

    render(<SubtopicDetailsPage />);

    await screen.findByText("Layer chart");

    /*
     * A section is a heading with materials under it: no challenges of its own
     * and no video, which a section cannot be given. Its only standing is
     * whether it is complete, which the progress panel says in words.
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

  it("gives the server's reason when the section has not been reached", async () => {
    vi.mocked(content.fetchSubtopic).mockRejectedValue(
      new ApiError(
        'Take the pre-test for "Networking Fundamentals" before starting its subtopics.',
        403,
      ),
    );

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText(/subtopic locked/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Take the pre-test for "Networking Fundamentals" before starting its subtopics.',
      ),
    ).toBeInTheDocument();
    // Nothing of it is drawn, and nothing about it is asked.
    expect(screen.queryByText("Learning Materials")).not.toBeInTheDocument();
    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
  });

  it("says so when the id names a topic rather than a section", async () => {
    // fetchSubtopic answers null for a root topic: it has a page of its own
    // and this route is not it.
    vi.mocked(content.fetchSubtopic).mockResolvedValue(null);

    render(<SubtopicDetailsPage />);

    expect(await screen.findByText(/subtopic not found/i)).toBeInTheDocument();
  });
});

describe("marking a subtopic complete", () => {
  /** On 101, with the section before it done and the one after still shut. */
  const reading = progression({
    subtopics: [
      { id: 100, title: "What a Network Is", order: 0, status: "completed" },
      { id: 101, title: "OSI Model", order: 1, status: "available" },
      { id: 102, title: "TCP/IP", order: 2, status: "locked" },
    ],
    nextSubtopicId: 101,
    completedCount: 1,
    remainingCount: 2,
  });

  /** What the server answers once 101 is complete. */
  const afterward = progression({
    subtopics: [
      { id: 100, title: "What a Network Is", order: 0, status: "completed" },
      { id: 101, title: "OSI Model", order: 1, status: "completed" },
      { id: 102, title: "TCP/IP", order: 2, status: "available" },
    ],
    nextSubtopicId: 102,
    completedCount: 2,
    remainingCount: 1,
  });

  /** Renders 101 while it is the section to finish, and hands back its button. */
  async function showReading() {
    serve();
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(reading);

    render(<SubtopicDetailsPage />);

    return screen.findByRole("button", { name: "Mark as Complete" });
  }

  it("does not complete a subtopic by opening it", async () => {
    expect(await showReading()).toBeEnabled();

    // The parent topic's progression, read for this student.
    expect(progress.fetchTopicProgression).toHaveBeenCalledWith(1);
    expect(progress.completeSubtopic).not.toHaveBeenCalled();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("keeps the sections the server has not opened out of reach", async () => {
    await showReading();

    expect(screen.getByRole("button", { name: /next subtopic/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /open TCP\/IP/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("(locked)")).toBeInTheDocument();

    // What came before stays open for review.
    expect(screen.getByRole("button", { name: /previous subtopic/i })).toBeEnabled();
  });

  it("marks it complete through the service and shows what the server opened", async () => {
    vi.mocked(progress.completeSubtopic).mockResolvedValue(afterward);

    await user.click(await showReading());

    expect(progress.completeSubtopic).toHaveBeenCalledWith(101);
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark as Complete" }),
    ).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Marked “OSI Model” complete.");

    // The next section, open because the server's answer said so.
    expect(screen.getByRole("button", { name: /next subtopic/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /open TCP\/IP/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Continue to TCP/IP" }));

    expect(navigate).toHaveBeenCalledWith("/subtopic/102");
    // Drawn from the progression the completion answered with.
    expect(progress.fetchTopicProgression).toHaveBeenCalledTimes(1);
  });

  it("sends one completion however often it is pressed", async () => {
    vi.mocked(progress.completeSubtopic).mockReturnValue(new Promise(() => {}));

    await user.click(await showReading());

    const pending = screen.getByRole("button", { name: "Marking complete…" });
    expect(pending).toBeDisabled();

    await user.click(pending);

    expect(progress.completeSubtopic).toHaveBeenCalledTimes(1);
  });

  it("marks nothing complete when the server refuses", async () => {
    vi.mocked(progress.completeSubtopic).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await user.click(await showReading());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The server had a problem with that."),
    );
    expect(screen.getByRole("button", { name: "Mark as Complete" })).toBeEnabled();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next subtopic/i })).toBeDisabled();
  });

  it("reads the page again when the server says the section is shut after all", async () => {
    const refusal = 'Complete "What a Network Is" before moving on to "OSI Model".';

    vi.mocked(content.fetchSubtopic)
      .mockResolvedValueOnce({
        subtopic: subtopic({ order: 1 }),
        parent,
        roadmapTitle: "Networking Essentials",
        siblings,
      })
      .mockRejectedValue(new ApiError(refusal, 403));
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(reading);
    vi.mocked(progress.completeSubtopic).mockRejectedValue(new ApiError(refusal, 403));

    render(<SubtopicDetailsPage />);

    await user.click(await screen.findByRole("button", { name: "Mark as Complete" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(refusal));

    // The page as the server now has it, not a completion nobody confirmed.
    expect(await screen.findByText(/subtopic locked/i)).toBeInTheDocument();
    expect(screen.getByText(refusal)).toBeInTheDocument();
    expect(content.fetchSubtopic).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("offers the post-test once the last section is complete", async () => {
    const both = [siblings[0], subtopic({ id: 101, title: "OSI Model", order: 1 })];
    const post = {
      id: 52,
      title: "Check your understanding",
      submitted: false,
      result: null,
    };

    vi.mocked(content.fetchSubtopic).mockResolvedValue({
      subtopic: both[1],
      parent,
      roadmapTitle: "Networking Essentials",
      siblings: both,
    });
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(
      progression({
        subtopics: [
          { id: 100, title: "What a Network Is", order: 0, status: "completed" },
          { id: 101, title: "OSI Model", order: 1, status: "available" },
        ],
        nextSubtopicId: 101,
        completedCount: 1,
        totalCount: 2,
        remainingCount: 1,
        postTest: {
          ...post,
          available: false,
          lockedReason:
            'Complete every subtopic of "Networking Fundamentals" before taking its post-test (1 left).',
        },
      }),
    );
    vi.mocked(progress.completeSubtopic).mockResolvedValue(
      progression({
        subtopics: [
          { id: 100, title: "What a Network Is", order: 0, status: "completed" },
          { id: 101, title: "OSI Model", order: 1, status: "completed" },
        ],
        nextSubtopicId: null,
        completedCount: 2,
        totalCount: 2,
        remainingCount: 0,
        postTest: { ...post, available: true, lockedReason: null },
      }),
    );

    render(<SubtopicDetailsPage />);

    const mark = await screen.findByRole("button", { name: "Mark as Complete" });

    // Not before the server says so.
    expect(
      screen.queryByRole("button", { name: "Take the post-test" }),
    ).not.toBeInTheDocument();

    await user.click(mark);
    await user.click(await screen.findByRole("button", { name: "Take the post-test" }));

    expect(navigate).toHaveBeenCalledWith("/assessments/52");
  });

  it("asks nothing about progress for staff, who have none to record", async () => {
    isAdmin = true;
    serve();

    render(<SubtopicDetailsPage />);

    await screen.findByText(/subtopic 2 of 3/i);

    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Mark as Complete" }),
    ).not.toBeInTheDocument();
  });
});
