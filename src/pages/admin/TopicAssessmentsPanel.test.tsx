// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopicAssessmentsPanel } from "./TopicAssessmentsPanel";
import { ApiError } from "@/services/api";
import type { Assessment } from "@/features/assessments/adminAssessmentService";

/**
 * A root topic's two assessment slots.
 *
 * The service is stubbed, so these say what the panel asks for and what it
 * does with the answer. The ones that carry weight: a create is a draft and is
 * sent once, the page moves to the builder only on the id the server returned,
 * and a refusal keeps the author on the roadmap with the server's reason.
 */

const navigate = vi.fn();

vi.mock("react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchTopicAssessments: vi.fn(),
    createAssessment: vi.fn(),
    publishAssessment: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/adminAssessmentService");
const { toast } = await import("sonner");

/** An assessment as the topic listing returns it: counts, no questions. */
function listed(over: Partial<Assessment> = {}): Assessment {
  return {
    id: 11,
    topicId: 7,
    type: "pre_test",
    title: "Before you start",
    description: null,
    isPublished: false,
    attemptsCount: 0,
    questionsCount: 0,
    questions: null,
    ...over,
  };
}

const postTest = listed({
  id: 12,
  type: "post_test",
  title: "Check your understanding",
  isPublished: true,
  questionsCount: 5,
  attemptsCount: 3,
});

function renderPanel() {
  return render(<TopicAssessmentsPanel topicId={7} roadmapId={3} />);
}

/** Renders the panel and waits for the listing to land. */
async function show(assessments: Assessment[]) {
  vi.mocked(service.fetchTopicAssessments).mockResolvedValue(assessments);

  renderPanel();

  await screen.findByRole("region", { name: "Pre-test" });
}

/** One of the two slots, so a query cannot stray into the other. */
function slot(name: "Pre-test" | "Post-test") {
  return within(screen.getByRole("region", { name }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("discovering a topic's assessments", () => {
  it("shows a loading state while the listing is on its way", () => {
    vi.mocked(service.fetchTopicAssessments).mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(screen.getByText("Loading assessments…")).toBeInTheDocument();
    expect(service.fetchTopicAssessments).toHaveBeenCalledWith(7);
  });

  it("shows the server's message when the listing fails, and retries", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchTopicAssessments)
      .mockRejectedValueOnce(new ApiError("The server had a problem with that.", 500))
      .mockResolvedValue([]);

    renderPanel();

    expect(
      await screen.findByText("The server had a problem with that."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("region", { name: "Pre-test" })).toBeInTheDocument();
    expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2);
  });

  it("offers to create both when the topic has neither", async () => {
    await show([]);

    expect(slot("Pre-test").getByText("Not created yet")).toBeInTheDocument();
    expect(
      slot("Pre-test").getByRole("button", { name: "Create pre-test" }),
    ).toBeEnabled();
    expect(slot("Post-test").getByText("Not created yet")).toBeInTheDocument();
    expect(
      slot("Post-test").getByRole("button", { name: "Create post-test" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Open builder" }),
    ).not.toBeInTheDocument();
  });

  it("shows an existing pre-test and still offers the missing post-test", async () => {
    await show([listed()]);

    expect(slot("Pre-test").getByText("Before you start")).toBeInTheDocument();
    expect(
      slot("Pre-test").getByRole("button", { name: "Open builder" }),
    ).toBeInTheDocument();
    expect(
      slot("Pre-test").queryByRole("button", { name: "Create pre-test" }),
    ).not.toBeInTheDocument();

    expect(
      slot("Post-test").getByRole("button", { name: "Create post-test" }),
    ).toBeInTheDocument();
  });

  it("shows an existing post-test and still offers the missing pre-test", async () => {
    await show([postTest]);

    expect(
      slot("Post-test").getByText("Check your understanding"),
    ).toBeInTheDocument();
    expect(
      slot("Post-test").getByRole("button", { name: "Open builder" }),
    ).toBeInTheDocument();

    expect(
      slot("Pre-test").getByRole("button", { name: "Create pre-test" }),
    ).toBeInTheDocument();
  });

  it("shows both when both exist, each in its own slot", async () => {
    await show([listed(), postTest]);

    expect(slot("Pre-test").getByText("Before you start")).toBeInTheDocument();
    expect(
      slot("Post-test").getByText("Check your understanding"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open builder" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Create/ })).not.toBeInTheDocument();
  });

  it("marks a draft as a draft", async () => {
    await show([listed({ isPublished: false })]);

    expect(slot("Pre-test").getByText("Draft")).toBeInTheDocument();
    expect(slot("Pre-test").queryByText("Published")).not.toBeInTheDocument();
  });

  it("marks a published one as published", async () => {
    await show([postTest]);

    expect(slot("Post-test").getByText("Published")).toBeInTheDocument();
    expect(slot("Post-test").queryByText("Draft")).not.toBeInTheDocument();
  });

  it("counts the questions", async () => {
    await show([listed({ questionsCount: 1 }), postTest]);

    expect(slot("Pre-test").getByText("1 question")).toBeInTheDocument();
    expect(slot("Post-test").getByText("5 questions")).toBeInTheDocument();
  });

  it("counts the attempts", async () => {
    await show([listed({ attemptsCount: 1 }), postTest]);

    expect(slot("Pre-test").getByText("1 attempt")).toBeInTheDocument();
    expect(slot("Post-test").getByText("3 attempts")).toBeInTheDocument();
  });

  it("opens the builder for the assessment in that slot, remembering the roadmap", async () => {
    const user = userEvent.setup();
    await show([listed(), postTest]);

    await user.click(slot("Post-test").getByRole("button", { name: "Open builder" }));

    expect(navigate).toHaveBeenCalledWith(
      "/admin/roadmap/assessments/12?roadmap=3&topic=7",
    );
  });
});

describe("creating a draft", () => {
  it("creates a pre-test with its type and a plain title", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockResolvedValue(listed({ id: 40 }));

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    await waitFor(() =>
      expect(service.createAssessment).toHaveBeenCalledWith(7, {
        type: "pre_test",
        title: "Pre-test",
        description: "",
      }),
    );
  });

  it("creates a post-test with its type and a plain title", async () => {
    const user = userEvent.setup();
    await show([listed()]);

    vi.mocked(service.createAssessment).mockResolvedValue(
      listed({ id: 41, type: "post_test", title: "Post-test" }),
    );

    await user.click(
      slot("Post-test").getByRole("button", { name: "Create post-test" }),
    );

    await waitFor(() =>
      expect(service.createAssessment).toHaveBeenCalledWith(7, {
        type: "post_test",
        title: "Post-test",
        description: "",
      }),
    );
  });

  it("leaves it a draft, and goes to the id the server returned", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockResolvedValue(
      listed({ id: 42, type: "post_test", title: "Post-test" }),
    );

    await user.click(
      slot("Post-test").getByRole("button", { name: "Create post-test" }),
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/admin/roadmap/assessments/42?roadmap=3&topic=7",
      ),
    );

    // Nothing asks for it to be published — not in the create, not after it.
    const [, draft] = vi.mocked(service.createAssessment).mock.calls[0];
    expect(draft).not.toHaveProperty("isPublished");
    expect(service.publishAssessment).not.toHaveBeenCalled();
  });

  it("says so and moves to the builder once the server has answered", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockResolvedValue(listed({ id: 43 }));

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith(
      "/admin/roadmap/assessments/43?roadmap=3&topic=7",
    );
    expect(toast.success).toHaveBeenCalledWith("Pre-test created as a draft.");
  });

  it("shows a failed create and stays on the roadmap", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The server had a problem with that."),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    // And it can be tried again.
    expect(
      slot("Pre-test").getByRole("button", { name: "Create pre-test" }),
    ).toBeEnabled();
  });

  it("puts the server's field messages against the slot", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        title: ["Keep the title to 255 characters or fewer."],
      }),
    );

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    expect(await slot("Pre-test").findByRole("alert")).toHaveTextContent(
      "Keep the title to 255 characters or fewer.",
    );
    expect(slot("Post-test").queryByRole("alert")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("re-reads the list when the server says that one already exists", async () => {
    const user = userEvent.setup();

    // Someone else created the pre-test after this list was read.
    vi.mocked(service.fetchTopicAssessments)
      .mockResolvedValueOnce([])
      .mockResolvedValue([listed()]);
    vi.mocked(service.createAssessment).mockRejectedValue(
      new ApiError(
        '"Routing" already has a pre-test. A topic has at most one of each.',
        422,
      ),
    );

    renderPanel();

    await user.click(
      await screen.findByRole("button", { name: "Create pre-test" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '"Routing" already has a pre-test. A topic has at most one of each.',
      ),
    );

    // The slot now shows the one the server holds, rather than offering the
    // refused create again.
    expect(
      await screen.findByRole("button", { name: "Open builder" }),
    ).toBeInTheDocument();
    expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not go anywhere on an answer that is not the assessment asked for", async () => {
    const user = userEvent.setup();
    await show([]);

    vi.mocked(service.createAssessment).mockResolvedValue(
      listed({ id: 50, topicId: 99 }),
    );

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sends one create at a time, however often it is clicked", async () => {
    const user = userEvent.setup();
    await show([]);

    let finish!: (created: Assessment) => void;
    vi.mocked(service.createAssessment).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await user.click(slot("Pre-test").getByRole("button", { name: "Create pre-test" }));

    const pending = slot("Pre-test").getByRole("button", { name: "Creating…" });
    const other = slot("Post-test").getByRole("button", { name: "Create post-test" });

    expect(pending).toBeDisabled();
    expect(other).toBeDisabled();

    await user.click(pending);
    await user.click(other);

    expect(service.createAssessment).toHaveBeenCalledTimes(1);

    finish(listed({ id: 44 }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/admin/roadmap/assessments/44?roadmap=3&topic=7",
      ),
    );
  });
});
