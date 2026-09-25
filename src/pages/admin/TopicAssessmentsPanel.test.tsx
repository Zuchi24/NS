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
    createAssessmentVersion: vi.fn(),
    archiveAssessment: vi.fn(),
    restoreAssessment: vi.fn(),
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
    version: 1,
    title: "Before you start",
    description: null,
    isPublished: false,
    archivedAt: null,
    createdAt: null,
    updatedAt: null,
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
    expect(service.fetchTopicAssessments).toHaveBeenCalledWith(7, { includeArchived: true });
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

describe("versions of a slot", () => {
  const v1 = listed({ id: 11, version: 1, attemptsCount: 4, questionsCount: 2 });
  const v2 = listed({ id: 18, version: 2, isPublished: true, questionsCount: 2 });
  const v3 = listed({ id: 19, version: 3, title: "Before you start, revised" });
  const archived = listed({ id: 9, version: 0, archivedAt: "2026-09-01T10:00:00Z" });

  /** The row of one version, by the label it is named with. */
  function row(label: string) {
    const name = slot("Pre-test").getByText(label);

    return within(name.closest("div.rounded") as HTMLElement);
  }

  it("lists every version in use, naming the active one, and marks taken ones read-only", async () => {
    await show([v1, v2, v3]);

    expect(slot("Pre-test").getByText("V1")).toBeInTheDocument();
    expect(slot("Pre-test").getByText("V2")).toBeInTheDocument();
    expect(slot("Pre-test").getByText("(Active)")).toBeInTheDocument();
    expect(row("V2").getByText("Published")).toBeInTheDocument();
    expect(row("V1").getByText("Read-only")).toBeInTheDocument();
    expect(row("V3").queryByText("Read-only")).not.toBeInTheDocument();
    expect(row("V3").getByText("Draft")).toBeInTheDocument();
  });

  it("offers publish and archive only on unpublished versions in use", async () => {
    await show([v1, v2]);

    expect(row("V2").queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(row("V2").queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(row("V1").getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(row("V1").getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("folds archived versions away, and offers to restore them", async () => {
    const user = userEvent.setup();
    await show([archived, v2]);

    expect(slot("Pre-test").queryByText("V0")).not.toBeInTheDocument();

    await user.click(slot("Pre-test").getByRole("button", { name: "Show 1 archived version" }));

    expect(row("V0").getByText("Archived")).toBeInTheDocument();
    expect(row("V0").getByText("Read-only")).toBeInTheDocument();
    expect(row("V0").queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(row("V0").getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("creates a new version from the active one and opens it in the builder", async () => {
    const user = userEvent.setup();
    await show([v1, v2]);
    vi.mocked(service.createAssessmentVersion).mockResolvedValue(
      listed({ id: 30, version: 3 }),
    );

    await user.click(slot("Pre-test").getByRole("button", { name: "New version" }));

    expect(service.createAssessmentVersion).toHaveBeenCalledWith(18);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/admin/roadmap/assessments/30?roadmap=3&topic=7"),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "V3 of the pre-test created as a draft, copied from V2.",
    );
  });

  it("copies the newest version in use when none is active", async () => {
    const user = userEvent.setup();
    await show([v1, v3]);
    vi.mocked(service.createAssessmentVersion).mockResolvedValue(listed({ id: 31, version: 4 }));

    await user.click(slot("Pre-test").getByRole("button", { name: "New version" }));

    expect(service.createAssessmentVersion).toHaveBeenCalledWith(19);
  });

  it("publishes a version and reads the list again, since another was retired", async () => {
    const user = userEvent.setup();
    await show([v1, v2]);
    vi.mocked(service.publishAssessment).mockResolvedValue({ ...v1, isPublished: true });

    await user.click(row("V1").getByRole("button", { name: "Publish" }));

    expect(service.publishAssessment).toHaveBeenCalledWith(11);
    await waitFor(() => expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith("V1 is now the version students take.");
  });

  it("archives and restores, reading the list again after each", async () => {
    const user = userEvent.setup();
    await show([v1, v2, archived]);
    vi.mocked(service.archiveAssessment).mockResolvedValue({ ...v1, archivedAt: "now" });
    vi.mocked(service.restoreAssessment).mockResolvedValue({ ...archived, archivedAt: null });

    await user.click(row("V1").getByRole("button", { name: "Archive" }));
    expect(service.archiveAssessment).toHaveBeenCalledWith(11);
    await waitFor(() => expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2));

    await user.click(await slot("Pre-test").findByRole("button", { name: "Show 1 archived version" }));
    await user.click(row("V0").getByRole("button", { name: "Restore" }));
    expect(service.restoreAssessment).toHaveBeenCalledWith(9);
    await waitFor(() => expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(3));
  });

  it("shows a conflict in the server's words and reads the list again", async () => {
    const user = userEvent.setup();
    await show([v1, v2]);
    vi.mocked(service.archiveAssessment).mockRejectedValue(
      new ApiError('Version 1 of "Before you start" is the one students are taking, so it cannot be archived.', 409),
    );

    await user.click(row("V1").getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Version 1 of "Before you start" is the one students are taking, so it cannot be archived.',
      ),
    );
    await waitFor(() => expect(service.fetchTopicAssessments).toHaveBeenCalledTimes(2));
  });
});
