// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssessmentPage } from "./AssessmentPage";
import { ApiError } from "@/services/api";
import type {
  AssessmentResult,
  StudentAssessment,
  StudentAssessmentQuestion,
} from "@/features/assessments/studentAssessmentService";

/**
 * A student taking a pre-test or post-test.
 *
 * The service is stubbed, so these say what the page asks for and what it does
 * with the answer. What carries the most weight: nothing is shown of an
 * assessment the server will not open; nothing is sent until every question is
 * answered; the submission is the answers and nothing a score is made of; and
 * once a result exists — from this tab or another — the form is gone for good.
 *
 * The payload test runs the real submitAssessment over a stubbed transport, so
 * it pins what goes on the wire rather than what the page hands the service.
 */

const navigate = vi.fn();
let params: Record<string, string | undefined> = { assessmentId: "11" };

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => params,
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

vi.mock("@/features/assessments/studentAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/studentAssessmentService")
  >();

  return {
    ...actual,
    fetchStudentAssessment: vi.fn(),
    fetchOwnAttempt: vi.fn(),
    submitAssessment: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/studentAssessmentService");
const realService = await vi.importActual<
  typeof import("@/features/assessments/studentAssessmentService")
>("@/features/assessments/studentAssessmentService");
const { api } = await import("@/services/api");
const { toast } = await import("sonner");

const switching: StudentAssessmentQuestion = {
  id: 21,
  prompt: "What does a switch primarily do?",
  points: 2,
  order: 1,
  choices: [
    { id: 31, label: "Connect devices within a LAN", order: 1 },
    { id: 32, label: "Assign public IP addresses", order: 2 },
    { id: 33, label: "Encrypt traffic", order: 3 },
    { id: 34, label: "Resolve domain names", order: 4 },
  ],
};

const routing: StudentAssessmentQuestion = {
  id: 22,
  prompt: "Which layer routes packets?",
  points: 1,
  order: 2,
  choices: [
    { id: 41, label: "Network", order: 1 },
    { id: 42, label: "Transport", order: 2 },
    { id: 43, label: "Session", order: 3 },
    { id: 44, label: "Physical", order: 4 },
  ],
};

function assessment(over: Partial<StudentAssessment> = {}): StudentAssessment {
  return {
    id: 11,
    topicId: 4,
    type: "pre_test",
    title: "Networking Fundamentals",
    description: "Answer what you can.",
    questions: [switching, routing],
    ...over,
  };
}

const result: AssessmentResult = {
  id: 5,
  assessmentId: 11,
  earnedPoints: 8,
  totalPoints: 10,
  percent: 80,
  submittedAt: "2026-09-15T10:00:00Z",
};

/** Renders the page and waits for the assessment to land. */
async function show(
  value: StudentAssessment = assessment(),
  attempt: AssessmentResult | null = null,
) {
  vi.mocked(service.fetchStudentAssessment).mockResolvedValue(value);
  vi.mocked(service.fetchOwnAttempt).mockResolvedValue(attempt);

  render(<AssessmentPage />);

  await screen.findByRole("heading", { name: value.title });
}

/** One question, so a query cannot stray into another. */
function questionGroup(number: number) {
  return within(screen.getByRole("group", { name: new RegExp(`^Question ${number}\\b`) }));
}

type User = ReturnType<typeof userEvent.setup>;

/** Picks an answer to every question. */
async function answerAll(user: User) {
  await user.click(questionGroup(1).getByRole("radio", { name: "Assign public IP addresses" }));
  await user.click(questionGroup(2).getByRole("radio", { name: "Network" }));
}

function submitButton() {
  return screen.getByRole("button", { name: "Submit assessment" });
}

beforeEach(() => {
  vi.clearAllMocks();
  params = { assessmentId: "11" };
});

afterEach(cleanup);

describe("opening an assessment", () => {
  it("shows a loading state while the assessment is on its way", () => {
    vi.mocked(service.fetchStudentAssessment).mockReturnValue(new Promise(() => {}));

    render(<AssessmentPage />);

    expect(screen.getByText("Loading assessment…")).toBeInTheDocument();
  });

  it.each(["not-a-number", "0", "-3", "1.5"])(
    "asks the server nothing for the address %s",
    async (raw) => {
      params = { assessmentId: raw };

      render(<AssessmentPage />);

      expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
      expect(service.fetchStudentAssessment).not.toHaveBeenCalled();
      expect(service.fetchOwnAttempt).not.toHaveBeenCalled();
    },
  );

  it("loads the assessment and the student's own result for it", async () => {
    await show();

    expect(service.fetchStudentAssessment).toHaveBeenCalledWith(11);
    expect(service.fetchOwnAttempt).toHaveBeenCalledWith(11);
  });

  it("shows its type, title and description", async () => {
    await show();

    expect(screen.getByText("Pre-test")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Networking Fundamentals" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Answer what you can.")).toBeInTheDocument();
  });

  it("names a post-test as one", async () => {
    await show(assessment({ type: "post_test", title: "Check your understanding" }));

    expect(screen.getByText("Post-test")).toBeInTheDocument();
    expect(screen.queryByText("Pre-test")).not.toBeInTheDocument();
  });

  it("numbers the questions in the order the server sent them", async () => {
    await show(assessment({ questions: [routing, switching] }));

    const groups = screen.getAllByRole("group");

    expect(groups[0]).toHaveAccessibleName(/^Question 1 Which layer routes packets\?/);
    expect(groups[1]).toHaveAccessibleName(/^Question 2 What does a switch/);
  });

  it("offers each question's four choices as one radio group", async () => {
    await show();

    expect(questionGroup(1).getAllByRole("radio")).toHaveLength(4);
    expect(questionGroup(2).getAllByRole("radio").map((radio) => radio.getAttribute("name")))
      .toEqual(["question-22", "question-22", "question-22", "question-22"]);
    expect(
      questionGroup(1).getByRole("radio", { name: "Connect devices within a LAN" }),
    ).not.toBeChecked();
    expect(submitButton()).toBeEnabled();
  });

  it("shows nothing of a draft the server says is not there", async () => {
    vi.mocked(service.fetchStudentAssessment).mockRejectedValue(
      new ApiError("That is not there any more.", 404),
    );

    render(<AssessmentPage />);

    expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit assessment" }),
    ).not.toBeInTheDocument();
    // No result is asked for an assessment that cannot be opened.
    expect(service.fetchOwnAttempt).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the assessment is withheld", async () => {
    vi.mocked(service.fetchStudentAssessment).mockRejectedValue(
      new ApiError("This topic has not been released yet.", 403),
    );

    render(<AssessmentPage />);

    expect(
      await screen.findByRole("heading", { name: "Assessment not available yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This topic has not been released yet.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("offers a retry when loading fails for any other reason", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchStudentAssessment)
      .mockRejectedValueOnce(new ApiError("The server had a problem with that.", 500))
      .mockResolvedValue(assessment());
    vi.mocked(service.fetchOwnAttempt).mockResolvedValue(null);

    render(<AssessmentPage />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Networking Fundamentals" }),
    ).toBeInTheDocument();
  });
});

describe("going back", () => {
  it("returns to the assessment's topic", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Back to topic" }));

    expect(navigate).toHaveBeenCalledWith("/topic/4");
  });

  it("returns to the roadmap when there is no assessment to go back from", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchStudentAssessment).mockRejectedValue(
      new ApiError("That is not there any more.", 404),
    );

    render(<AssessmentPage />);

    await user.click(await screen.findByRole("button", { name: "Back to Roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/roadmap");
  });
});

describe("choosing answers", () => {
  it("marks the choice picked", async () => {
    const user = userEvent.setup();
    await show();

    const pick = questionGroup(1).getByRole("radio", { name: "Encrypt traffic" });
    await user.click(pick);

    expect(pick).toBeChecked();
  });

  it("keeps one answer per question", async () => {
    const user = userEvent.setup();
    await show();

    const first = questionGroup(1).getByRole("radio", { name: "Encrypt traffic" });
    const second = questionGroup(1).getByRole("radio", { name: "Resolve domain names" });

    await user.click(first);
    await user.click(second);

    expect(second).toBeChecked();
    expect(first).not.toBeChecked();
    expect(questionGroup(1).getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked))
      .toHaveLength(1);
  });

  it("keeps each question's answer while others are answered", async () => {
    const user = userEvent.setup();
    await show();

    await answerAll(user);

    expect(
      questionGroup(1).getByRole("radio", { name: "Assign public IP addresses" }),
    ).toBeChecked();
    expect(questionGroup(2).getByRole("radio", { name: "Network" })).toBeChecked();
    expect(screen.getByText("2 of 2 answered")).toBeInTheDocument();
    // Picking is local: nothing is sent until the student submits.
    expect(service.submitAssessment).not.toHaveBeenCalled();
  });

  it("will not submit with a question unanswered, and says which", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" }));
    await user.click(submitButton());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Question 2 is unanswered. Answer every question before submitting.",
    );
    expect(
      screen.getByRole("group", { name: /^Question 2\b/ }),
    ).toHaveAccessibleDescription("Choose an answer to this question.");
    expect(
      screen.getByRole("group", { name: /^Question 1\b/ }),
    ).not.toHaveAccessibleDescription();

    // Nothing sent, nothing lost.
    expect(service.submitAssessment).not.toHaveBeenCalled();
    expect(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" })).toBeChecked();
  });

  it("lists every unanswered question when there are several", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(submitButton());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Questions 1 and 2 are unanswered.",
    );
    expect(service.submitAssessment).not.toHaveBeenCalled();
  });
});

describe("submitting", () => {
  it("sends one answer per question, in question order", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);

    await answerAll(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(service.submitAssessment).toHaveBeenCalledWith(11, [
        { questionId: 21, choiceId: 32 },
        { questionId: 22, choiceId: 41 },
      ]),
    );
  });

  it("puts only question and choice ids on the wire — no student, score or correctness", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockImplementation(realService.submitAssessment);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 5,
        assessment_id: 11,
        earned_points: 1,
        total_points: 3,
        percent: 33.33,
        submitted_at: "2026-09-15T10:00:00Z",
      },
    });

    await answerAll(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/assessments/11/attempts", {
        answers: [
          { question_id: 21, choice_id: 32 },
          { question_id: 22, choice_id: 41 },
        ],
      }),
    );

    const [path, payload] = vi.mocked(api.post).mock.calls[0];
    const body = payload as { answers: Record<string, unknown>[] };

    expect(path).not.toContain("user_id");
    for (const field of [
      "user_id",
      "score",
      "earned_points",
      "total_points",
      "percent",
      "is_correct",
      "points_awarded",
      "submitted_at",
    ]) {
      expect(body).not.toHaveProperty(field);
    }
    for (const answer of body.answers) {
      expect(Object.keys(answer).sort()).toEqual(["choice_id", "question_id"]);
    }

    // And what comes back is the server's score, as sent.
    expect(await screen.findByTestId("assessment-score")).toHaveTextContent("1 / 3");
    expect(screen.getByTestId("assessment-percent")).toHaveTextContent("33.33%");
  });

  it("sends one submission however often it is pressed", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));

    await answerAll(user);
    await user.click(submitButton());

    const pending = screen.getByRole("button", { name: "Submitting…" });
    expect(pending).toBeDisabled();

    await user.click(pending);

    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("shows the server's result, and never the form again", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);

    await answerAll(user);
    await user.click(submitButton());

    const shown = within(
      await screen.findByRole("region", { name: "Assessment submitted" }),
    );

    expect(shown.getByTestId("assessment-score")).toHaveTextContent("8 / 10");
    expect(shown.getByTestId("assessment-percent")).toHaveTextContent("80%");
    expect(toast.success).toHaveBeenCalledWith("Assessment submitted.");

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit assessment" }),
    ).not.toBeInTheDocument();
    // Straight from the response: nothing was read back to show it.
    expect(service.fetchOwnAttempt).toHaveBeenCalledTimes(1);
  });

  it("keeps every answer when the server refuses the submission", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await answerAll(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server had a problem with that.",
    );
    expect(
      questionGroup(1).getByRole("radio", { name: "Assign public IP addresses" }),
    ).toBeChecked();
    expect(questionGroup(2).getByRole("radio", { name: "Network" })).toBeChecked();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole("region", { name: "Assessment submitted" })).not.toBeInTheDocument();
  });

  it("shows the server's validation message for the answers", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        answers: ["Answer every question of this assessment, and only those."],
      }),
    );

    await answerAll(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Answer every question of this assessment, and only those.",
    );
    expect(questionGroup(2).getByRole("radio", { name: "Network" })).toBeChecked();
    expect(service.fetchStudentAssessment).toHaveBeenCalledTimes(1);
  });

  it("reloads onto the result when another tab submitted first", async () => {
    const user = userEvent.setup();
    const refusal =
      '"Networking Fundamentals" has already been submitted. Each assessment can be taken once.';

    vi.mocked(service.fetchStudentAssessment).mockResolvedValue(assessment());
    vi.mocked(service.fetchOwnAttempt)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(result);
    vi.mocked(service.submitAssessment).mockRejectedValue(new ApiError(refusal, 409));

    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Networking Fundamentals" });

    await answerAll(user);
    await user.click(submitButton());

    expect(
      await screen.findByRole("region", { name: "Assessment submitted" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(refusal);
    expect(screen.getByTestId("assessment-score")).toHaveTextContent("8 / 10");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(service.fetchStudentAssessment).toHaveBeenCalledTimes(2);
  });

  it("reloads onto the refusal when the assessment was withdrawn meanwhile", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchStudentAssessment)
      .mockResolvedValueOnce(assessment())
      .mockRejectedValue(new ApiError("Not found.", 404));
    vi.mocked(service.fetchOwnAttempt).mockResolvedValue(null);
    vi.mocked(service.submitAssessment).mockRejectedValue(new ApiError("Not found.", 404));

    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Networking Fundamentals" });

    await answerAll(user);
    await user.click(submitButton());

    expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("an assessment already taken", () => {
  it("opens on the result", async () => {
    await show(assessment(), { ...result, earnedPoints: 2, totalPoints: 3, percent: 66.67 });

    const shown = within(screen.getByRole("region", { name: "Assessment submitted" }));

    expect(shown.getByTestId("assessment-score")).toHaveTextContent("2 / 3");
    expect(shown.getByTestId("assessment-percent")).toHaveTextContent("66.67%");
    expect(shown.getByText(/^Submitted /)).toBeInTheDocument();
  });

  it("offers no form and no way to submit again", async () => {
    await show(assessment(), result);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit/i }),
    ).not.toBeInTheDocument();
  });

  it("shows nothing about which answers were right", async () => {
    await show(assessment(), result);

    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
    // The questions themselves are not replayed either — nothing to mark.
    expect(screen.queryByText("What does a switch primarily do?")).not.toBeInTheDocument();
  });
});

describe("the answer key", () => {
  it("is nowhere on the page while the assessment is being answered", async () => {
    await show();

    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("data-correct");
      expect(
        [...radio.attributes].map((attribute) => attribute.name).sort(),
      ).toEqual(["class", "name", "type", "value"]);
    }
  });

  it("has no field in the types a student's page works with", () => {
    // A compile-time statement, checked by `npm run typecheck`: each of these
    // would be an error if the student types ever grew an answer-key field.
    const choice = assessment().questions[0].choices[0];
    // @ts-expect-error — a student's choice carries no correctness.
    void choice.isCorrect;
    // @ts-expect-error — a student's result carries nothing per question.
    void result.pointsAwarded;
    // @ts-expect-error — nor whose attempt it is.
    void result.userId;

    expect(Object.keys(choice).sort()).toEqual(["id", "label", "order"]);
    expect(Object.keys(result).sort()).toEqual([
      "assessmentId",
      "earnedPoints",
      "id",
      "percent",
      "submittedAt",
      "totalPoints",
    ]);
  });
});
