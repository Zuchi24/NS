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
    publishAssessment: vi.fn(),
    unpublishAssessment: vi.fn(),
    deleteAssessment: vi.fn(),
    // The results panel below the questions reads on mount. Stubbed here so
    // these tests are about the builder rather than about what a class scored.
    fetchAssessmentResults: vi.fn(),
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
    type: "multiple_choice",
    acceptedAnswers: [],
    prompt: "Which layer routes packets?",
    points: 2,
    timeLimitSeconds: null,
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
    version: 1,
    title: "Before you start",
    description: "Answer what you can.",
    isPublished: false,
    archivedAt: null,
    createdAt: null,
    updatedAt: null,
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

/** The "is correct" radios of a form's choices — one per choice row, and not the type picker's. */
function choiceRadios(form: Form) {
  return form.getAllByRole("radio", { name: /^Choice [A-F] is correct$/ });
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

  // A new question starts with one row; add the rest the way an author would.
  while (choiceRadios(form).length < labels.length) {
    await user.click(form.getByRole("button", { name: "Add choice" }));
  }

  for (const [index, label] of labels.entries()) {
    await replace(user, form.getByLabelText(`Choice ${"ABCDEF"[index]}`), label);
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
  // Nobody has taken it unless a test says otherwise, so the results panel
  // settles on its empty state and adds no controls to the page.
  vi.mocked(service.fetchAssessmentResults).mockResolvedValue([]);
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

    // Nothing that touches a question is offered, and the release controls are
    // their own section. Title and description stay editable only while nobody
    // has taken it: a taken version is settled, details included.
    const release = screen.getByRole("region", { name: "Release" });

    expect(questionWriteButtons()).toEqual([]);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => !release.contains(button))
        .map((button) => button.textContent),
    ).toEqual(
      (lock.attemptsCount ?? 0) > 0
        ? ["Back to roadmap"]
        : ["Back to roadmap", "Edit details"],
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

describe("adding a question", () => {
  it("opens a blank form with one point and one empty choice, marked correct", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));

    const form = questionForm("Add question");

    expect(form.getByLabelText("Prompt")).toHaveValue("");
    expect(form.getByLabelText("Points")).toHaveValue("1");
    expect(form.getByLabelText("Choice A")).toHaveValue("");
    expect(choiceRadios(form)).toHaveLength(1);
    expect(form.getByRole("radio", { name: "Choice A is correct" })).toBeChecked();
    expect(form.getByText("2 to 6 choices. Select the one that is correct.")).toBeInTheDocument();
  });

  it("sends the prompt, numeric points and the choices with the one marked correct", async () => {
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
        type: "multiple_choice",
        prompt: "Which device joins two networks?",
        points: 5,
        time_limit_seconds: null,
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

describe("choosing how many choices a question has", () => {
  async function openNew() {
    const user = userEvent.setup();
    await show();
    await user.click(screen.getByRole("button", { name: "Add question" }));

    return { user, form: questionForm("Add question") };
  }

  it("adds choices up to six, lettered A to F, and no further", async () => {
    const { user, form } = await openNew();
    const add = form.getByRole("button", { name: "Add choice" });

    for (let rows = 1; rows < 6; rows++) {
      expect(add).toBeEnabled();
      await user.click(add);
    }

    expect(choiceRadios(form)).toHaveLength(6);
    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
      expect(form.getByLabelText(`Choice ${letter}`)).toBeInTheDocument();
    }
    expect(add).toBeDisabled();
  });

  it("removes a choice, but never the last one", async () => {
    const { user, form } = await openNew();

    expect(form.getByRole("button", { name: "Remove choice A" })).toBeDisabled();

    await user.click(form.getByRole("button", { name: "Add choice" }));
    await replace(user, form.getByLabelText("Choice A"), "Router");
    await replace(user, form.getByLabelText("Choice B"), "Switch");
    await user.click(form.getByRole("button", { name: "Remove choice A" }));

    expect(choiceRadios(form)).toHaveLength(1);
    expect(form.getByLabelText("Choice A")).toHaveValue("Switch");
    expect(form.getByRole("button", { name: "Remove choice A" })).toBeDisabled();
  });

  it("leaves no choice correct when the correct one is removed, and refuses to save until one is", async () => {
    const { user, form } = await openNew();
    await fill(user, form, { labels: ["Router", "Switch", "Hub"], correct: "B" });

    await user.click(form.getByRole("button", { name: "Remove choice B" }));

    expect(choiceRadios(form)).toHaveLength(2);
    for (const radio of choiceRadios(form)) {
      expect(radio).not.toBeChecked();
    }

    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByRole("group", { name: "Choices" })).toHaveAccessibleDescription(
      "Mark exactly one choice as correct.",
    );
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("refuses to save a question with only one choice", async () => {
    const { user, form } = await openNew();
    await fill(user, form, { labels: ["Router"] });

    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByRole("group", { name: "Choices" })).toHaveAccessibleDescription(
      "A question has between 2 and 6 choices.",
    );
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("fills in True and False, with True marked correct, and sends just those two", async () => {
    const { user, form } = await openNew();
    await fill(user, form, { labels: ["Router", "Switch", "Hub"] });

    await user.click(form.getByRole("button", { name: "True / False" }));

    expect(choiceRadios(form)).toHaveLength(2);
    expect(form.getByLabelText("Choice A")).toHaveValue("True");
    expect(form.getByLabelText("Choice B")).toHaveValue("False");
    expect(form.getByRole("radio", { name: "Choice A is correct" })).toBeChecked();
    expect(form.getByRole("radio", { name: "Choice B is correct" })).not.toBeChecked();

    // The other answer can be the right one instead.
    await user.click(form.getByRole("radio", { name: "Choice B is correct" }));

    vi.mocked(service.createQuestion).mockResolvedValue(question({ id: 23 }));
    await user.click(form.getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(service.createQuestion).toHaveBeenCalled());
    const [, draft] = vi.mocked(service.createQuestion).mock.calls[0];
    expect(draft.choices).toEqual([
      { label: "True", isCorrect: false },
      { label: "False", isCorrect: true },
    ]);
  });

  it("sends all six choices of a six-choice question", async () => {
    const { user, form } = await openNew();
    await fill(user, form, {
      labels: ["Physical", "Data link", "Network", "Transport", "Session", "Application"],
      correct: "F",
    });

    vi.mocked(service.createQuestion).mockResolvedValue(question({ id: 23 }));
    await user.click(form.getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(service.createQuestion).toHaveBeenCalled());
    const [, draft] = vi.mocked(service.createQuestion).mock.calls[0];
    expect(draft.choices).toHaveLength(6);
    expect(draft.choices.filter((choice) => choice.isCorrect)).toEqual([
      { label: "Application", isCorrect: true },
    ]);
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
        time_limit_seconds: null,
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
        choices: ["Mark exactly one choice as correct."],
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
      "Mark exactly one choice as correct.",
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
      "Mark exactly one choice as correct.",
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

    const confirm = screen.getByRole("alertdialog", { name: "Delete question 1?" });

    expect(confirm).toHaveTextContent(/Its choices go with it/);
    expect(confirm).not.toHaveTextContent(/four/);
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

  it("still lets the title and description be edited while only published", async () => {
    await show(assessment({ isPublished: true, attemptsCount: 0 }));

    expect(screen.getByRole("button", { name: "Edit details" })).toBeEnabled();
  });

  it.each([
    ["taken", { attemptsCount: 5 }],
    ["published and taken", { isPublished: true, attemptsCount: 5 }],
    ["archived", { archivedAt: "2026-09-20T10:00:00Z" }],
  ] as [string, Partial<Assessment>][])(
    "offers no edit of the title and description once %s",
    async (_, lock) => {
      await show(assessment(lock));

      expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    },
  );

  it("says an archived version is read-only until restored, and offers no publish", async () => {
    await show(assessment({ archivedAt: "2026-09-20T10:00:00Z" }));

    expect(screen.getByRole("note")).toHaveTextContent(/archived, so it is read-only/);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(questionWriteButtons()).toEqual([]);
    expect(
      release().queryByRole("button", { name: "Publish assessment" }),
    ).not.toBeInTheDocument();
  });

  it("names the version it is building", async () => {
    await show(assessment({ version: 3 }));

    expect(screen.getByText("V3")).toBeInTheDocument();
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

  it.each([
    ["pre-test", "/admin/archive/tests/pre-test"],
    ["post-test", "/admin/archive/tests/post-test"],
  ])("returns to the %s archive it was opened from", async (slug, destination) => {
    const user = userEvent.setup();
    search = `from=archive&type=${slug}`;
    await show();

    await user.click(screen.getByRole("button", { name: "Back to archive" }));

    expect(navigate).toHaveBeenCalledWith(destination);
    expect(screen.queryByRole("button", { name: "Back to roadmap" })).not.toBeInTheDocument();
  });

  it("returns to the roadmap when the archive context names no archive", async () => {
    const user = userEvent.setup();
    search = "from=archive&type=quiz";
    await show();

    await user.click(screen.getByRole("button", { name: "Back to roadmap" }));

    expect(navigate).toHaveBeenCalledWith("/admin/roadmap");
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

/** The release section, so a query cannot stray into the question controls. */
function release() {
  return within(screen.getByRole("region", { name: "Release" }));
}

/** Renders a page whose first load is `before` and every reload after is `after`. */
async function showThen(before: Assessment, after: Assessment) {
  vi.mocked(service.fetchAssessment)
    .mockResolvedValueOnce(before)
    .mockResolvedValue(after);

  render(<AssessmentBuilderPage />);

  await screen.findByRole("region", { name: "Release" });
}

/*
 * The four states an assessment can be in, and what each one offers — both on
 * the assessment itself and on its questions. Unpublishing a taken assessment
 * is the row that matters most: it withdraws the test and unlocks nothing.
 */
const STATES = [
  {
    state: "a draft nobody has taken",
    lock: { isPublished: false, attemptsCount: 0 },
    publish: true,
    unpublish: false,
    remove: true,
    questions: true,
  },
  {
    state: "published and untaken",
    lock: { isPublished: true, attemptsCount: 0 },
    publish: false,
    unpublish: true,
    remove: true,
    questions: false,
  },
  {
    state: "published and taken",
    lock: { isPublished: true, attemptsCount: 3 },
    publish: false,
    unpublish: true,
    remove: false,
    questions: false,
  },
  {
    state: "unpublished after being taken",
    lock: { isPublished: false, attemptsCount: 3 },
    publish: true,
    unpublish: false,
    remove: false,
    questions: false,
  },
];

describe("release controls in each state", () => {
  it.each(STATES)(
    "offers the right controls when it is $state",
    async ({ lock, publish, unpublish, remove, questions }) => {
      await show(assessment({ ...lock, questions: [question(), second] }));

      expect(
        release().queryByRole("button", { name: "Publish assessment" }) !== null,
      ).toBe(publish);
      expect(
        release().queryByRole("button", { name: "Unpublish assessment" }) !== null,
      ).toBe(unpublish);
      expect(release().queryByRole("button", { name: "Delete" }) !== null).toBe(
        remove,
      );
      expect(
        release().queryByText(/cannot be deleted because students have attempted it/) !==
          null,
      ).toBe(!remove);

      // And the questions follow the lock, not the publication alone.
      expect(questionWriteButtons().length > 0).toBe(questions);
    },
  );
});

describe("publishing", () => {
  it("is offered on a draft nobody has taken", async () => {
    await show();

    expect(
      release().getByRole("button", { name: "Publish assessment" }),
    ).toBeEnabled();
  });

  it("publishes through the service", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.publishAssessment).mockResolvedValue(
      assessment({ isPublished: true }),
    );

    await user.click(release().getByRole("button", { name: "Publish assessment" }));

    expect(service.publishAssessment).toHaveBeenCalledWith(11);
  });

  it("sends one publish however often it is pressed", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.publishAssessment).mockReturnValue(new Promise(() => {}));

    await user.click(release().getByRole("button", { name: "Publish assessment" }));

    const pending = release().getByRole("button", { name: "Publishing…" });
    expect(pending).toBeDisabled();
    expect(release().getByRole("button", { name: "Delete" })).toBeDisabled();

    await user.click(pending);

    expect(service.publishAssessment).toHaveBeenCalledTimes(1);
  });

  it("says so, reloads, and shows the published assessment with its questions locked", async () => {
    const user = userEvent.setup();

    await showThen(assessment(), assessment({ isPublished: true }));

    vi.mocked(service.publishAssessment).mockResolvedValue(
      assessment({ isPublished: true }),
    );

    expect(questionWriteButtons().length).toBeGreaterThan(0);

    await user.click(release().getByRole("button", { name: "Publish assessment" }));

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith(
      "“Before you start” V1 is published. Students can open it.",
    );

    // What the server stored, not what the click assumed.
    expect(
      await release().findByRole("button", { name: "Unpublish assessment" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(questionWriteButtons()).toEqual([]);
  });

  it("shows why the server refused, and leaves the page as it was", async () => {
    const user = userEvent.setup();
    const refusal =
      'Question 1 of "Before you start" needs exactly one correct choice before it can be published.';

    await show();

    vi.mocked(service.publishAssessment).mockRejectedValue(
      new ApiError(refusal, 422),
    );

    // Work in progress elsewhere on the page must survive the refusal.
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await replace(
      user,
      questionForm("Add question").getByLabelText("Prompt"),
      "Half-written question",
    );

    await user.click(release().getByRole("button", { name: "Publish assessment" }));

    expect(await release().findByRole("alert")).toHaveTextContent(refusal);

    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(
      release().getByRole("button", { name: "Publish assessment" }),
    ).toBeEnabled();
    expect(questionForm("Add question").getByLabelText("Prompt")).toHaveValue(
      "Half-written question",
    );
  });

  it("reloads into the current state on a conflict, keeping the reason on screen", async () => {
    const user = userEvent.setup();
    const refusal = "This assessment changed while you were looking at it.";

    await showThen(assessment(), assessment({ isPublished: true, attemptsCount: 2 }));

    vi.mocked(service.publishAssessment).mockRejectedValue(new ApiError(refusal, 409));

    await user.click(release().getByRole("button", { name: "Publish assessment" }));

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));

    expect(
      await release().findByRole("button", { name: "Unpublish assessment" }),
    ).toBeInTheDocument();
    expect(release().getByRole("alert")).toHaveTextContent(refusal);
    expect(questionWriteButtons()).toEqual([]);
  });
});

describe("unpublishing", () => {
  it("is offered on a published assessment", async () => {
    await show(assessment({ isPublished: true }));

    expect(
      release().getByRole("button", { name: "Unpublish assessment" }),
    ).toBeEnabled();
    expect(
      release().queryByRole("button", { name: "Publish assessment" }),
    ).not.toBeInTheDocument();
  });

  it("asks first, and sends nothing when cancelled", async () => {
    const user = userEvent.setup();
    await show(assessment({ isPublished: true }));

    await user.click(release().getByRole("button", { name: "Unpublish assessment" }));

    const dialog = within(
      screen.getByRole("alertdialog", { name: "Unpublish “Before you start”?" }),
    );
    await user.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(service.unpublishAssessment).not.toHaveBeenCalled();
  });

  it("unpublishes through the service once confirmed", async () => {
    const user = userEvent.setup();
    await show(assessment({ isPublished: true }));

    vi.mocked(service.unpublishAssessment).mockResolvedValue(assessment());

    await user.click(release().getByRole("button", { name: "Unpublish assessment" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Unpublish" }),
    );

    await waitFor(() =>
      expect(service.unpublishAssessment).toHaveBeenCalledWith(11),
    );
  });

  it("says so, reloads, and unlocks the questions of an untaken assessment", async () => {
    const user = userEvent.setup();

    await showThen(assessment({ isPublished: true }), assessment());

    vi.mocked(service.unpublishAssessment).mockResolvedValue(assessment());

    expect(questionWriteButtons()).toEqual([]);

    await user.click(release().getByRole("button", { name: "Unpublish assessment" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Unpublish" }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith(
      "“Before you start” is unpublished. Students can no longer open it.",
    );

    expect(
      await release().findByRole("button", { name: "Publish assessment" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add question" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit question 1" })).toBeEnabled();
  });

  it("shows why the server refused, without reloading", async () => {
    const user = userEvent.setup();
    await show(assessment({ isPublished: true }));

    vi.mocked(service.unpublishAssessment).mockRejectedValue(
      new ApiError("The server had a problem with that.", 500),
    );

    await user.click(release().getByRole("button", { name: "Unpublish assessment" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Unpublish" }),
    );

    expect(await release().findByRole("alert")).toHaveTextContent(
      "The server had a problem with that.",
    );
    expect(service.fetchAssessment).toHaveBeenCalledTimes(1);
    expect(
      release().getByRole("button", { name: "Unpublish assessment" }),
    ).toBeEnabled();
  });

  it("leaves a taken assessment's questions locked once it is withdrawn", async () => {
    const user = userEvent.setup();

    await showThen(
      assessment({ isPublished: true, attemptsCount: 3 }),
      assessment({ isPublished: false, attemptsCount: 3 }),
    );

    vi.mocked(service.unpublishAssessment).mockResolvedValue(
      assessment({ isPublished: false, attemptsCount: 3 }),
    );

    await user.click(release().getByRole("button", { name: "Unpublish assessment" }));

    // Said before it is done, not discovered afterwards.
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /questions stay locked because it has been taken/,
    );

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Unpublish" }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));

    expect(
      await release().findByRole("button", { name: "Publish assessment" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/already taken/);
    expect(questionWriteButtons()).toEqual([]);
    expect(release().queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});

describe("deleting the assessment", () => {
  it("is offered while nobody has taken it", async () => {
    await show();

    expect(release().getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("asks first, saying it comes off the topic", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(release().getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("alertdialog", { name: "Delete “Before you start”?" }),
    ).toHaveTextContent(/removes the pre-test from its topic/);
    expect(service.deleteAssessment).not.toHaveBeenCalled();
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(release().getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(service.deleteAssessment).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("deletes once confirmed and returns to the roadmap and topic it came from", async () => {
    const user = userEvent.setup();
    search = "roadmap=3&topic=7";
    await show();

    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    await user.click(release().getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete assessment",
      }),
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/admin/roadmap?roadmap=3&topic=7"),
    );
    expect(service.deleteAssessment).toHaveBeenCalledWith(11);
    expect(toast.success).toHaveBeenCalledWith("Deleted “Before you start”.");
  });

  it("stays and reloads when the server says it has been taken meanwhile", async () => {
    const user = userEvent.setup();
    const refusal =
      '"Before you start" has already been taken, so it cannot be deleted. Unpublish it instead.';

    await showThen(assessment(), assessment({ attemptsCount: 1 }));

    vi.mocked(service.deleteAssessment).mockRejectedValue(new ApiError(refusal, 409));

    await user.click(release().getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete assessment",
      }),
    );

    await waitFor(() => expect(service.fetchAssessment).toHaveBeenCalledTimes(2));

    expect(await release().findByRole("alert")).toHaveTextContent(refusal);
    expect(release().queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(
      release().getByText(/cannot be deleted because students have attempted it/),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("is not offered once anyone has taken it, published or not", async () => {
    for (const lock of [
      { isPublished: true, attemptsCount: 1 },
      { isPublished: false, attemptsCount: 1 },
    ]) {
      await show(assessment(lock));

      expect(release().queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

      cleanup();
    }
  });
});

describe("deleting an archived version opened from the archive", () => {
  const archivedAt = "2026-09-20T10:00:00Z";
  const conflict =
    "This assessment was changed by another administrator. The Archive list has been refreshed.";

  async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
    await user.click(release().getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete assessment" }),
    );
  }

  it("deletes only if it is still archived, and returns to that archive", async () => {
    const user = userEvent.setup();
    search = "from=archive&type=post-test";
    await show(assessment({ type: "post_test", archivedAt }));
    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    await confirmDelete(user);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin/archive/tests/post-test"));
    expect(service.deleteAssessment).toHaveBeenCalledWith(11, { expected: "archived" });
    expect(toast.success).toHaveBeenCalledWith("Deleted “Before you start”.");
  });

  it("deletes the same archived version from the roadmap exactly as before", async () => {
    const user = userEvent.setup();
    search = "roadmap=3&topic=7";
    await show(assessment({ archivedAt }));
    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    await confirmDelete(user);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin/roadmap?roadmap=3&topic=7"));
    expect(vi.mocked(service.deleteAssessment).mock.calls).toEqual([[11]]);
  });

  it("adds no precondition for a version that is not archived, wherever it was opened", async () => {
    const user = userEvent.setup();
    search = "from=archive&type=pre-test";
    await show(assessment({ archivedAt: null }));
    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    await confirmDelete(user);

    await waitFor(() => expect(service.deleteAssessment).toHaveBeenCalled());
    expect(vi.mocked(service.deleteAssessment).mock.calls).toEqual([[11]]);
  });

  it.each([
    ["restored since (409)", 409, 'Version 1 of "Before you start" is no longer archived, so it was not deleted.'],
    ["deleted since (404)", 404, "Not found."],
  ])("says it changed and returns to the archive when it was %s, without retrying", async (_, status, message) => {
    const user = userEvent.setup();
    search = "from=archive&type=pre-test";
    await show(assessment({ archivedAt }));
    vi.mocked(service.deleteAssessment).mockRejectedValue(new ApiError(message, status));

    await confirmDelete(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(conflict));
    expect(navigate).toHaveBeenCalledWith("/admin/archive/tests/pre-test");
    expect(service.deleteAssessment).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("the question timer", () => {
  it("offers no timer and each preset, and starts a new question on no timer", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    const timer = questionForm("Add question").getByLabelText("Timer");

    expect(timer).toHaveDisplayValue("No timer");
    expect(
      within(timer).getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "No timer",
      "10 seconds",
      "15 seconds",
      "20 seconds",
      "30 seconds",
      "45 seconds",
      "60 seconds",
      "90 seconds",
      "120 seconds",
    ]);
  });

  it("sends a chosen timer as whole seconds when adding a question", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.createQuestion).mockImplementation(realService.createQuestion);
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 23, prompt: "Which device joins two networks?", points: 5, time_limit_seconds: 30, order: 2, choices: [] },
    });

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await fill(user, questionForm("Add question"), { points: "5", correct: "C" });
    await user.selectOptions(questionForm("Add question").getByLabelText("Timer"), "30 seconds");
    await user.click(questionForm("Add question").getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).toMatchObject({ time_limit_seconds: 30 });
  });

  it("opens a timed question on its timer, and clearing it sends null", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question({ timeLimitSeconds: 30 })] }));

    vi.mocked(service.updateQuestion).mockImplementation(realService.updateQuestion);
    vi.mocked(api.put).mockResolvedValue({ data: { ...question(), choices: [] } });

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");

    expect(form.getByLabelText("Timer")).toHaveDisplayValue("30 seconds");

    await user.selectOptions(form.getByLabelText("Timer"), "No timer");
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, payload] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe("/admin/questions/21");
    expect(payload).toMatchObject({ time_limit_seconds: null });
  });

  it("changes one timer for another", async () => {
    const user = userEvent.setup();
    await show(assessment({ questions: [question({ timeLimitSeconds: 30 })] }));

    vi.mocked(service.updateQuestion).mockImplementation(realService.updateQuestion);
    vi.mocked(api.put).mockResolvedValue({ data: { ...question(), choices: [] } });

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");
    await user.selectOptions(form.getByLabelText("Timer"), "45 seconds");
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ time_limit_seconds: 45 });
  });

  it("marks a timed question's card with its timer, and an untimed one with nothing", async () => {
    await show(
      assessment({
        questions: [
          question({ id: 21, timeLimitSeconds: 30 }),
          question({ id: 22, order: 2, timeLimitSeconds: null }),
        ],
      }),
    );

    expect(screen.getByTestId("question-21-timer")).toHaveTextContent("30 s timer");
    expect(screen.queryByTestId("question-22-timer")).toBeNull();
    expect(within(screen.getByTestId("question-22")).queryByText(/timer/)).toBeNull();
  });

  it("puts the server's timer message under the Timer field", async () => {
    const user = userEvent.setup();
    await show();

    vi.mocked(service.updateQuestion).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        time_limit_seconds: ["Choose one of the timer settings, or no timer."],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() =>
      expect(form.getByLabelText("Timer")).toHaveAccessibleDescription(
        "Choose one of the timer settings, or no timer.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("a fill-in-the-blank question", () => {
  async function openNewFillInBlank() {
    const user = userEvent.setup();
    await show();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");
    await user.click(form.getByRole("radio", { name: "Fill in the blank" }));

    return { user, form };
  }

  it("is chosen on a new question, which starts as multiple choice", async () => {
    const user = userEvent.setup();
    await show();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    const form = questionForm("Add question");

    expect(form.getByRole("radio", { name: "Multiple choice" })).toBeChecked();
    expect(form.getByRole("radio", { name: "Fill in the blank" })).toBeEnabled();

    await user.click(form.getByRole("radio", { name: "Fill in the blank" }));

    expect(form.getByRole("group", { name: "Accepted answers" })).toBeInTheDocument();
    expect(form.queryByRole("group", { name: "Choices" })).not.toBeInTheDocument();
    expect(form.getByLabelText("Answer 1")).toHaveValue("");
  });

  it("keeps an existing question's type fixed", async () => {
    const user = userEvent.setup();
    await show();
    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");

    expect(form.getByRole("radio", { name: "Multiple choice" })).toBeChecked();
    expect(form.getByRole("radio", { name: "Multiple choice" })).toBeDisabled();
    expect(form.getByRole("radio", { name: "Fill in the blank" })).toBeDisabled();
    expect(form.getByText(/type cannot be changed/)).toBeInTheDocument();
  });

  it("adds accepted answers up to ten, removes them, and never goes below one", async () => {
    const { user, form } = await openNewFillInBlank();
    const add = form.getByRole("button", { name: "Add answer" });

    expect(form.getByRole("button", { name: "Remove answer 1" })).toBeDisabled();

    for (let rows = 1; rows < 10; rows++) await user.click(add);

    expect(form.getByLabelText("Answer 10")).toBeInTheDocument();
    expect(add).toBeDisabled();

    await replace(user, form.getByLabelText("Answer 2"), "gateway");
    await user.click(form.getByRole("button", { name: "Remove answer 1" }));

    expect(form.queryByLabelText("Answer 10")).not.toBeInTheDocument();
    expect(form.getByLabelText("Answer 1")).toHaveValue("gateway");
    expect(add).toBeEnabled();
  });

  it("caps an accepted answer at 255 characters", async () => {
    const { form } = await openNewFillInBlank();

    expect(form.getByLabelText("Answer 1")).toHaveAttribute("maxLength", "255");
  });

  it("refuses a blank accepted answer without asking the server", async () => {
    const { user, form } = await openNewFillInBlank();
    await replace(user, form.getByLabelText("Prompt"), "Which device forwards packets?");
    await user.click(form.getByRole("button", { name: "Add answer" }));
    await replace(user, form.getByLabelText("Answer 1"), "Router");
    await replace(user, form.getByLabelText("Answer 2"), "-_");

    await user.click(form.getByRole("button", { name: "Add question" }));

    expect(form.getByLabelText("Answer 2")).toHaveAccessibleDescription(/letters or numbers/);
    expect(form.getByLabelText("Answer 1")).not.toHaveAccessibleDescription();
    expect(service.createQuestion).not.toHaveBeenCalled();
  });

  it("sends the type and accepted answers, and no choices", async () => {
    const { user, form } = await openNewFillInBlank();

    vi.mocked(service.createQuestion).mockImplementation(realService.createQuestion);
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 23, type: "fill_in_blank", prompt: "Q", points: 2, order: 2, choices: [], accepted_answers: [] },
    });

    await replace(user, form.getByLabelText("Prompt"), "Which device forwards packets?");
    await replace(user, form.getByLabelText("Points"), "2");
    await replace(user, form.getByLabelText("Answer 1"), "Router");
    await user.click(form.getByRole("button", { name: "Add answer" }));
    await replace(user, form.getByLabelText("Answer 2"), "default gateway");
    await user.click(form.getByRole("button", { name: "Add question" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/questions", {
        type: "fill_in_blank",
        prompt: "Which device forwards packets?",
        points: 2,
        time_limit_seconds: null,
        accepted_answers: ["Router", "default gateway"],
      }),
    );
  });

  it("puts the server's refusal of an accepted answer under that answer", async () => {
    const { user, form } = await openNewFillInBlank();

    vi.mocked(service.createQuestion).mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        "accepted_answers.0": ["Keep each accepted answer to 255 characters or fewer."],
      }),
    );

    await replace(user, form.getByLabelText("Prompt"), "Which device forwards packets?");
    await replace(user, form.getByLabelText("Answer 1"), "Router");
    await user.click(form.getByRole("button", { name: "Add question" }));

    await waitFor(() =>
      expect(form.getByLabelText("Answer 1")).toHaveAccessibleDescription(/255 characters or fewer/),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows staff a stored question's accepted answers", async () => {
    await show(
      assessment({
        questions: [
          question({ type: "fill_in_blank", choices: [], acceptedAnswers: ["Router", "default gateway"] }),
        ],
      }),
    );

    const answers = screen.getByRole("list", { name: "Accepted answers for question 1" });
    expect(within(answers).getByText("Router")).toBeInTheDocument();
    expect(within(answers).getByText("default gateway")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Choices for question 1" })).not.toBeInTheDocument();
  });

  it("edits a stored question's accepted answers, as a fill-in-the-blank question still", async () => {
    const user = userEvent.setup();
    await show(
      assessment({
        questions: [question({ type: "fill_in_blank", choices: [], acceptedAnswers: ["router"] })],
      }),
    );
    vi.mocked(service.updateQuestion).mockResolvedValue(question());

    await user.click(screen.getByRole("button", { name: "Edit question 1" }));
    const form = questionForm("Edit question 1");

    expect(form.getByRole("radio", { name: "Fill in the blank" })).toBeChecked();
    expect(form.getByLabelText("Answer 1")).toHaveValue("router");

    await replace(user, form.getByLabelText("Answer 1"), "switch");
    await user.click(form.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(service.updateQuestion).toHaveBeenCalled());
    const [, draft] = vi.mocked(service.updateQuestion).mock.calls[0];
    expect(draft.type).toBe("fill_in_blank");
    expect(draft.acceptedAnswers).toEqual(["switch"]);
  });
});
