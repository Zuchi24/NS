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
 * The assessment builder: the assessment's details, its questions, and
 * writing those questions while nothing has locked them.
 *
 * The service is stubbed, so these say what the page asks for and what it does
 * with the answer. A few carry the most weight. The answer key has to be
 * visible in words, not only in colour. A locked assessment — published, taken,
 * or both — offers no question write at all, and unpublishing a taken one does
 * not change that. And when the server refuses a write because the lock moved
 * under the page, the page says why and reloads into the lock as it now is.
 *
 * The payload tests run the real createQuestion and updateQuestion against a
 * stubbed transport, so they pin what actually goes on the wire — a number for
 * points, four choices, the one marked correct — rather than the draft the page
 * happens to hand the service.
 */

const navigate = vi.fn();
let params: Record<string, string | undefined> = { assessmentId: "11" };
let search = "";

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  useSearchParams: () => [new URLSearchParams(search), vi.fn()],
}));

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchAssessment: vi.fn(),
    updateAssessment: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    reorderQuestions: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/adminAssessmentService");
const realService = await vi.importActual<
  typeof import("@/features/assessments/adminAssessmentService")
>("@/features/assessments/adminAssessmentService");
const { api } = await import("@/services/api");
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

/** The three ways an assessment's questions can be locked. */
const LOCKED: [string, Partial<Assessment>][] = [
  ["published", { isPublished: true, attemptsCount: 0 }],
  ["taken, and unpublished", { isPublished: false, attemptsCount: 2 }],
  ["published and taken", { isPublished: true, attemptsCount: 5 }],
];

/** Renders the page and waits for its first load to land. */
async function show(value: Assessment = assessment()) {
  vi.mocked(service.fetchAssessment).mockResolvedValue(value);

  render(<AssessmentBuilderPage />);

  await screen.findByText(value.title);
}

function detailsForm() {
  return within(screen.getByRole("form", { name: "Edit assessment details" }));
}

function questionForm(name: string) {
  return within(screen.getByRole("form", { name }));
}

type Form = ReturnType<typeof questionForm>;
type User = ReturnType<typeof userEvent.setup>;

/** Replaces what is in a box, however long, without typing it key by key. */
async function replace(user: User, field: HTMLElement, value: string) {
  await user.clear(field);
  if (value !== "") {
    await user.click(field);
    await user.paste(value);
  }
}

/** Fills a whole question form. */
async function fill(
  user: User,
  form: Form,
  {
    prompt = "Which device joins two networks?",
    points = "3",
    labels = ["Router", "Switch", "Hub", "Repeater"],
    correct = "A",
  }: { prompt?: string; points?: string; labels?: string[]; correct?: string } = {},
) {
  await replace(user, form.getByLabelText("Prompt"), prompt);
  await replace(user, form.getByLabelText("Points"), points);

  for (const [index, label] of labels.entries()) {
    await replace(user, form.getByLabelText(`Choice ${"ABCD"[index]}`), label);
  }

  await user.click(form.getByRole("radio", { name: `Choice ${correct} is correct` }));
}

/** Every button on the page that writes a question. */
function questionWriteButtons() {
  return screen
    .queryAllByRole("button")
    .filter((button) =>
      /^(Add question|Edit question|Delete question|Move question)/.test(
        button.getAttribute("aria-label") ?? button.textContent ?? "",
      ),
    );
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
        questions: [question(), second],
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

describe("showing the questions", () => {
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

  it("invites the first question when an editable assessment has none", async () => {
    await show(assessment({ questions: [] }));

    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
    expect(screen.getByText("Add your first question.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add question" })).toBeEnabled();
    expect(screen.getByTestId("question-count")).toHaveTextContent("0");
  });

  it("explains, rather than offers, when a locked assessment has none", async () => {
    await show(assessment({ questions: [], isPublished: true }));

    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
    expect(screen.getByText(/questions cannot be added/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add question" }),
    ).not.toBeInTheDocument();
  });

  it("offers every question write on an editable assessment", async () => {
    await show(assessment({ questions: [question(), second] }));

    expect(screen.getByRole("button", { name: "Add question" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit question 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete question 2" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move question 1 down" })).toBeEnabled();
  });

  it.each(LOCKED)("offers no question write when it is %s", async (_, lock) => {
    await show(assessment({ ...lock, questions: [question(), second] }));

    // Title and description stay editable; nothing that touches a question does.
    expect(questionWriteButtons()).toEqual([]);
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Back to roadmap", "Edit details"]);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

describe("adding a question", () => {
  it("opens a blank form with one point, four empty choices and the first marked correct", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));

    const form = questionForm("Add question");

    expect(form.getByLabelText("Prompt")).toHaveValue("");
    expect(form.getByLabelText("Points")).toHaveValue("1");

    for (const letter of ["A", "B", "C", "D"]) {
      expect(form.getByLabelText(`Choice ${letter}`)).toHaveValue("");
    }

    expect(form.getAllByRole("radio")).toHaveLength(4);
    expect(form.getByRole("radio", { name: "Choice A is correct" })).toBeChecked();
    expect(form.getByRole("radio", { name: "Choice B is correct" })).not.toBeChecked();
  });

  it("sends the prompt, numeric points and exactly four choices with the one marked correct", async () => {
    const user = userEvent.setup();
    await show();

    // The real service over a stubbed transport, so this is the wire payload.
    vi.mocked(service.createQuestion).mockImplementation(realService.createQuestion);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 23,
        prompt: "Which device joins two networks?",
        points: 5,
        order: 2,
        choices: [],
      },
    });

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await fill(user, questionForm("Add question"), { points: "5", correct: "C" });
    await user.click(
      questionForm("Add question").getByRole("button", { name: "Add question" }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/questions", {
        prompt: "Which device joins two networks?",
        points: 5,
        choices: [
          { label: "Router", is_correct: false },
          { label: "Switch", is_correct: false },
          { label: "Hub", is_correct: true },
          { label: "Repeater", is_correct: false },
        ],
      }),
    );

    // Where it goes is the server's to say.
    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).not.toHaveProperty("order");
    expect(payload).not.toHaveProperty("assessment_id");
  });

  it("refuses an empty prompt without asking the server, keeping what was typed", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");

    await fill(user, form, { prompt: "   " });
    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByLabelText("Prompt")).toHaveAccessibleDescription(
      "Write the question.",
    );
    expect(form.getByLabelText("Choice A")).toHaveValue("Router");
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("refuses a prompt over 2000 characters", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");

    await fill(user, form, { prompt: "a".repeat(2001) });
    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByLabelText("Prompt")).toHaveAccessibleDescription(
      /2000 characters or fewer/,
    );
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("refuses points that are not a whole number from 1 to 100", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");
    await fill(user, form);

    for (const points of ["", "0", "101", "2.5", "two"]) {
      await replace(user, form.getByLabelText("Points"), points);
      await user.click(form.getByRole("button", { name: "Add question" }));

      expect(form.getByLabelText("Points")).toHaveAccessibleDescription(/.+/);
    }

    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("refuses a blank choice and one over 255 characters, under that choice", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");

    await fill(user, form, {
      labels: ["Router", "  ", "Hub", "a".repeat(256)],
    });
    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByLabelText("Choice B")).toHaveAccessibleDescription(
      "Every choice needs a label.",
    );
    expect(form.getByLabelText("Choice D")).toHaveAccessibleDescription(
      /255 characters or fewer/,
    );
    expect(form.getByLabelText("Choice A")).not.toHaveAccessibleDescription();
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("reloads the assessment once the question is stored", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.createQuestion).mockResolvedValue(question({ id: 23 }));

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await fill(user, questionForm("Add question"));
    await user.click(
      questionForm("Add question").getByRole("button", { name: "Add question" }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(service.createQuestion).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ prompt: "Which device joins two networks?" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Question added.");
  });

  it("shows a failed create and keeps the form as it was", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.createQuestion).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await fill(user, questionForm("Add question"));
    await user.click(
      questionForm("Add question").getByRole("button", { name: "Add question" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The server had a problem with that."),
    );
    expect(questionForm("Add question").getByLabelText("Prompt")).toHaveValue(
      "Which device joins two networks?",
    );
    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
  });

  it("sends one create however often save is pressed", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.createQuestion).mockReturnValue(new Promise(() => {}));

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");
    await fill(user, form);

    await user.click(form.getByRole("button", { name: "Add question" }));

    const saving = form.getByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();

    await user.click(saving);

    expect(service.createQuestion).toHaveBeenCalledTimes(1);
  });

  it("reloads into the lock when the assessment was published meanwhile", async () => {
    const user = userEvent.setup();

    vi.mocked(service.fetchAssessment)
      .mockResolvedValueOnce(assessment())
      .mockResolvedValue(assessment({ isPublished: true }));
    vi.mocked(service.createQuestion).mockRejectedValue(
      new ApiError(
        '"Before you start" is published, so its questions and choices cannot be changed. Unpublish it first.',
        422,
      ),
    );

    render(<AssessmentBuilderPage />);

    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await fill(user, questionForm("Add question"));
    await user.click(
      questionForm("Add question").getByRole("button", { name: "Add question" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(await screen.findByRole("note")).toHaveTextContent(/is published/);
    expect(questionWriteButtons()).toEqual([]);
  });
});

describe("editing a question", () => {
  it("opens with the question as it is stored", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));

    const form = questionForm("Edit question 1");

    expect(form.getByLabelText("Prompt")).toHaveValue("Which layer routes packets?");
    expect(form.getByLabelText("Points")).toHaveValue("2");
    expect(form.getByLabelText("Choice A")).toHaveValue("Network");
    expect(form.getByLabelText("Choice B")).toHaveValue("Transport");
    expect(form.getByLabelText("Choice C")).toHaveValue("Session");
    expect(form.getByLabelText("Choice D")).toHaveValue("Physical");
    expect(form.getByRole("radio", { name: "Choice A is correct" })).toBeChecked();
  });

  it("sends the whole question, with the new correct choice, to the question's own route", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateQuestion).mockImplementation(realService.updateQuestion);
    vi.mocked(api.put).mockResolvedValue({ data: { ...question(), choices: [] } });

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");

    await replace(user, form.getByLabelText("Prompt"), "Which OSI layer routes packets?");
    await replace(user, form.getByLabelText("Points"), "4");
    await user.click(form.getByRole("radio", { name: "Choice B is correct" }));
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/admin/questions/21", {
        prompt: "Which OSI layer routes packets?",
        points: 4,
        choices: [
          { label: "Network", is_correct: false },
          { label: "Transport", is_correct: true },
          { label: "Session", is_correct: false },
          { label: "Physical", is_correct: false },
        ],
      }),
    );
  });

  it("reloads the assessment once the edit is stored", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateQuestion).mockResolvedValue(question());

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    await user.click(
      questionForm("Edit question 1").getByRole("button", { name: "Save question" }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(service.updateQuestion).toHaveBeenCalledWith(21, expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith("Question 1 saved.");
  });

  it("puts the server's 422 messages under the fields they are about", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateQuestion).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        prompt: ["Keep the question to 2000 characters or fewer."],
        "choices.1.label": ["Every choice needs a label."],
        choices: ["Mark exactly one of the four choices as correct."],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() =>
      expect(form.getByLabelText("Prompt")).toHaveAccessibleDescription(
        "Keep the question to 2000 characters or fewer.",
      ),
    );
    expect(form.getByLabelText("Choice B")).toHaveAccessibleDescription(
      "Every choice needs a label.",
    );
    expect(form.getByRole("group", { name: "Choices" })).toHaveAccessibleDescription(
      "Mark exactly one of the four choices as correct.",
    );

    // Left open, nothing reloaded under it, and no second copy of the message.
    expect(toast.error).not.toHaveBeenCalled();
    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no choice", []],
    ["two choices", [0, 2]],
  ])("refuses a question with %s marked correct", async (_, correct) => {
    const user = userEvent.setup();

    // Only reachable from a stored question the radio group did not write.
    await show(
      assessment({
        questions: [
          question({
            choices: question().choices.map((stored, index) => ({
              ...stored,
              isCorrect: (correct as number[]).includes(index),
            })),
          }),
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");
    await user.click(form.getByRole("button", { name: "Save question" }));

    expect(form.getByRole("group", { name: "Choices" })).toHaveAccessibleDescription(
      "Mark exactly one of the four choices as correct.",
    );
    expect(service.updateQuestion).not.toHaveBeenCalled();
  });

  it("closes without saving on cancel", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    await user.click(
      questionForm("Edit question 1").getByRole("button", { name: "Cancel" }),
    );

    expect(
      screen.queryByRole("form", { name: "Edit question 1" }),
    ).not.toBeInTheDocument();
    expect(service.updateQuestion).not.toHaveBeenCalled();
  });

  it("holds every other question write while a form is open", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question(), second] }));

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));

    // A reload under the form would throw the author's typing away.
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit question 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete question 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move question 2 up" })).toBeDisabled();
  });

  it.each(LOCKED)("is not offered when the assessment is %s", async (_, lock) => {
    await show(assessment(lock));

    expect(
      screen.queryByRole("button", { name: "Edit question 1" }),
    ).not.toBeInTheDocument();
  });
});

describe("deleting a question", () => {
  it("asks before deleting", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));

    expect(
      screen.getByRole("alertdialog", { name: "Delete question 1?" }),
    ).toBeInTheDocument();
    expect(service.deleteQuestion).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(service.deleteQuestion).not.toHaveBeenCalled();
    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
  });

  it("deletes the question once confirmed, and reloads", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.deleteQuestion).mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(service.deleteQuestion).toHaveBeenCalledWith(21);
    expect(toast.success).toHaveBeenCalledWith("Question 1 deleted.");
  });

  it("reloads into the lock when the server says it has been taken", async () => {
    const user = userEvent.setup();
    const refusal =
      '"Before you start" has already been taken, so its questions and choices can no longer be changed.';

    vi.mocked(service.fetchAssessment)
      .mockResolvedValueOnce(assessment())
      .mockResolvedValue(assessment({ attemptsCount: 1 }));
    vi.mocked(service.deleteQuestion).mockRejectedValue(new ApiError(refusal, 409));

    render(<AssessmentBuilderPage />);

    await user.click(
      await screen.findByRole("button", { name: "Delete question 1" }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(refusal));
    expect(await screen.findByRole("note")).toHaveTextContent(/already taken/);

    // The page as the server now has it: the question still there, nothing
    // left on screen that would try to change it.
    expect(service.fetchAssessment).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("attempt-count")).toHaveTextContent("1");
    expect(screen.getByText("Which layer routes packets?")).toBeInTheDocument();
    expect(questionWriteButtons()).toEqual([]);
  });

  it.each(LOCKED)("is not offered when the assessment is %s", async (_, lock) => {
    await show(assessment(lock));

    expect(
      screen.queryByRole("button", { name: "Delete question 1" }),
    ).not.toBeInTheDocument();
  });
});

describe("reordering questions", () => {
  it("sends the whole new order when a question is moved down, and reloads", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question(), second] }));

    vi.mocked(service.reorderQuestions).mockResolvedValue([]);

    await user.click(screen.getByRole("button", { name: "Move question 1 down" }));

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(service.reorderQuestions).toHaveBeenCalledWith(11, [22, 21]);
  });

  it("sends the whole new order when a question is moved up", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question(), second] }));

    vi.mocked(service.reorderQuestions).mockResolvedValue([]);

    await user.click(screen.getByRole("button", { name: "Move question 2 up" }));

    await waitFor(() =>
      expect(service.reorderQuestions).toHaveBeenCalledWith(11, [22, 21]),
    );
  });

  it("cannot move the first question up or the last one down", async () => {
    await show(assessment({ questions: [question(), second] }));

    expect(screen.getByRole("button", { name: "Move question 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move question 2 down" })).toBeDisabled();
  });

  it("sends one reorder at a time", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question(), second] }));

    vi.mocked(service.reorderQuestions).mockReturnValue(new Promise(() => {}));

    await user.click(screen.getByRole("button", { name: "Move question 1 down" }));

    const back = screen.getByRole("button", { name: "Move question 2 up" });
    expect(back).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete question 1" })).toBeDisabled();

    await user.click(back);

    expect(service.reorderQuestions).toHaveBeenCalledTimes(1);
  });

  it("reloads when the server refuses the order because the page is stale", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question(), second] }));

    vi.mocked(service.reorderQuestions).mockRejectedValue(
      new ApiError("Send every question of this assessment, and only those.", 422),
    );

    await user.click(screen.getByRole("button", { name: "Move question 1 down" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Send every question of this assessment, and only those.",
      ),
    );
    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
  });

  it.each(LOCKED)("is not offered when the assessment is %s", async (_, lock) => {
    await show(assessment({ ...lock, questions: [question(), second] }));

    expect(
      screen.queryByRole("button", { name: /^Move question/ }),
    ).not.toBeInTheDocument();
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
