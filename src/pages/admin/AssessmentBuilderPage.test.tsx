// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssessmentBuilderPage } from "./AssessmentBuilderPage";
import { ApiError } from "@/services/api";
import type {
  Assessment,
  AssessmentChoice,
  AssessmentQuestion,
} from "@/features/assessments/adminAssessmentService";

/**
 * The assessment builder, as far as it goes so far: the assessment's details,
 * its questions read-only, and whether those questions could still be changed.
 *
 * The service is stubbed, so these say what the page asks for and what it does
 * with the answer. Two carry the most weight. The answer key has to be visible
 * in words, not only in colour. And the lock notice has to tell a published
 * assessment from a taken one, because unpublishing lifts one lock and not the
 * other.
 */

const navigate = vi.fn();
let params: Record<string, string | undefined> = { assessmentId: "11" };
let search = "";

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  useSearchParams: () => [new URLSearchParams(search), vi.fn()],
}));

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchAssessment: vi.fn(),
    updateAssessment: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/adminAssessmentService");
const { toast } = await import("sonner");

function choice(
  id: number,
  label: string,
  order: number,
  isCorrect = false,
): AssessmentChoice {
  return { id, label, order, isCorrect };
}

function question(over: Partial<AssessmentQuestion> = {}): AssessmentQuestion {
  return {
    id: 21,
    prompt: "Which layer routes packets?",
    points: 2,
    order: 1,
    choices: [
      choice(31, "Network", 1, true),
      choice(32, "Transport", 2),
      choice(33, "Session", 3),
      choice(34, "Physical", 4),
    ],
    ...over,
  };
}

function assessment(over: Partial<Assessment> = {}): Assessment {
  return {
    id: 11,
    topicId: 4,
    type: "pre_test",
    title: "Before you start",
    description: "Answer what you can.",
    isPublished: false,
    attemptsCount: 0,
    questionsCount: null,
    questions: [question()],
    ...over,
  };
}

/** Renders the page and waits for its first load to land. */
async function show(value: Assessment = assessment()) {
  vi.mocked(service.fetchAssessment).mockResolvedValue(value);

  render(<AssessmentBuilderPage />);

  await screen.findByText(value.title);
}

function detailsForm() {
  return within(screen.getByRole("form", { name: "Edit assessment details" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  params = { assessmentId: "11" };
  search = "";
});

afterEach(cleanup);

describe("loading the assessment", () => {
  it("shows a loading state while the assessment is on its way", () => {
    vi.mocked(service.fetchAssessment).mockReturnValue(new Promise(() => {}));

    render(<AssessmentBuilderPage />);

    expect(screen.getByText("Loading assessment…")).toBeInTheDocument();
  });

  it("loads the assessment named in the address", async () => {
    await show();

    expect(service.fetchAssessment).toHaveBeenCalledWith(11);
    expect(screen.getByText("Answer what you can.")).toBeInTheDocument();
  });

  it("shows the server's message when the assessment is not there, and retries", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchAssessment)
      .mockRejectedValueOnce(new ApiError("That is not there any more.", 404))
      .mockResolvedValue(assessment());

    render(<AssessmentBuilderPage />);

    expect(
      await screen.findByText("That is not there any more."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Before you start")).toBeInTheDocument();
    expect(service.fetchAssessment).toHaveBeenCalledTimes(2);
  });

  it("does not ask the server about an address that names no assessment", async () => {
    params = { assessmentId: "not-a-number" };

    render(<AssessmentBuilderPage />);

    expect(await screen.findByText("No such assessment")).toBeInTheDocument();
    expect(service.fetchAssessment).not.toHaveBeenCalled();
  });
});

describe("what the header says", () => {
  it("shows a draft pre-test with its counts", async () => {
    await show();

    expect(screen.getByText("Pre-test")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.getByTestId("question-count")).toHaveTextContent("1");
    expect(screen.getByTestId("attempt-count")).toHaveTextContent("0");
  });

  it("shows a published post-test with its counts", async () => {
    await show(
      assessment({
        type: "post_test",
        isPublished: true,
        attemptsCount: 3,
        questions: [question(), question({ id: 22, order: 2 })],
      }),
    );

    expect(screen.getByText("Post-test")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.getByTestId("question-count")).toHaveTextContent("2");
    expect(screen.getByTestId("attempt-count")).toHaveTextContent("3");
  });

  it("says so when there is no description", async () => {
    await show(assessment({ description: null }));

    expect(screen.getByText("No description.")).toBeInTheDocument();
  });
});

describe("the questions, read-only", () => {
  const second = question({
    id: 22,
    prompt: "What does a switch forward on?",
    points: 1,
    order: 2,
    choices: [
      choice(41, "IP address", 1),
      choice(42, "Port number", 2),
      choice(43, "MAC address", 3, true),
      choice(44, "Hostname", 4),
    ],
  });

  it("numbers each question in order with its prompt and points", async () => {
    // Given out of order, to show the page follows `order` rather than arrival.
    await show(assessment({ questions: [second, question()] }));

    const [first, next] = screen.getAllByRole("article");

    expect(within(first).getByText("Question 1")).toBeInTheDocument();
    expect(within(first).getByText("Which layer routes packets?")).toBeInTheDocument();
    expect(within(first).getByText("2 points")).toBeInTheDocument();

    expect(within(next).getByText("Question 2")).toBeInTheDocument();
    expect(within(next).getByText("What does a switch forward on?")).toBeInTheDocument();
    expect(within(next).getByText("1 point")).toBeInTheDocument();
  });

  it("lists all four choices of each question", async () => {
    await show();

    const choices = within(
      screen.getByRole("list", { name: "Choices for question 1" }),
    ).getAllByRole("listitem");

    expect(choices).toHaveLength(4);
    expect(choices.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Network"),
      expect.stringContaining("Transport"),
      expect.stringContaining("Session"),
      expect.stringContaining("Physical"),
    ]);
  });

  it("marks the correct choice in words, and only that one", async () => {
    await show(assessment({ questions: [question(), second] }));

    for (const [number, correct] of [
      [1, "Network"],
      [2, "MAC address"],
    ] as const) {
      const marked = within(
        screen.getByRole("list", { name: `Choices for question ${number}` }),
      )
        .getAllByRole("listitem")
        .filter((item) => within(item).queryByText("Correct answer"));

      expect(marked).toHaveLength(1);
      expect(marked[0]).toHaveTextContent(correct);
    }
  });

  it("offers nothing that changes a question yet", async () => {
    await show();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Back to roadmap", "Edit details"]);
  });

  it("says when there are no questions", async () => {
    await show(assessment({ questions: [] }));

    expect(screen.getByText("No questions yet")).toBeInTheDocument();
    expect(screen.getByTestId("question-count")).toHaveTextContent("0");
  });
});

describe("editing the title and description", () => {
  it("opens the form filled in with what is stored", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Edit details" }));

    expect(detailsForm().getByLabelText("Title")).toHaveValue("Before you start");
    expect(detailsForm().getByLabelText("Description (optional)")).toHaveValue(
      "Answer what you can.",
    );
  });

  it("saves through the service, says so, and reloads", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateAssessment).mockResolvedValue(
      assessment({ title: "Renamed" }),
    );

    await user.click(screen.getByRole("button", { name: "Edit details" }));

    const form = detailsForm();
    await user.clear(form.getByLabelText("Title"));
    await user.type(form.getByLabelText("Title"), "Renamed");
    await user.clear(form.getByLabelText("Description (optional)"));
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(service.updateAssessment).toHaveBeenCalledWith(11, {
        type: "pre_test",
        title: "Renamed",
        description: "",
      }),
    );

    expect(toast.success).toHaveBeenCalled();
    // Reloaded rather than patched in place, so the page shows what was stored.
    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    await screen.findByText("Before you start");
    expect(
      screen.queryByRole("form", { name: "Edit assessment details" }),
    ).not.toBeInTheDocument();
  });

  it("refuses an empty title without asking the server", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Edit details" }));

    const form = detailsForm();
    await user.clear(form.getByLabelText("Title"));
    await user.click(form.getByRole("button", { name: "Save changes" }));

    expect(form.getByLabelText("Title")).toHaveAccessibleDescription(
      "Give the assessment a title.",
    );
    expect(service.updateAssessment).not.toHaveBeenCalled();
  });

  it("puts the server's 422 messages under the fields they are about", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateAssessment).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        title: ["That title is not allowed."],
        description: ["Keep the instructions to 2000 characters or fewer."],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Edit details" }));

    const form = detailsForm();
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(form.getByLabelText("Title")).toHaveAccessibleDescription(
        "That title is not allowed.",
      ),
    );
    expect(form.getByLabelText("Description (optional)")).toHaveAccessibleDescription(
      "Keep the instructions to 2000 characters or fewer.",
    );

    // Left open with the author's work in it, and nothing reloaded under them.
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
  });

  it("shows a refusal that is about no field as a toast", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateAssessment).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.click(detailsForm().getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The server had a problem with that."),
    );
    expect(
      screen.getByRole("form", { name: "Edit assessment details" }),
    ).toBeInTheDocument();
  });

  it("closes without saving on cancel", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.click(detailsForm().getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("form", { name: "Edit assessment details" }),
    ).not.toBeInTheDocument();
    expect(service.updateAssessment).not.toHaveBeenCalled();
  });
});

describe("the lock notice", () => {
  it("is not shown while the questions can still be changed", async () => {
    await show();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("says a published assessment is locked until it is unpublished", async () => {
    await show(assessment({ isPublished: true }));

    const note = screen.getByRole("note");

    expect(note).toHaveTextContent(/is published/);
    expect(note).toHaveTextContent(/Unpublishing it lifts the lock/);
  });

  it("says a taken assessment is locked for good", async () => {
    await show(assessment({ isPublished: false, attemptsCount: 2 }));

    const note = screen.getByRole("note");

    expect(note).toHaveTextContent(/already taken/);
    expect(note).not.toHaveTextContent(/Unpublishing it lifts the lock/);
  });

  it("says unpublishing will not help once a published assessment is taken", async () => {
    await show(assessment({ isPublished: true, attemptsCount: 5 }));

    expect(screen.getByRole("note")).toHaveTextContent(
      /even if it is unpublished/,
    );
  });

  it("still lets the title and description be edited while locked", async () => {
    await show(assessment({ isPublished: true, attemptsCount: 5 }));

    expect(screen.getByRole("button", { name: "Edit details" })).toBeEnabled();
  });
});

describe("going back", () => {
  it("returns to the roadmap", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Back to roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/admin/roadmap");
  });

  it("returns to the roadmap and topic it was opened from", async () => {
    const user = userEvent.setup();
    search = "roadmap=3&topic=7";
    await show();

    await user.click(screen.getByRole("button", { name: "Back to roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/admin/roadmap?roadmap=3&topic=7");
  });

  it("returns to the plain roadmap page when the address carries nothing usable", async () => {
    const user = userEvent.setup();
    search = "roadmap=abc&topic=0";
    await show();

    await user.click(screen.getByRole("button", { name: "Back to roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/admin/roadmap");
  });

  it("is there even when the assessment would not load", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchAssessment).mockRejectedValue(
      new ApiError("That is not there any more.", 404),
    );

    render(<AssessmentBuilderPage />);
    await screen.findByText("That is not there any more.");

    await user.click(screen.getByRole("button", { name: "Back to roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/admin/roadmap");
  });
});
