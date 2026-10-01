// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssessmentPage } from "./AssessmentPage";
import { ApiError } from "@/services/api";
import type {
  AssessmentResult,
  AssessmentReview,
  StudentAssessment,
  StudentAssessmentQuestion,
} from "@/features/assessments/studentAssessmentService";
import type { TopicProgression } from "@/features/content/progressionService";

/**
 * A student taking a pre-test or post-test.
 *
 * The service is stubbed, so these say what the page asks for and what it does
 * with the answer. What carries the most weight: nothing is shown of an
 * assessment the server will not open; the questions come one at a time, from
 * a start screen, forward only; nothing is sent until the last is settled; the
 * submission is the answers and nothing a score is made of; and once a result
 * exists — from this tab or another — the questions are gone for good.
 *
 * The timers are driven with fake timers and a fake clock, and only after the
 * page has loaded: the countdown reads the clock, so moving the clock without
 * running any ticks is how a background tab is played out.
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
    fetchOwnAttemptReview: vi.fn(),
    submitAssessment: vi.fn(),
  };
});

vi.mock("@/features/content/progressionService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/progressionService")
  >();

  return { ...actual, fetchTopicProgression: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/studentAssessmentService");
const progress = await import("@/features/content/progressionService");
const realService = await vi.importActual<
  typeof import("@/features/assessments/studentAssessmentService")
>("@/features/assessments/studentAssessmentService");
const { api } = await import("@/services/api");
const { toast } = await import("sonner");

const switching: StudentAssessmentQuestion = {
  id: 21,
  prompt: "What does a switch primarily do?",
  points: 2,
  timeLimitSeconds: null,
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
  timeLimitSeconds: null,
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
    version: 1,
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

/**
 * The attempt behind the two questions above: the first answered wrongly, the
 * second rightly.
 *
 * Every number is its own — what each question was worth, what was awarded for
 * it, the choice picked and the choice that was right — so a page that read the
 * wrong one could not land on a value that happens to look right.
 */
function review(over: Partial<AssessmentReview> = {}): AssessmentReview {
  return {
    id: 5,
    assessmentId: 11,
    earnedPoints: 1,
    totalPoints: 3,
    percent: 33.33,
    submittedAt: "2026-09-15T10:00:00Z",
    assessment: {
      id: 11,
      topicId: 4,
      type: "pre_test",
      version: 1,
      title: "Networking Fundamentals",
      description: "Answer what you can.",
    },
    questions: [
      {
        ...switching,
        selectedChoiceId: 32, // Assign public IP addresses
        correctChoiceId: 31, // Connect devices within a LAN
        isCorrect: false,
        pointsAwarded: 0,
      },
      {
        ...routing,
        selectedChoiceId: 41, // Network
        correctChoiceId: 41,
        isCorrect: true,
        pointsAwarded: 1,
      },
    ],
    ...over,
  };
}

/**
 * Renders the page and waits for the assessment to land.
 *
 * A review is of the assessment it is shown with, so the one passed here is
 * given the same title, type and topic the server would have sent with it —
 * the page reads its heading from the review once there is one.
 */
async function show(
  value: StudentAssessment = assessment(),
  attempt: AssessmentReview | null = null,
) {
  vi.mocked(service.fetchStudentAssessment).mockResolvedValue(value);
  vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(
    attempt === null
      ? null
      : {
          ...attempt,
          assessment: {
            id: value.id,
            topicId: value.topicId,
            type: value.type,
            version: value.version,
            title: value.title,
            description: value.description,
          },
        },
  );

  render(<AssessmentPage />);

  await screen.findByRole("heading", { name: value.title });
}

/** What the read after a submission finds. The page puts the review up from it. */
function reviewLandsOn(attempt: AssessmentReview = review()) {
  vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(attempt);
}

/** One question, so a query cannot stray into another. */
function questionGroup(number: number) {
  return within(screen.getByRole("group", { name: new RegExp(`^Question ${number}\\b`) }));
}

type User = ReturnType<typeof userEvent.setup>;

/** Past the start screen, onto question 1. */
async function begin(user: User) {
  await user.click(screen.getByRole("button", { name: "Start assessment" }));
}

/**
 * Takes the whole assessment: Start, then a pick and Next on question 1, and a
 * pick and Finish on question 2 — which is what submits it.
 */
async function answerAll(user: User) {
  await begin(user);
  await user.click(questionGroup(1).getByRole("radio", { name: "Assign public IP addresses" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(questionGroup(2).getByRole("radio", { name: "Network" }));
  await user.click(screen.getByRole("button", { name: "Finish" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  params = { assessmentId: "11" };
  // Not taken, unless a test says otherwise: the page asks this of every
  // assessment it opens, before it asks anything else.
  vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);
  vi.mocked(progress.fetchTopicProgression).mockResolvedValue(progression());
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
      expect(service.fetchOwnAttemptReview).not.toHaveBeenCalled();
    },
  );

  it("loads the assessment and the student's own result for it", async () => {
    await show();

    expect(service.fetchStudentAssessment).toHaveBeenCalledWith(11);
    expect(service.fetchOwnAttemptReview).toHaveBeenCalledWith(11);
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
    const user = userEvent.setup();
    await show(assessment({ questions: [routing, switching] }));

    await begin(user);
    expect(screen.getByRole("group")).toHaveAccessibleName(/^Question 1 of 2\. Which layer routes packets\?/);

    await user.click(screen.getByRole("radio", { name: "Network" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("group")).toHaveAccessibleName(/^Question 2 of 2\. What does a switch/);
  });

  it("offers the open question's four choices as one radio group", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

    expect(questionGroup(1).getAllByRole("radio").map((radio) => radio.getAttribute("name")))
      .toEqual(["question-21", "question-21", "question-21", "question-21"]);
    expect(
      questionGroup(1).getByRole("radio", { name: "Connect devices within a LAN" }),
    ).not.toBeChecked();
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
    // The review was asked for first and answered with nothing of theirs, so
    // what the catalogue says about the assessment itself is what decides.
    expect(service.fetchOwnAttemptReview).toHaveBeenCalledWith(11);
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
    vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);

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
    await begin(user);

    const pick = questionGroup(1).getByRole("radio", { name: "Encrypt traffic" });
    await user.click(pick);

    expect(pick).toBeChecked();
  });

  it("keeps one answer per question", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

    const first = questionGroup(1).getByRole("radio", { name: "Encrypt traffic" });
    const second = questionGroup(1).getByRole("radio", { name: "Resolve domain names" });

    await user.click(first);
    await user.click(second);

    expect(second).toBeChecked();
    expect(first).not.toBeChecked();
    expect(questionGroup(1).getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked))
      .toHaveLength(1);
  });

  it("picking does not move on; Next does, once", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

    await user.click(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" }));
    await user.click(questionGroup(1).getByRole("radio", { name: "Resolve domain names" }));

    // Still question 1, however often it is picked.
    expect(screen.getByTestId("question-progress")).toHaveTextContent("Question 1 / 2");

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByTestId("question-progress")).toHaveTextContent("Question 2 / 2");
    expect(screen.getAllByRole("group")).toHaveLength(1);
    // Picking is local: nothing is sent until the last question is settled.
    expect(service.submitAssessment).not.toHaveBeenCalled();
  });

  it("offers Next only once an answer is picked", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Pick an answer to continue.")).toBeInTheDocument();

    await user.click(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" }));

    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("offers no way back to a question once it is settled", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

    await user.click(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByRole("button", { name: /back to question|previous/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Encrypt traffic" })).toBeNull();
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
  });
});

describe("two to six choices", () => {
  const trueFalse: StudentAssessmentQuestion = {
    id: 51,
    prompt: "A router forwards packets between networks.",
    points: 1,
    timeLimitSeconds: null,
    order: 1,
    choices: [
      { id: 61, label: "True", order: 0 },
      { id: 62, label: "False", order: 1 },
    ],
  };

  const layers: StudentAssessmentQuestion = {
    id: 52,
    prompt: "Which layer do applications talk to?",
    points: 1,
    timeLimitSeconds: null,
    order: 1,
    choices: ["Physical", "Data link", "Network", "Transport", "Session", "Application"].map(
      (label, index) => ({ id: 70 + index, label, order: index }),
    ),
  };

  it("shows a true/false question as two choices, one picked at a time, with no answer given away", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [trueFalse] }));
    await begin(user);

    const group = questionGroup(1);
    expect(group.getAllByRole("radio")).toHaveLength(2);
    expect(group.getByText("A")).toBeInTheDocument();
    expect(group.getByText("B")).toBeInTheDocument();

    await user.click(group.getByRole("radio", { name: "True" }));
    await user.click(group.getByRole("radio", { name: "False" }));

    expect(group.getByRole("radio", { name: "False" })).toBeChecked();
    expect(group.getByRole("radio", { name: "True" })).not.toBeChecked();
    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
  });

  it("shows all six choices of a six-choice question, lettered A to F, in order", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [layers] }));
    await begin(user);

    const group = questionGroup(1);
    const radios = group.getAllByRole("radio");

    expect(radios).toHaveLength(6);
    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "APhysical",
      "BData link",
      "CNetwork",
      "DTransport",
      "ESession",
      "FApplication",
    ]);

    await user.click(group.getByRole("radio", { name: "Application" }));

    expect(group.getByRole("radio", { name: "Application" })).toBeChecked();
    expect(group.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
    for (const radio of radios) {
      expect(radio).not.toHaveAttribute("data-correct");
    }
  });
});

describe("submitting", () => {
  it("sends one answer per question, in question order", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);

    await answerAll(user);

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
    reviewLandsOn();
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

    // And the page ends on the server's score, read back with the review.
    expect(await screen.findByTestId("assessment-score")).toHaveTextContent("1 / 3");
    expect(screen.getByTestId("assessment-percent")).toHaveTextContent("33.33%");
  });

  it("sends one submission however often Finish is pressed", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));

    await begin(user);
    await user.click(questionGroup(1).getByRole("radio", { name: "Encrypt traffic" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(questionGroup(2).getByRole("radio", { name: "Network" }));

    const finish = screen.getByRole("button", { name: "Finish" });
    // Twice in one go, before the page has re-rendered between them.
    act(() => {
      finish.click();
      finish.click();
    });

    expect(await screen.findByText("Submitting your answers…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish" })).toBeNull();
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("shows the server's result, and never the form again", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();

    await answerAll(user);

    const shown = within(
      await screen.findByRole("region", { name: "Assessment submitted" }),
    );

    expect(shown.getByTestId("assessment-score")).toHaveTextContent("1 / 3");
    expect(shown.getByTestId("assessment-percent")).toHaveTextContent("33.33%");
    expect(toast.success).toHaveBeenCalledWith("Assessment submitted.");

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit assessment" }),
    ).not.toBeInTheDocument();
    // The submission's own reply carries the totals and not the answers, so the
    // attempt is read back once it exists — and that read is the whole review.
    expect(service.fetchOwnAttemptReview).toHaveBeenCalledTimes(2);
    expect(service.fetchOwnAttemptReview).toHaveBeenLastCalledWith(11);
  });

  it("keeps every answer when the server refuses the submission, and sends the same on a retry", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockRejectedValueOnce(
      new ApiError("The server had a problem with that.", 500),
    );

    await answerAll(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server had a problem with that.",
    );
    expect(screen.getByText("Your answers are still here. Nothing has been submitted yet.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Assessment submitted" })).not.toBeInTheDocument();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();
    await user.click(screen.getByRole("button", { name: "Try submitting again" }));

    expect(service.submitAssessment).toHaveBeenCalledTimes(2);
    expect(vi.mocked(service.submitAssessment).mock.calls[1]).toEqual(
      vi.mocked(service.submitAssessment).mock.calls[0],
    );
    expect(await screen.findByRole("region", { name: "Assessment submitted" })).toBeInTheDocument();
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Answer every question of this assessment, and only those.",
    );
    expect(screen.getByRole("button", { name: "Try submitting again" })).toBeEnabled();
    expect(service.fetchStudentAssessment).toHaveBeenCalledTimes(1);
  });

  it("reloads onto the result when another tab submitted first", async () => {
    const user = userEvent.setup();
    const refusal =
      '"Networking Fundamentals" has already been submitted. Each assessment can be taken once.';

    vi.mocked(service.fetchStudentAssessment).mockResolvedValue(assessment());
    vi.mocked(service.fetchOwnAttemptReview)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(review());
    vi.mocked(service.submitAssessment).mockRejectedValue(new ApiError(refusal, 409));

    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Networking Fundamentals" });

    await answerAll(user);

    expect(
      await screen.findByRole("region", { name: "Assessment submitted" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(refusal);
    expect(screen.getByTestId("assessment-score")).toHaveTextContent("1 / 3");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    // The attempt the other tab made is theirs to read, so the second read
    // finds it and the assessment itself is not asked about again.
    expect(service.fetchOwnAttemptReview).toHaveBeenCalledTimes(2);
  });

  it("reloads onto the refusal when the assessment was withdrawn meanwhile", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchStudentAssessment)
      .mockResolvedValueOnce(assessment())
      .mockRejectedValue(new ApiError("Not found.", 404));
    vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);
    vi.mocked(service.submitAssessment).mockRejectedValue(new ApiError("Not found.", 404));

    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Networking Fundamentals" });

    await answerAll(user);

    expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("a version replaced by a newer one", () => {
  const replaced =
    "This assessment has been updated since you opened it. Go back to the topic to take the current version.";

  it("says the assessment was updated when it is opened after being replaced", async () => {
    vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);
    vi.mocked(service.fetchStudentAssessment).mockRejectedValue(new ApiError(replaced, 409));

    render(<AssessmentPage />);

    expect(await screen.findByText("Assessment updated")).toBeInTheDocument();
    expect(screen.getByText(replaced)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("reloads onto the update when a newer version went live while it was being answered", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchStudentAssessment)
      .mockResolvedValueOnce(assessment())
      .mockRejectedValue(new ApiError(replaced, 409));
    vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);
    vi.mocked(service.submitAssessment).mockRejectedValue(new ApiError(replaced, 409));

    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Networking Fundamentals" });

    await answerAll(user);

    expect(await screen.findByText("Assessment updated")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("names the version a review was taken on", async () => {
    // show() gives the review the assessment it is handed.
    await show(assessment({ version: 2 }), review());

    expect(await screen.findByText("Version 2")).toBeInTheDocument();
  });

  it("does not name a version over the form a student is answering", async () => {
    await show(assessment({ version: 3 }));

    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument();
  });
});

describe("an assessment already taken", () => {
  it("opens on the result", async () => {
    await show(assessment(), review({ earnedPoints: 2, totalPoints: 3, percent: 66.67 }));

    const shown = within(screen.getByRole("region", { name: "Assessment submitted" }));

    expect(shown.getByTestId("assessment-score")).toHaveTextContent("2 / 3");
    expect(shown.getByTestId("assessment-percent")).toHaveTextContent("66.67%");
    expect(shown.getByText(/^Submitted /)).toBeInTheDocument();
  });

  it("offers no form and no way to submit again", async () => {
    await show(assessment(), review());

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit/i }),
    ).not.toBeInTheDocument();
  });

  it("replays the questions it was taken on, with what was picked", async () => {
    await show(assessment(), review());

    expect(screen.getByText("What does a switch primarily do?")).toBeInTheDocument();
    expect(screen.getByText("Which layer routes packets?")).toBeInTheDocument();
    expect(questionGroup(1).getByText("Your answer")).toBeInTheDocument();
  });
});

describe("reviewing a completed attempt", () => {
  it("puts the review up once the submission has gone through", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();

    // Nothing of a review while the form is up: it is a reading of an attempt,
    // and there is no attempt until this button is pressed.
    expect(
      screen.queryByRole("heading", { name: "Your answers" }),
    ).not.toBeInTheDocument();

    await answerAll(user);

    expect(
      await screen.findByRole("heading", { name: "Your answers" }),
    ).toBeInTheDocument();
    // No second address to discover, and no attempt id anywhere: the review is
    // where the assessment was, under the assessment's own id.
    expect(navigate).not.toHaveBeenCalled();
    expect(service.fetchOwnAttemptReview).toHaveBeenLastCalledWith(11);
  });

  it("shows the score and the percentage the server worked out", async () => {
    await show(assessment(), review());

    const shown = within(screen.getByRole("region", { name: "Assessment submitted" }));

    expect(shown.getByTestId("assessment-score")).toHaveTextContent("1 / 3");
    expect(shown.getByTestId("assessment-percent")).toHaveTextContent("33.33%");
  });

  it("reviews the questions in the order the server sent them", async () => {
    await show(
      assessment({ questions: [routing, switching] }),
      review({
        questions: [
          {
            ...routing,
            selectedChoiceId: 41,
            correctChoiceId: 41,
            isCorrect: true,
            pointsAwarded: 1,
          },
          {
            ...switching,
            selectedChoiceId: 32,
            correctChoiceId: 31,
            isCorrect: false,
            pointsAwarded: 0,
          },
        ],
      }),
    );

    const groups = screen.getAllByRole("group");

    expect(groups[0]).toHaveAccessibleName(/^Question 1 Which layer routes packets/);
    expect(groups[1]).toHaveAccessibleName(/^Question 2 What does a switch/);
  });

  it("keeps each question's choices in the order they were offered", async () => {
    await show(assessment(), review());

    expect(
      questionGroup(1)
        .getAllByRole("listitem")
        .map((choice) => choice.textContent),
    ).toEqual([
      "Connect devices within a LANCorrect answer",
      "Assign public IP addressesYour answer",
      "Encrypt traffic",
      "Resolve domain names",
    ]);
  });

  it("names the choice the student picked", async () => {
    await show(assessment(), review());

    const picked = questionGroup(1).getByText("Your answer").closest("li");

    expect(
      within(picked as HTMLElement).getByText("Assign public IP addresses"),
    ).toBeInTheDocument();
  });

  it("names the choice that was right", async () => {
    await show(assessment(), review());

    const key = questionGroup(1).getByText("Correct answer").closest("li");

    expect(
      within(key as HTMLElement).getByText("Connect devices within a LAN"),
    ).toBeInTheDocument();
  });

  it("says a right answer is right, in words and not only in colour", async () => {
    await show(assessment(), review());

    const right = questionGroup(2);

    expect(screen.getByRole("group", { name: /Correct$/ })).toBeInTheDocument();

    // One row carrying both: what they picked, and what was right.
    const picked = right.getByText("Your answer").closest("li");

    expect(within(picked as HTMLElement).getByText("Correct answer")).toBeInTheDocument();
    expect(right.getByText("1 of 1 point awarded")).toBeInTheDocument();
  });

  it("shows a wrong answer beside the right one, and says which is which", async () => {
    await show(assessment(), review());

    const wrong = questionGroup(1);

    expect(screen.getByRole("group", { name: /Incorrect$/ })).toBeInTheDocument();

    // Two different rows, each named in words rather than by colour alone.
    const picked = wrong.getByText("Your answer").closest("li");
    const key = wrong.getByText("Correct answer").closest("li");

    expect(picked).not.toBe(key);
    expect(
      within(picked as HTMLElement).getByText("Assign public IP addresses"),
    ).toBeInTheDocument();
    expect(
      within(key as HTMLElement).getByText("Connect devices within a LAN"),
    ).toBeInTheDocument();
    expect(wrong.getByText("0 of 2 points awarded")).toBeInTheDocument();
  });

  it("says a question was not answered rather than inventing an answer for it", async () => {
    await show(
      assessment(),
      review({
        questions: [
          {
            ...switching,
            selectedChoiceId: null,
            correctChoiceId: 31,
            isCorrect: false,
            pointsAwarded: 0,
          },
        ],
      }),
    );

    const unanswered = questionGroup(1);

    expect(screen.getByRole("group", { name: /Not answered$/ })).toBeInTheDocument();
    expect(unanswered.getByText("You did not answer this question.")).toBeInTheDocument();

    // Nothing is claimed to have been picked, and the key is still shown.
    expect(unanswered.queryByText("Your answer")).not.toBeInTheDocument();
    expect(
      within(
        unanswered.getByText("Correct answer").closest("li") as HTMLElement,
      ).getByText("Connect devices within a LAN"),
    ).toBeInTheDocument();
    expect(unanswered.getByText("0 of 2 points awarded")).toBeInTheDocument();
  });

  it("offers nothing to change and nothing to press", async () => {
    await show(assessment(), review());

    const reviewed = questionGroup(1);

    // Read, not answered again: no control of any kind, and none disabled and
    // left standing to look like one that could be used.
    expect(reviewed.queryByRole("radio")).not.toBeInTheDocument();
    expect(reviewed.queryByRole("button")).not.toBeInTheDocument();
    expect(reviewed.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(reviewed.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();

    const group = screen.getByRole("group", { name: /^Question 1/ });

    expect(group.querySelector("input, button, select, textarea")).toBeNull();
  });

  it("reads the same for a post-test as for a pre-test", async () => {
    await show(
      assessment({ type: "post_test", title: "Check your understanding" }),
      review(),
    );

    expect(screen.getByText("Post-test")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your answers" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Incorrect$/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Correct$/ })).toBeInTheDocument();
    expect(questionGroup(1).getByText("Correct answer")).toBeInTheDocument();
    expect(screen.getByTestId("assessment-score")).toHaveTextContent("1 / 3");
  });

  it("stays readable after the assessment it was taken on is withdrawn", async () => {
    // The server keeps a submitted attempt readable once its assessment is
    // unpublished or its roadmap withdrawn, and the review carries the title
    // and the topic for exactly that. The page does not ask the withdrawn
    // assessment's permission to show what the student already did.
    vi.mocked(service.fetchStudentAssessment).mockRejectedValue(
      new ApiError("That is not there any more.", 404),
    );
    vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(review());

    render(<AssessmentPage />);

    expect(
      await screen.findByRole("heading", { name: "Networking Fundamentals" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your answers" })).toBeInTheDocument();
    expect(screen.queryByText("Assessment not found")).not.toBeInTheDocument();
    // Back still leads to the topic the review names.
    expect(screen.getByRole("button", { name: "Back to topic" })).toBeInTheDocument();
  });

  it("offers a retry when the review cannot be read", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchOwnAttemptReview)
      .mockRejectedValueOnce(new ApiError("The server had a problem with that.", 500))
      .mockResolvedValue(review());

    render(<AssessmentPage />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Your answers" }),
    ).toBeInTheDocument();
  });

  it("says the answers went in when only reading them back failed", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    vi.mocked(service.fetchOwnAttemptReview).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await answerAll(user);

    // A student told only "something went wrong" would reasonably think their
    // submission had not gone through, and there is no second one to make.
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your answers were submitted. Only the review could not be loaded.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });
});

describe("the answer key", () => {
  it("is nowhere on the page while the assessment is being answered", async () => {
    const user = userEvent.setup();
    await show();
    await begin(user);

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

/** The topic's progression once its pre-test has been submitted. */
function progression(over: Partial<TopicProgression> = {}): TopicProgression {
  return {
    topicId: 4,
    preTest: {
      id: 11,
      version: 1,
      title: "Networking Fundamentals",
      submitted: true,
      waived: false,
      required: false,
      result: {
        assessmentId: 11,
        version: 1,
        earnedPoints: 8,
        totalPoints: 10,
        percent: 80,
        submittedAt: null,
      },
    },
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

describe("where the assessment leads", () => {
  it("reads the topic's progression again after a pre-test is submitted, and offers what it opened", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();

    // Nothing is asked about the topic while the form is still being answered.
    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();

    await answerAll(user);

    const start = await screen.findByRole("button", { name: "Start OSI Model" });

    // The topic the server says the assessment belongs to, read after the
    // submission rather than assumed to be open.
    expect(progress.fetchTopicProgression).toHaveBeenCalledWith(4);

    await user.click(start);

    expect(navigate).toHaveBeenCalledWith("/subtopic/101");
  });

  it("offers no subtopic the server has not opened", async () => {
    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(
      progression({
        subtopics: [
          { id: 101, title: "OSI Model", order: 0, status: "locked" },
          { id: 102, title: "TCP/IP", order: 1, status: "locked" },
        ],
      }),
    );

    await show(assessment(), review());

    await waitFor(() => expect(progress.fetchTopicProgression).toHaveBeenCalledWith(4));
    await screen.findByRole("region", { name: "Assessment submitted" });

    expect(screen.queryByRole("button", { name: /^Start/ })).not.toBeInTheDocument();
  });

  it("offers a taken pre-test's next subtopic when the result is reopened", async () => {
    await show(assessment(), review());

    expect(
      await screen.findByRole("button", { name: "Start OSI Model" }),
    ).toBeInTheDocument();
  });

  it("sends a post-test back to its topic and offers no subtopic", async () => {
    const user = userEvent.setup();
    await show(assessment({ type: "post_test", title: "Check your understanding" }), review());

    await user.click(screen.getByRole("button", { name: "Back to topic" }));

    expect(navigate).toHaveBeenCalledWith("/topic/4");
    expect(progress.fetchTopicProgression).not.toHaveBeenCalled();
  });

  it("goes back to the topic the server names, whatever the student came from", async () => {
    const user = userEvent.setup();
    await show(assessment({ topicId: 9 }));

    await user.click(screen.getByRole("button", { name: "Back to topic" }));

    expect(navigate).toHaveBeenCalledWith("/topic/9");
  });
});

describe("where focus goes after submitting", () => {
  it("lands on the result once the server has answered", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();

    await answerAll(user);

    // The Submit button that had focus is gone; the student lands on the result.
    const heading = await screen.findByRole("heading", { name: "Assessment submitted" });

    await waitFor(() => expect(heading).toHaveFocus());
    // Focusable from code only, so it is not a new stop in the tab order.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("moves nothing before the server answers", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));

    await answerAll(user);

    expect(screen.getByText("Submitting your answers…")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Assessment submitted" }),
    ).not.toBeInTheDocument();
  });

  it("leaves focus alone when a result that was already there is opened", async () => {
    await show(assessment(), review());

    expect(
      screen.getByRole("heading", { name: "Assessment submitted" }),
    ).not.toHaveFocus();
  });
});

describe("a long title on the next step", () => {
  it("lets the Start button wrap it", async () => {
    const longTitle =
      "Subnetting, supernetting and the arithmetic of CIDR prefixes, step by step";

    vi.mocked(progress.fetchTopicProgression).mockResolvedValue(
      progression({
        subtopics: [
          { id: 101, title: longTitle, order: 0, status: "available" },
          { id: 102, title: "TCP/IP", order: 1, status: "locked" },
        ],
      }),
    );

    await show(assessment(), review());

    const start = await screen.findByRole("button", { name: `Start ${longTitle}` });

    // The shared Button never wraps; this one must. Whether it looks right at
    // a phone's width is a browser check — jsdom cannot measure overflow.
    expect(start).toHaveClass("whitespace-normal", "h-auto");
    expect(start).not.toHaveClass("whitespace-nowrap");
  });
});

/* ============================================================
   THE START SCREEN AND THE TIMERS
   ============================================================ */

/** A question with a time limit. */
const timed = (question: StudentAssessmentQuestion, seconds: number): StudentAssessmentQuestion => ({
  ...question,
  timeLimitSeconds: seconds,
});

/**
 * Loads the page on real timers, then hands the clock over to fake ones: from
 * here on, time passes only when a test says so. Clicks are fireEvent, which
 * is synchronous, so nothing waits on a clock that is not moving.
 */
async function showTimed(questions: StudentAssessmentQuestion[], type: StudentAssessment["type"] = "pre_test") {
  await show(assessment({ questions, type }));
  vi.useFakeTimers();
}

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const pickChoice = (label: string) => fireEvent.click(screen.getByRole("radio", { name: label }));
const elapse = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const shownTime = () => screen.queryByTestId("question-timer")?.textContent ?? null;
const progressText = () => screen.getByTestId("question-progress").textContent;
const announced = () => screen.getByTestId("assessment-announcer").textContent;
/** Lets a submission's promise settle while the clock is fake. */
const settleSubmission = () => act(async () => {});

describe("the start screen", () => {
  afterEach(() => vi.useRealTimers());

  it("opens on a start screen that says how the assessment runs, with no question and no clock", async () => {
    await showTimed([switching, timed(routing, 30)]);

    expect(screen.getByRole("button", { name: "Start assessment" })).toBeInTheDocument();
    expect(screen.getByText(/2 questions, one at a time/)).toBeInTheDocument();
    expect(screen.getByText(/One question is timed/)).toBeInTheDocument();
    expect(screen.getByText(/You can't go back to a question/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(shownTime()).toBeNull();
  });

  it("says nothing about timing when no question is timed", async () => {
    await showTimed([switching, routing]);

    expect(screen.queryByText(/timed/)).toBeNull();
  });

  it("starts no clock however long the start screen is read", async () => {
    await showTimed([timed(switching, 10), routing]);

    elapse(10 * 60_000);

    expect(screen.getByRole("button", { name: "Start assessment" })).toBeInTheDocument();
    expect(service.submitAssessment).not.toHaveBeenCalled();

    press("Start assessment");

    // The whole ten seconds, from the moment question 1 appeared.
    expect(shownTime()).toBe("0:10");
  });

  it("opens question 1 on Start, with its heading focused and its progress shown", async () => {
    await showTimed([switching, routing]);

    press("Start assessment");

    expect(progressText()).toBe("Question 1 / 2");
    expect(screen.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();

    pickChoice("Assign public IP addresses");
    press("Next");

    expect(screen.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Which layer routes packets?");
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });
});

describe("a question's timer", () => {
  afterEach(() => vi.useRealTimers());

  it("counts the question's own limit down from the moment it opens", async () => {
    await showTimed([timed(switching, 30), routing]);
    press("Start assessment");

    expect(shownTime()).toBe("0:30");

    elapse(10_000);
    expect(shownTime()).toBe("0:20");

    elapse(15_000);
    expect(shownTime()).toBe("0:05");
    expect(screen.getByTestId("question-timer")).toHaveClass("text-red-700");
  });

  it("shows no countdown at all on an untimed question", async () => {
    await showTimed([switching, timed(routing, 30)]);
    press("Start assessment");

    expect(screen.queryByTestId("question-timer")).toBeNull();
    elapse(120_000);
    expect(progressText()).toBe("Question 1 / 2");
  });

  it("gives the next question its own fresh deadline", async () => {
    await showTimed([timed(switching, 10), timed(routing, 30)]);
    press("Start assessment");

    elapse(4_000);
    pickChoice("Assign public IP addresses");
    press("Next");

    expect(shownTime()).toBe("0:30");

    // The first question's deadline, six seconds on, means nothing here.
    elapse(6_000);
    expect(progressText()).toBe("Question 2 / 2");
    expect(shownTime()).toBe("0:24");
  });

  it("works from the deadline, not from how many ticks ran", async () => {
    await showTimed([timed(switching, 30), routing]);
    press("Start assessment");

    // The clock moves ten seconds while no interval runs — as a background tab
    // that the browser has stopped ticking would see it.
    vi.setSystemTime(Date.now() + 10_000);
    elapse(250);

    expect(shownTime()).toBe("0:20");
  });

  it("times out as soon as it looks, when the deadline passed while nothing ticked", async () => {
    await showTimed([timed(switching, 30), routing]);
    press("Start assessment");

    vi.setSystemTime(Date.now() + 45_000);
    elapse(250);

    expect(progressText()).toBe("Question 2 / 2");
  });

  it("moves on by itself when the time runs out, once, leaving the question unanswered", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([timed(switching, 10), routing]);
    press("Start assessment");

    pickChoice("Encrypt traffic"); // Picked, but never confirmed with Next.
    elapse(10_000);

    expect(progressText()).toBe("Question 2 / 2");
    expect(screen.getByText("Time ran out on question 1, so it was left unanswered.")).toBeInTheDocument();

    // Long after: still question 2. The first timer does not fire again.
    elapse(60_000);
    expect(progressText()).toBe("Question 2 / 2");

    pickChoice("Network");
    press("Finish");

    // The pick that was never confirmed is not sent: the question went unanswered.
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: null },
      { questionId: 22, choiceId: 41 },
    ]);
  });

  it("submits when the last question's time runs out, exactly once", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([switching, timed(routing, 10)]);
    press("Start assessment");

    pickChoice("Assign public IP addresses");
    press("Next");
    elapse(10_000);

    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: 32 },
      { questionId: 22, choiceId: null },
    ]);
    expect(screen.getByText("Time ran out on question 2, so it was left unanswered.")).toBeInTheDocument();
    expect(screen.getByText("Submitting your answers…")).toBeInTheDocument();

    elapse(60_000);
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("sends every question exactly once when all of them time out", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([timed(switching, 10), timed(routing, 15)]);
    press("Start assessment");

    elapse(10_000);
    elapse(15_000);

    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: null },
      { questionId: 22, choiceId: null },
    ]);
  });

  it("works the same on a post-test", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([timed(switching, 20), routing], "post_test");
    press("Start assessment");

    expect(shownTime()).toBe("0:20");
    elapse(20_000);
    pickChoice("Network");
    press("Finish");

    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: null },
      { questionId: 22, choiceId: 41 },
    ]);
  });
});

describe("Next and the timer at the same moment", () => {
  afterEach(() => vi.useRealTimers());

  it("lets Next win when it lands first, and the timer does nothing after", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([timed(switching, 10), routing]);
    press("Start assessment");

    pickChoice("Encrypt traffic");
    elapse(9_999);

    // Next and the deadline in one go, before anything re-renders.
    act(() => {
      screen.getByRole("button", { name: "Next" }).click();
      vi.advanceTimersByTime(250);
    });

    // One step on, not two.
    expect(progressText()).toBe("Question 2 / 2");
    expect(screen.queryByText(/Time ran out/)).toBeNull();

    pickChoice("Network");
    press("Finish");

    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: 33 },
      { questionId: 22, choiceId: 41 },
    ]);
  });

  it("lets the timer win when it lands first, and a late Next does nothing to the next question", async () => {
    vi.mocked(service.submitAssessment).mockReturnValue(new Promise(() => {}));
    await showTimed([timed(switching, 10), routing]);
    press("Start assessment");

    pickChoice("Encrypt traffic");
    const next = screen.getByRole("button", { name: "Next" });

    act(() => {
      vi.advanceTimersByTime(10_000);
      next.click();
    });

    expect(progressText()).toBe("Question 2 / 2");
    expect(screen.getByText(/Time ran out on question 1/)).toBeInTheDocument();
    // Question 2 has nothing picked, so nothing carried it on.
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();

    pickChoice("Network");
    press("Finish");

    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
    expect(service.submitAssessment).toHaveBeenCalledWith(11, [
      { questionId: 21, choiceId: null },
      { questionId: 22, choiceId: 41 },
    ]);
  });

  it("moves on one question for a rapid double press of Next, skipping nothing", async () => {
    await showTimed([switching, routing, { ...switching, id: 23, prompt: "Third?" }]);
    press("Start assessment");

    pickChoice("Encrypt traffic");
    const next = screen.getByRole("button", { name: "Next" });
    act(() => {
      next.click();
      next.click();
    });

    expect(progressText()).toBe("Question 2 / 3");
    expect(service.submitAssessment).not.toHaveBeenCalled();
  });
});

/**
 * The intervals running right now, as window.setInterval and clearInterval
 * see them. Counted on its own rather than with vi.getTimerCount(), which also
 * counts the timers React and the test environment keep for themselves.
 */
const intervalSpies: { mockRestore: () => void }[] = [];

function trackIntervals(): () => number {
  const live = new Set<number>();
  const set = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);

  intervalSpies.push(
    vi.spyOn(window, "setInterval").mockImplementation(((handler: TimerHandler, ms?: number) => {
      const id = set(handler, ms);
      live.add(id);
      return id;
    }) as typeof window.setInterval),
    vi.spyOn(window, "clearInterval").mockImplementation((id?: number) => {
      if (id !== undefined) live.delete(id);
      clear(id);
    }),
  );

  return () => live.size;
}

describe("what a timer leaves behind", () => {
  afterEach(() => {
    intervalSpies.splice(0).forEach((spy) => spy.mockRestore());
    vi.useRealTimers();
  });

  it("runs one interval for a timed question, and none once it is settled", async () => {
    await showTimed([timed(switching, 30), routing]);
    const running = trackIntervals();

    expect(running()).toBe(0);
    press("Start assessment");
    expect(running()).toBe(1);

    pickChoice("Encrypt traffic");
    press("Next");

    // Question 2 is untimed: nothing is ticking.
    expect(running()).toBe(0);
  });

  it("swaps the old question's interval for the new one's, never running two", async () => {
    await showTimed([timed(switching, 30), timed(routing, 30)]);
    const running = trackIntervals();

    press("Start assessment");
    pickChoice("Encrypt traffic");
    press("Next");

    expect(running()).toBe(1);
    elapse(30_000);
    expect(running()).toBe(0);
  });

  it("leaves no timer running once the assessment is submitted", async () => {
    vi.mocked(service.submitAssessment).mockResolvedValue(result);
    reviewLandsOn();
    await showTimed([switching, timed(routing, 30)]);
    const running = trackIntervals();

    press("Start assessment");
    pickChoice("Encrypt traffic");
    press("Next");
    expect(running()).toBe(1);

    pickChoice("Network");
    press("Finish");
    await settleSubmission();

    expect(running()).toBe(0);
    expect(service.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("stops the clock when the page goes away mid-question, and nothing is sent", async () => {
    await showTimed([timed(switching, 10), routing]);
    const running = trackIntervals();
    press("Start assessment");
    expect(running()).toBe(1);

    cleanup();
    expect(running()).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(service.submitAssessment).not.toHaveBeenCalled();
  });
});

describe("what a screen reader is told about time", () => {
  afterEach(() => vi.useRealTimers());

  it("does not read the countdown out: it is hidden from assistive technology", async () => {
    await showTimed([timed(switching, 30), routing]);
    press("Start assessment");

    expect(screen.getByTestId("question-timer")).toHaveAttribute("aria-hidden", "true");
    // The limit is part of the question as it is read.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("30 second time limit");
  });

  it("says once that time is short, and nothing each second", async () => {
    await showTimed([timed(switching, 30), routing]);
    press("Start assessment");

    const said = new Set<string>();
    for (let second = 0; second < 29; second++) {
      elapse(1_000);
      said.add(announced() ?? "");
    }

    expect([...said].filter(Boolean)).toEqual(["10 seconds left on question 1."]);
  });

  it("says when a question ran out, and which", async () => {
    await showTimed([timed(switching, 10), routing]);
    press("Start assessment");

    elapse(10_000);

    expect(announced()).toBe("Time's up. Question 1 was not answered.");
  });

  it("does not warn about a question that is only ten seconds long to begin with", async () => {
    await showTimed([timed(switching, 10), routing]);
    press("Start assessment");

    elapse(5_000);
    expect(announced()).toBe("");
  });
});
