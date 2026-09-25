// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopicDetailsPage } from "./TopicDetailsPage";
import { ApiError } from "@/services/api";
import type { LearningMaterial, Subtopic, Topic } from "@/features/content/types";
import type {
  ProgressionPastResult,
  ProgressionPostTest,
  ProgressionPreTest,
  TopicProgression,
} from "@/features/content/progressionService";

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
 * topic of its own. The topic's own materials stay the topic's, and previous
 * and next still walk topics, so a section never appears in that walk and sends
 * a student sideways out of what they are reading.
 *
 * What a student is shown of the sections is their way through the topic, read
 * from the server: the pre-test that opens them, each one's standing, and the
 * post-test after them. Nothing on this page decides any of it — the progression
 * service is stubbed, and each test hands the page a judgement to draw.
 */

const navigate = vi.fn();
let isAdmin = false;

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ topicId: "1" }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ isAdmin }),
}));

vi.mock("@/features/content/progressionService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/progressionService")
  >();

  return { ...actual, fetchTopicProgression: vi.fn() };
});

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
const progress = await import("@/features/content/progressionService");

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

/** A topic that paces nothing: no published assessments and no subtopics. */
function unpaced(): TopicProgression {
  return {
    topicId: 1,
    preTest: null,
    subtopics: [],
    nextSubtopicId: null,
    completedCount: 0,
    totalCount: 0,
    remainingCount: 0,
    postTest: null,
    pastResults: [],
  };
}

/** A way through the topic's two subtopics: the first open, the second not yet. */
function paced(over: Partial<TopicProgression> = {}): TopicProgression {
  return {
    topicId: 1,
    preTest: null,
    subtopics: [
      { id: 101, title: "OSI Model", order: 0, status: "available" },
      { id: 102, title: "TCP/IP", order: 1, status: "locked" },
    ],
    nextSubtopicId: 101,
    completedCount: 0,
    totalCount: 2,
    remainingCount: 2,
    postTest: null,
    pastResults: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = false;
  vi.mocked(progress.fetchTopicProgression).mockResolvedValue(unpaced());
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

  it("names each subtopic once, as the way into it, and nothing it holds", async () => {
    withSubtopics();
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(paced());

    render(<TopicDetailsPage />);

    await screen.findByText("Topic handout");

    /*
     * A subtopic is read on a page of its own. What this page shows of one is
     * its title, where the student stands on it and a way in — once, in the
     * student's progress — and not the reading itself.
     */
    const progressRegion = screen.getByRole("region", { name: "Your progress" });

    expect(await within(progressRegion).findByText("OSI Model")).toBeInTheDocument();
    expect(screen.getAllByText("OSI Model")).toHaveLength(1);
    expect(screen.getAllByText("TCP/IP")).toHaveLength(1);
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

describe("the student's way through the topic", () => {
  function preTest(over: Partial<ProgressionPreTest> = {}): ProgressionPreTest {
    return {
      id: 51,
      version: 1,
      title: "Before you start",
      submitted: false,
      waived: false,
      required: true,
      result: null,
      ...over,
    };
  }

  function postTest(over: Partial<ProgressionPostTest> = {}): ProgressionPostTest {
    return {
      id: 52,
      version: 1,
      title: "Check your understanding",
      available: false,
      submitted: false,
      lockedReason:
        'Complete every subtopic of "Networking Fundamentals" before taking its post-test (2 left).',
      result: null,
      ...over,
    };
  }

  /** Renders the topic with the progression the server would answer. */
  async function showWith(progression: TopicProgression) {
    serve({ topicMaterials: [material({ title: "Topic handout" })] });
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(progression);

    render(<TopicDetailsPage />);

    await screen.findByText("Topic handout");
  }

  it("reads the signed-in student's progression for this topic", async () => {
    await showWith(paced());

    await screen.findByRole("button", { name: "Start OSI Model" });

    expect(progress.fetchTopicProgression).toHaveBeenCalledWith(1);
  });

  it("puts no gate in front of a topic with no pre-test", async () => {
    await showWith(paced({ preTest: null }));

    expect(
      await screen.findByRole("button", { name: "Start OSI Model" }),
    ).toBeEnabled();
    expect(screen.queryByRole("region", { name: "Pre-test" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Take the pre-test" }),
    ).not.toBeInTheDocument();
  });

  it("puts no gate in front of a topic whose pre-test is still a draft", async () => {
    // A draft never reaches the progression — the server leaves it out — so
    // there is nothing on this page that could gate on it.
    await showWith(paced({ preTest: null }));

    expect(
      await screen.findByRole("button", { name: "Start OSI Model" }),
    ).toBeEnabled();
    expect(screen.queryByText(/pre-test/i)).not.toBeInTheDocument();
  });

  it("holds every subtopic behind a published pre-test until it is submitted", async () => {
    const user = userEvent.setup();

    await showWith(
      paced({
        preTest: preTest(),
        subtopics: [
          { id: 101, title: "OSI Model", order: 0, status: "locked" },
          { id: 102, title: "TCP/IP", order: 1, status: "locked" },
        ],
      }),
    );

    const gate = within(await screen.findByRole("region", { name: "Pre-test" }));

    expect(gate.getByText(/Submit the pre-test to open/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^(Start|Review) / }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Subtopics" })).getAllByText("Locked"),
    ).toHaveLength(2);

    await user.click(gate.getByRole("button", { name: "Take the pre-test" }));

    expect(navigate).toHaveBeenCalledWith("/assessments/51");
  });

  it("keeps a result on an older version, reviewed where it was taken", async () => {
    const user = userEvent.setup();

    await showWith(
      paced({
        preTest: preTest({
          id: 60,
          version: 2,
          submitted: true,
          required: false,
          result: {
            assessmentId: 51,
            version: 1,
            earnedPoints: 5,
            totalPoints: 8,
            percent: 62.5,
            submittedAt: null,
          },
        }),
      }),
    );

    const gate = within(await screen.findByRole("region", { name: "Pre-test" }));

    // Not asked to take version 2: the result on version 1 stands, and says so.
    expect(gate.getByText("Submitted on version 1 · 5 / 8 (62.5%)")).toBeInTheDocument();
    expect(gate.queryByRole("button", { name: "Take the pre-test" })).not.toBeInTheDocument();

    await user.click(gate.getByRole("button", { name: "View result" }));

    expect(navigate).toHaveBeenCalledWith("/assessments/51");
  });

  it("reviews a replaced post-test result on the version taken", async () => {
    const user = userEvent.setup();

    await showWith(
      paced({
        completedCount: 3,
        remainingCount: 0,
        postTest: postTest({
          id: 70,
          version: 2,
          submitted: true,
          lockedReason: null,
          result: {
            assessmentId: 52,
            version: 1,
            earnedPoints: 7,
            totalPoints: 10,
            percent: 70,
            submittedAt: null,
          },
        }),
      }),
    );

    const post = within(await screen.findByRole("region", { name: "Post-test" }));

    expect(post.getByText("Submitted on version 1 · 7 / 10 (70%)")).toBeInTheDocument();

    await user.click(post.getByRole("button", { name: "View result" }));

    expect(navigate).toHaveBeenCalledWith("/assessments/52");
  });

  it("opens the first subtopic once the pre-test is submitted, whatever the score", async () => {
    const user = userEvent.setup();

    await showWith(
      paced({
        preTest: preTest({
          submitted: true,
          required: false,
          result: {
            assessmentId: 51,
            version: 1,
            earnedPoints: 3,
            totalPoints: 10,
            percent: 30,
            submittedAt: null,
          },
        }),
      }),
    );

    const gate = within(await screen.findByRole("region", { name: "Pre-test" }));

    expect(gate.getByText("Submitted · 3 / 10 (30%)")).toBeInTheDocument();
    expect(
      gate.queryByRole("button", { name: "Take the pre-test" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start OSI Model" }));

    expect(navigate).toHaveBeenCalledWith("/subtopic/101");
  });

  it("keeps the later subtopics locked, with no way in", async () => {
    await showWith(paced());

    await screen.findByRole("button", { name: "Start OSI Model" });

    const tcp = screen.getByText("TCP/IP").closest("li") as HTMLElement;

    expect(within(tcp).getByText("Locked")).toBeInTheDocument();
    expect(within(tcp).queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not send a student who was already under way to the pre-test", async () => {
    await showWith(
      paced({
        preTest: preTest({ waived: true, required: false }),
        subtopics: [
          { id: 101, title: "OSI Model", order: 0, status: "completed" },
          { id: 102, title: "TCP/IP", order: 1, status: "available" },
        ],
        nextSubtopicId: 102,
        completedCount: 1,
        remainingCount: 1,
      }),
    );

    const gate = within(await screen.findByRole("region", { name: "Pre-test" }));

    expect(gate.getByText(/Not required/)).toBeInTheDocument();
    // Still offered, and said to be optional: the server lets a waived student
    // take it, and nothing about what is open depends on it.
    expect(gate.getByText(/You can still take it/)).toBeInTheDocument();
    expect(gate.getByRole("button", { name: "Open pre-test" })).toBeInTheDocument();
    expect(
      gate.queryByRole("button", { name: "Take the pre-test" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start TCP/IP" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Review OSI Model" })).toBeEnabled();
  });

  it("keeps the post-test shut, with the server's reason, until every subtopic is complete", async () => {
    await showWith(paced({ postTest: postTest() }));

    const post = within(await screen.findByRole("region", { name: "Post-test" }));

    expect(post.getByText(/before taking its post-test \(2 left\)/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Take the post-test" }),
    ).not.toBeInTheDocument();
  });

  it("offers the post-test once the server opens it", async () => {
    const user = userEvent.setup();

    await showWith(
      paced({
        subtopics: [
          { id: 101, title: "OSI Model", order: 0, status: "completed" },
          { id: 102, title: "TCP/IP", order: 1, status: "completed" },
        ],
        nextSubtopicId: null,
        completedCount: 2,
        remainingCount: 0,
        postTest: postTest({ available: true, lockedReason: null }),
      }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Take the post-test" }),
    );

    expect(navigate).toHaveBeenCalledWith("/assessments/52");
  });

  it("shows a submitted post-test as a result to review", async () => {
    await showWith(
      paced({
        subtopics: [
          { id: 101, title: "OSI Model", order: 0, status: "completed" },
          { id: 102, title: "TCP/IP", order: 1, status: "completed" },
        ],
        nextSubtopicId: null,
        completedCount: 2,
        remainingCount: 0,
        postTest: postTest({
          submitted: true,
          lockedReason: null,
          result: {
            assessmentId: 52,
            version: 1,
            earnedPoints: 7,
            totalPoints: 10,
            percent: 70,
            submittedAt: null,
          },
        }),
      }),
    );

    const post = within(await screen.findByRole("region", { name: "Post-test" }));

    expect(post.getByText("Submitted · 7 / 10 (70%)")).toBeInTheDocument();
    expect(post.getByRole("button", { name: "View result" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Take the post-test" }),
    ).not.toBeInTheDocument();
  });

  it("offers no post-test path on a topic with no subtopics", async () => {
    await showWith({
      ...unpaced(),
      postTest: postTest({
        lockedReason:
          'The post-test for "Networking Fundamentals" opens once the topic has subtopics to complete.',
      }),
    });

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Your progress" }),
      ).not.toBeInTheDocument(),
    );
    expect(progress.fetchTopicProgression).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("region", { name: "Post-test" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Take the post-test" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a pre-test but no post-test path on a topic with no subtopics", async () => {
    await showWith({ ...unpaced(), preTest: preTest(), postTest: postTest() });

    const gate = await screen.findByRole("region", { name: "Pre-test" });

    // No subtopics for it to open, so it does not claim to open any.
    expect(gate).toHaveTextContent("Take the pre-test for this topic.");
    expect(gate).not.toHaveTextContent(/open this topic's subtopics/);
    expect(screen.queryByRole("region", { name: "Subtopics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Post-test" })).not.toBeInTheDocument();
  });

  /*
   * A result on an assessment the topic no longer offers.
   *
   * Nothing to take, so nothing that reads like taking: the one thing offered
   * against it is the review of what was already submitted.
   */
  function pastResult(
    over: Partial<ProgressionPastResult> = {},
  ): ProgressionPastResult {
    return {
      assessmentId: 51,
      version: 1,
      type: "pre_test",
      title: "Before you start",
      result: {
        assessmentId: 51,
        version: 1,
        earnedPoints: 8,
        totalPoints: 10,
        percent: 80,
        submittedAt: "2026-09-15T10:00:00.000000Z",
      },
      ...over,
    };
  }

  it("offers the review of a result whose assessment is no longer on offer", async () => {
    const user = userEvent.setup();

    // Withdrawn: the server sends no pre-test step for it, only the result.
    await showWith({ ...paced(), preTest: null, pastResults: [pastResult()] });

    const earlier = within(await screen.findByRole("region", { name: "Earlier results" }));

    expect(earlier.getByText("Before you start")).toBeInTheDocument();
    expect(earlier.getByText("Pre-test")).toBeInTheDocument();
    // The version it was taken on, since there is no version on offer to be it.
    expect(earlier.getByText(/Submitted on version 1 · 8 \/ 10 \(80%\)/)).toBeInTheDocument();

    await user.click(earlier.getByRole("button", { name: /Review your pre-test result/ }));

    // The assessment's own address, which is where the review lives. No attempt
    // id anywhere: whose result it is, is the server's to decide.
    expect(navigate).toHaveBeenCalledWith("/assessments/51");
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("does not offer a withdrawn assessment as one to take", async () => {
    await showWith({ ...paced(), preTest: null, pastResults: [pastResult()] });

    await screen.findByRole("region", { name: "Earlier results" });

    // It is not a step, and nothing about it invites a second attempt.
    expect(screen.queryByRole("region", { name: "Pre-test" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /take the pre-test/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /take the post-test/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/open this topic's subtopics/)).not.toBeInTheDocument();
  });

  it("names a withdrawn post-test result as a post-test", async () => {
    await showWith({
      ...paced(),
      pastResults: [
        pastResult({ assessmentId: 52, type: "post_test", title: "Check your understanding" }),
      ],
    });

    const earlier = within(await screen.findByRole("region", { name: "Earlier results" }));

    expect(earlier.getByText("Post-test")).toBeInTheDocument();
    expect(
      earlier.getByRole("button", { name: /Review your post-test result/ }),
    ).toBeInTheDocument();
  });

  it("offers nothing of the kind when the student has no earlier result", async () => {
    await showWith(paced());

    await screen.findByRole("region", { name: "Your progress" });

    // An assessment the student never took leaves nothing behind. No section,
    // and above all no action that would imply a result exists.
    expect(
      screen.queryByRole("region", { name: "Earlier results" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review/i }),
    ).not.toBeInTheDocument();
  });

  it("draws the card for a topic whose only content is an earlier result", async () => {
    await showWith({ ...unpaced(), pastResults: [pastResult()] });

    // Nothing left to pace — no pre-test, no subtopics — and still something to
    // say, because the student took it before it was withdrawn.
    const earlier = within(await screen.findByRole("region", { name: "Earlier results" }));

    expect(earlier.getByRole("button", { name: /Review your pre-test result/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Subtopics" })).not.toBeInTheDocument();
  });

  it("keeps a submitted post-test readable after its subtopics are removed", async () => {
    const user = userEvent.setup();

    await showWith({
      ...unpaced(),
      postTest: postTest({
        submitted: true,
        available: false,
        lockedReason: null,
        result: {
          assessmentId: 52,
          version: 1,
          earnedPoints: 6,
          totalPoints: 10,
          percent: 60,
          submittedAt: "2026-09-15T10:00:00.000000Z",
        },
      }),
    });

    // The step is offered against subtopics that are gone, but the result the
    // student holds is not, and this is where they read it.
    const post = within(await screen.findByRole("region", { name: "Post-test" }));

    expect(post.getByText(/Submitted · 6 \/ 10 \(60%\)/)).toBeInTheDocument();

    await user.click(post.getByRole("button", { name: "View result" }));

    expect(navigate).toHaveBeenCalledWith("/assessments/52");
  });

  it("offers a retry when the progression will not load, and keeps the topic on screen", async () => {
    const user = userEvent.setup();

    serve({ topicMaterials: [material({ title: "Topic handout" })] });
    vi.mocked(progress.fetchTopicProgression)
      .mockRejectedValueOnce(new ApiError("The server had a problem with that.", 500))
      .mockResolvedValue(paced());

    render(<TopicDetailsPage />);

    const region = within(await screen.findByRole("region", { name: "Your progress" }));

    await user.click(await region.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "Start OSI Model" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Topic handout")).toBeInTheDocument();
  });

  it("asks nothing about progress for staff, who have none", async () => {
    isAdmin = true;
    serve({ topicMaterials: [material({ title: "Topic handout" })] });

    render(<TopicDetailsPage />);

    await screen.findByText("Topic handout");

    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Your progress" }),
    ).not.toBeInTheDocument();
  });

  it("asks no progression of a subtopic reached at a topic's address", async () => {
    // Progression is read from the topic holding a subtopic, and the server
    // refuses it for the subtopic itself — so the card would only ever show a
    // refusal with a retry that cannot succeed. Whether it is a subtopic is the
    // server's own answer, from the topic it sent.
    vi.mocked(content.fetchTopic).mockResolvedValue({
      topic: topic({ id: 101, parentId: 1, title: "OSI Model" }),
      roadmapTitle: "Networking Essentials",
      siblings,
      subtopics: [],
    });
    vi.mocked(materials.fetchTopicMaterials).mockResolvedValue([
      material({ title: "Layer chart" }),
    ]);

    render(<TopicDetailsPage />);

    await screen.findByText("Layer chart");

    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Your progress" }),
    ).not.toBeInTheDocument();
  });
});

describe("a topic the server will not open", () => {
  function refuse(message: string) {
    const refusal = new ApiError(message, 403);

    vi.mocked(content.fetchTopic).mockRejectedValue(refusal);
    vi.mocked(materials.fetchTopicMaterials).mockRejectedValue(refusal);
  }

  it("gives the server's reason rather than one made up here", async () => {
    refuse("This topic has not been released yet.");

    render(<TopicDetailsPage />);

    expect(
      await screen.findByRole("heading", { name: "Topic locked" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This topic has not been released yet."),
    ).toBeInTheDocument();

    // A topic of a roadmap is not paced behind the topics before it, so the
    // old instruction was one no student could follow.
    expect(
      screen.queryByText(/finish the topics before this one/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Learning Materials")).not.toBeInTheDocument();
    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
  });

  it("says only that it is not open when the server gave no reason of its own", async () => {
    refuse("This action is unauthorized.");

    render(<TopicDetailsPage />);

    expect(
      await screen.findByText("This topic is not open to you right now."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This action is unauthorized."),
    ).not.toBeInTheDocument();
  });

  it("still leads back to the roadmap", async () => {
    const user = userEvent.setup();
    refuse("This topic has not been released yet.");

    render(<TopicDetailsPage />);

    await user.click(
      (await screen.findAllByRole("button", { name: /back to roadmap/i }))[0],
    );

    expect(navigate).toHaveBeenCalledWith("/roadmap");
  });

  it("keeps the retry for a failure that is not a refusal", async () => {
    const user = userEvent.setup();

    vi.mocked(content.fetchTopic)
      .mockRejectedValueOnce(new ApiError("The server had a problem with that.", 500))
      .mockResolvedValue({
        topic: topic(),
        roadmapTitle: "Networking Essentials",
        siblings,
        subtopics: [],
      });
    vi.mocked(materials.fetchTopicMaterials).mockResolvedValue([
      material({ title: "Topic handout" }),
    ]);

    render(<TopicDetailsPage />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Topic handout")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Topic locked" }),
    ).not.toBeInTheDocument();
  });
});

describe("the words a subtopic's status is given", () => {
  it("calls an open subtopic Available, leaving Open to the actions", async () => {
    serve({ topicMaterials: [material({ title: "Topic handout" })] });
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(paced());

    render(<TopicDetailsPage />);

    await screen.findByRole("button", { name: "Start OSI Model" });

    const row = screen.getByText("OSI Model").closest("li") as HTMLElement;

    expect(within(row).getByText("Available")).toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
  });
});
