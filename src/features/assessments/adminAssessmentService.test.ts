import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_ASSESSMENT_DRAFT,
  EMPTY_QUESTION_DRAFT,
  createAssessment,
  createQuestion,
  deleteAssessment,
  deleteQuestion,
  draftOfAssessment,
  draftOfQuestion,
  fetchAssessment,
  fetchTopicAssessments,
  lockStateOf,
  publishAssessment,
  reorderQuestions,
  unpublishAssessment,
  updateAssessment,
  updateQuestion,
  validateAssessmentDraft,
  validateQuestionDraft,
} from "./adminAssessmentService";
import type {
  Assessment,
  AssessmentDraft,
  AssessmentQuestion,
  AssessmentQuestionDraft,
} from "./adminAssessmentService";

/**
 * The author's half of the assessment API.
 *
 * The transport is stubbed, so these say what the service asks for and what it
 * makes of the answer. The payloads carry weight: an edit never sends the type,
 * nothing ever sends a publish flag or an order, and points leave as a number
 * rather than the text that was typed.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const { api } = await import("@/services/api");

function apiChoice(over: Record<string, unknown> = {}) {
  return { id: 31, label: "Network", order: 1, is_correct: true, ...over };
}

function apiQuestion(over: Record<string, unknown> = {}) {
  return {
    id: 21,
    prompt: "Which layer routes packets?",
    points: 2,
    order: 1,
    choices: [
      apiChoice(),
      apiChoice({ id: 32, label: "Transport", order: 2, is_correct: false }),
      apiChoice({ id: 33, label: "Session", order: 3, is_correct: false }),
      apiChoice({ id: 34, label: "Physical", order: 4, is_correct: false }),
    ],
    ...over,
  };
}

/** What show() and every write return: questions loaded, attempts counted. */
function apiAssessment(over: Record<string, unknown> = {}) {
  return {
    id: 11,
    topic_id: 4,
    type: "pre_test",
    title: "Before you start",
    description: "Answer what you can.",
    is_published: false,
    attempts_count: 0,
    questions: [apiQuestion()],
    ...over,
  };
}

/** What the listing returns: both counts, no questions. */
function apiListed(over: Record<string, unknown> = {}) {
  return {
    id: 11,
    topic_id: 4,
    type: "pre_test",
    title: "Before you start",
    description: null,
    is_published: true,
    attempts_count: 3,
    questions_count: 5,
    ...over,
  };
}

function assessmentDraft(over: Partial<AssessmentDraft> = {}): AssessmentDraft {
  return {
    type: "post_test",
    title: "Check your understanding",
    description: "Ten questions.",
    ...over,
  };
}

function questionDraft(
  over: Partial<AssessmentQuestionDraft> = {},
): AssessmentQuestionDraft {
  return {
    prompt: "Which layer routes packets?",
    points: "2",
    choices: [
      { label: "Network", isCorrect: true },
      { label: "Transport", isCorrect: false },
      { label: "Session", isCorrect: false },
      { label: "Physical", isCorrect: false },
    ],
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("reading assessments", () => {
  it("lists a topic's assessments from the admin route", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiListed()] });

    await fetchTopicAssessments(4);

    expect(api.get).toHaveBeenCalledWith("/admin/topics/4/assessments");
  });

  it("maps a listed assessment, keeping both counts and no questions", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiListed()] });

    const [listed] = await fetchTopicAssessments(4);

    expect(listed).toEqual<Assessment>({
      id: 11,
      topicId: 4,
      type: "pre_test",
      title: "Before you start",
      description: null,
      isPublished: true,
      attemptsCount: 3,
      questionsCount: 5,
      // Not loaded — which is not the same as having none.
      questions: null,
    });
  });

  it("fetches one assessment by id", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiAssessment() });

    await fetchAssessment(11);

    expect(api.get).toHaveBeenCalledWith("/admin/assessments/11");
  });

  it("maps an assessment with its questions, choices and answer key", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiAssessment() });

    const assessment = await fetchAssessment(11);

    expect(assessment).toEqual<Assessment>({
      id: 11,
      topicId: 4,
      type: "pre_test",
      title: "Before you start",
      description: "Answer what you can.",
      isPublished: false,
      attemptsCount: 0,
      questionsCount: null,
      questions: [
        {
          id: 21,
          prompt: "Which layer routes packets?",
          points: 2,
          order: 1,
          choices: [
            { id: 31, label: "Network", order: 1, isCorrect: true },
            { id: 32, label: "Transport", order: 2, isCorrect: false },
            { id: 33, label: "Session", order: 3, isCorrect: false },
            { id: 34, label: "Physical", order: 4, isCorrect: false },
          ],
        },
      ],
    });
  });

  it("leaves uncounted counts as null rather than claiming zero", async () => {
    const row = apiAssessment();
    delete (row as Partial<typeof row>).attempts_count;
    vi.mocked(api.get).mockResolvedValue({ data: row });

    const assessment = await fetchAssessment(11);

    expect(assessment.attemptsCount).toBeNull();
    expect(assessment.questionsCount).toBeNull();
  });

  it("keeps a zero count as zero", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [apiListed({ attempts_count: 0, questions_count: 0 })],
    });

    const [listed] = await fetchTopicAssessments(4);

    expect(listed.attemptsCount).toBe(0);
    expect(listed.questionsCount).toBe(0);
  });

  it("reads a choice with no answer key as not correct", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: apiAssessment({
        questions: [apiQuestion({ choices: [{ id: 1, label: "A", order: 1 }] })],
      }),
    });

    const assessment = await fetchAssessment(11);

    expect(assessment.questions?.[0].choices[0].isCorrect).toBe(false);
  });

  it("gives a question with no loaded choices an empty list", async () => {
    const question = apiQuestion();
    delete (question as Partial<typeof question>).choices;
    vi.mocked(api.get).mockResolvedValue({
      data: apiAssessment({ questions: [question] }),
    });

    const assessment = await fetchAssessment(11);

    expect(assessment.questions?.[0].choices).toEqual([]);
  });
});

describe("writing an assessment", () => {
  it("creates on the topic with type, title and description, and no publish flag", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment() });

    await createAssessment(4, assessmentDraft());

    expect(api.post).toHaveBeenCalledWith("/admin/topics/4/assessments", {
      type: "post_test",
      title: "Check your understanding",
      description: "Ten questions.",
    });

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).not.toHaveProperty("is_published");
    expect(payload).not.toHaveProperty("topic_id");
  });

  it("returns the created assessment mapped", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment({ id: 12 }) });

    expect((await createAssessment(4, assessmentDraft())).id).toBe(12);
  });

  it("sends an empty description as null", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment() });

    await createAssessment(4, assessmentDraft({ description: "   " }));

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).toMatchObject({ description: null });
  });

  it("trims what it sends", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment() });

    await createAssessment(
      4,
      assessmentDraft({ title: "  Spaced  ", description: " Read. " }),
    );

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).toMatchObject({ title: "Spaced", description: "Read." });
  });

  it("updates title and description with PUT, and never the type", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiAssessment() });

    await updateAssessment(11, assessmentDraft());

    // The server refuses the type outright on an edit, rather than ignoring it.
    expect(api.put).toHaveBeenCalledWith("/admin/assessments/11", {
      title: "Check your understanding",
      description: "Ten questions.",
    });
  });

  it("clears the description on an edit with null", async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: apiAssessment({ description: null }),
    });

    const updated = await updateAssessment(
      11,
      assessmentDraft({ description: "" }),
    );

    expect(api.put).toHaveBeenCalledWith("/admin/assessments/11", {
      title: "Check your understanding",
      description: null,
    });
    expect(updated.description).toBeNull();
  });

  it("publishes on its own route with no body", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: apiAssessment({ is_published: true }),
    });

    const published = await publishAssessment(11);

    expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/publish");
    expect(vi.mocked(api.post).mock.calls[0]).toHaveLength(1);
    expect(published.isPublished).toBe(true);
  });

  it("unpublishes on its own route with no body", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment() });

    const unpublished = await unpublishAssessment(11);

    expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/unpublish");
    expect(vi.mocked(api.post).mock.calls[0]).toHaveLength(1);
    expect(unpublished.isPublished).toBe(false);
  });

  it("deletes by id", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await expect(deleteAssessment(11)).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledWith("/admin/assessments/11");
  });
});

describe("writing questions", () => {
  const expectedPayload = {
    prompt: "Which layer routes packets?",
    points: 2,
    choices: [
      { label: "Network", is_correct: true },
      { label: "Transport", is_correct: false },
      { label: "Session", is_correct: false },
      { label: "Physical", is_correct: false },
    ],
  };

  it("creates on the assessment with prompt, points and all four choices", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    await createQuestion(11, questionDraft());

    expect(api.post).toHaveBeenCalledWith(
      "/admin/assessments/11/questions",
      expectedPayload,
    );

    // A new question is appended; where it goes is not the client's to say.
    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect(payload).not.toHaveProperty("order");
    expect(payload).not.toHaveProperty("assessment_id");
  });

  it("returns the created question mapped", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    const question = await createQuestion(11, questionDraft());

    expect(question).toEqual<AssessmentQuestion>({
      id: 21,
      prompt: "Which layer routes packets?",
      points: 2,
      order: 1,
      choices: [
        { id: 31, label: "Network", order: 1, isCorrect: true },
        { id: 32, label: "Transport", order: 2, isCorrect: false },
        { id: 33, label: "Session", order: 3, isCorrect: false },
        { id: 34, label: "Physical", order: 4, isCorrect: false },
      ],
    });
  });

  it("sends points as a number rather than the text that was typed", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    await createQuestion(11, questionDraft({ points: " 7 " }));

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect((payload as { points: unknown }).points).toBe(7);
  });

  it("maps which choice is correct onto is_correct, slot for slot", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    await createQuestion(
      11,
      questionDraft({
        choices: [
          { label: " A ", isCorrect: false },
          { label: "B", isCorrect: false },
          { label: "C", isCorrect: true },
          { label: "D", isCorrect: false },
        ],
      }),
    );

    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect((payload as { choices: unknown }).choices).toEqual([
      { label: "A", is_correct: false },
      { label: "B", is_correct: false },
      { label: "C", is_correct: true },
      { label: "D", is_correct: false },
    ]);
  });

  it("updates a question with PUT and the whole draft", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiQuestion({ points: 5 }) });

    const question = await updateQuestion(21, questionDraft());

    expect(api.put).toHaveBeenCalledWith("/admin/questions/21", expectedPayload);
    expect(question.points).toBe(5);
  });

  it("deletes a question by id", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await expect(deleteQuestion(21)).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledWith("/admin/questions/21");
  });

  it("reorders with the complete list of ids and maps what comes back", async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: [apiQuestion({ id: 22, order: 1 }), apiQuestion({ id: 21, order: 2 })],
    });

    const questions = await reorderQuestions(11, [22, 21]);

    expect(api.put).toHaveBeenCalledWith(
      "/admin/assessments/11/questions/order",
      { question_ids: [22, 21] },
    );
    expect(questions.map((q) => [q.id, q.order])).toEqual([
      [22, 1],
      [21, 2],
    ]);
    expect(questions[0].choices).toHaveLength(4);
  });
});

describe("lockStateOf", () => {
  it("is editable while unpublished and untaken", () => {
    expect(lockStateOf({ isPublished: false, attemptsCount: 0 })).toBe(
      "editable",
    );
  });

  it("is published while published and untaken", () => {
    expect(lockStateOf({ isPublished: true, attemptsCount: 0 })).toBe(
      "published",
    );
  });

  it("is taken once attempted, even unpublished", () => {
    expect(lockStateOf({ isPublished: false, attemptsCount: 2 })).toBe("taken");
  });

  it("is both when published and attempted", () => {
    expect(lockStateOf({ isPublished: true, attemptsCount: 1 })).toBe(
      "published_and_taken",
    );
  });

  it("reads an uncounted attempt total as untaken", () => {
    expect(lockStateOf({ isPublished: false, attemptsCount: null })).toBe(
      "editable",
    );
    expect(lockStateOf({ isPublished: true, attemptsCount: null })).toBe(
      "published",
    );
  });
});

describe("drafts", () => {
  it("starts a new assessment blank", () => {
    expect(EMPTY_ASSESSMENT_DRAFT).toEqual({
      type: "pre_test",
      title: "",
      description: "",
    });
  });

  it("starts a new question with four blank choices, none correct", () => {
    expect(EMPTY_QUESTION_DRAFT.prompt).toBe("");
    expect(EMPTY_QUESTION_DRAFT.points).toBe("1");
    expect(EMPTY_QUESTION_DRAFT.choices).toEqual([
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
    ]);
    // Four separate objects, so editing one slot cannot edit the others.
    expect(new Set(EMPTY_QUESTION_DRAFT.choices).size).toBe(4);
  });

  it("fills the assessment form, turning a missing description into an empty box", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: apiAssessment({ description: null }),
    });

    expect(draftOfAssessment(await fetchAssessment(11))).toEqual({
      type: "pre_test",
      title: "Before you start",
      description: "",
    });
  });

  it("fills the question form, holding points as text", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    const question = await createQuestion(11, questionDraft());

    expect(draftOfQuestion(question)).toEqual(questionDraft());
  });
});

describe("validateAssessmentDraft", () => {
  it("accepts a complete draft, and one with no description", () => {
    expect(validateAssessmentDraft(assessmentDraft())).toEqual({});
    expect(
      validateAssessmentDraft(assessmentDraft({ description: "" })),
    ).toEqual({});
  });

  it("requires a title", () => {
    expect(
      validateAssessmentDraft(assessmentDraft({ title: "   " })).title,
    ).toBeDefined();
  });

  it("allows a title of 255 characters and refuses 256", () => {
    expect(
      validateAssessmentDraft(assessmentDraft({ title: "a".repeat(255) })).title,
    ).toBeUndefined();
    expect(
      validateAssessmentDraft(assessmentDraft({ title: "a".repeat(256) })).title,
    ).toBeDefined();
  });

  it("allows a description of 2000 characters and refuses 2001", () => {
    expect(
      validateAssessmentDraft(
        assessmentDraft({ description: "a".repeat(2000) }),
      ).description,
    ).toBeUndefined();
    expect(
      validateAssessmentDraft(
        assessmentDraft({ description: "a".repeat(2001) }),
      ).description,
    ).toBeDefined();
  });

  it("counts the description in code points, as the server does", () => {
    // 2000 emoji are 4000 UTF-16 units but 2000 characters to mb_strlen.
    expect(
      validateAssessmentDraft(
        assessmentDraft({ description: "🔌".repeat(2000) }),
      ).description,
    ).toBeUndefined();
    expect(
      validateAssessmentDraft(
        assessmentDraft({ description: "🔌".repeat(2001) }),
      ).description,
    ).toBeDefined();
  });

  it("does not count surrounding whitespace", () => {
    expect(
      validateAssessmentDraft(
        assessmentDraft({ description: `  ${"a".repeat(2000)}  ` }),
      ).description,
    ).toBeUndefined();
  });

  it("refuses a type that is neither test", () => {
    expect(
      validateAssessmentDraft(
        assessmentDraft({ type: "quiz" as AssessmentDraft["type"] }),
      ).type,
    ).toBeDefined();
  });
});

describe("validateQuestionDraft", () => {
  it("accepts a complete question", () => {
    expect(validateQuestionDraft(questionDraft())).toEqual({});
  });

  it("requires a prompt", () => {
    expect(
      validateQuestionDraft(questionDraft({ prompt: "  " })).prompt,
    ).toBeDefined();
  });

  it("allows a prompt of 2000 code points and refuses 2001", () => {
    expect(
      validateQuestionDraft(questionDraft({ prompt: "🔌".repeat(2000) })).prompt,
    ).toBeUndefined();
    expect(
      validateQuestionDraft(questionDraft({ prompt: "a".repeat(2001) })).prompt,
    ).toBeDefined();
  });

  it("refuses points the server would not take", () => {
    for (const points of ["", "0", "-1", "101", "2.5", "two", "1e2"]) {
      expect(
        validateQuestionDraft(questionDraft({ points })).points,
      ).toBeDefined();
    }
  });

  it("accepts whole points from 1 to 100", () => {
    for (const points of ["1", "50", "100", " 3 "]) {
      expect(
        validateQuestionDraft(questionDraft({ points })).points,
      ).toBeUndefined();
    }
  });

  it("refuses anything but exactly four choices", () => {
    const four = questionDraft().choices;

    expect(
      validateQuestionDraft(questionDraft({ choices: four.slice(0, 3) })).choices,
    ).toBeDefined();
    expect(
      validateQuestionDraft(
        questionDraft({ choices: [...four, { label: "E", isCorrect: false }] }),
      ).choices,
    ).toBeDefined();
  });

  it("requires every choice to have a label, keyed as the server keys it", () => {
    const choices = questionDraft().choices.map((choice, index) =>
      index === 2 ? { ...choice, label: " " } : choice,
    );

    const found = validateQuestionDraft(questionDraft({ choices }));

    expect(found["choices.2.label"]).toBeDefined();
    expect(found["choices.0.label"]).toBeUndefined();
  });

  it("allows a choice label of 255 characters and refuses 256", () => {
    const withLabel = (label: string) =>
      questionDraft({
        choices: questionDraft().choices.map((choice, index) =>
          index === 1 ? { ...choice, label } : choice,
        ),
      });

    expect(
      validateQuestionDraft(withLabel("a".repeat(255)))["choices.1.label"],
    ).toBeUndefined();
    expect(
      validateQuestionDraft(withLabel("a".repeat(256)))["choices.1.label"],
    ).toBeDefined();
  });

  it("requires exactly one correct choice", () => {
    const marking = (correct: number[]) =>
      questionDraft({
        choices: questionDraft().choices.map((choice, index) => ({
          ...choice,
          isCorrect: correct.includes(index),
        })),
      });

    expect(validateQuestionDraft(marking([])).choices).toBeDefined();
    expect(validateQuestionDraft(marking([0, 3])).choices).toBeDefined();
    expect(validateQuestionDraft(marking([3])).choices).toBeUndefined();
  });

  it("finds everything wrong with a blank question at once", () => {
    const found = validateQuestionDraft({ ...EMPTY_QUESTION_DRAFT, points: "" });

    expect(Object.keys(found).sort()).toEqual([
      "choices",
      "choices.0.label",
      "choices.1.label",
      "choices.2.label",
      "choices.3.label",
      "points",
      "prompt",
    ]);
  });
});
