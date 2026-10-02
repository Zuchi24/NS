import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_ASSESSMENT_DRAFT,
  ACCEPTED_ANSWER_MAX,
  ACCEPTED_ANSWER_MIN,
  EMPTY_QUESTION_DRAFT,
  QUESTION_CHOICE_MAX,
  QUESTION_CHOICE_MIN,
  createAssessment,
  createQuestion,
  deleteAssessment,
  deleteQuestion,
  draftOfAssessment,
  draftOfQuestion,
  fetchAssessment,
  archiveAssessment,
  createAssessmentVersion,
  detailsEditable,
  fetchArchivedAssessments,
  fetchAssessmentResults,
  fetchAssessmentVersions,
  fetchTopicAssessments,
  lockStateOf,
  restoreAssessment,
  versionLabel,
  publishAssessment,
  reorderQuestions,
  unpublishAssessment,
  updateAssessment,
  updateQuestion,
  validateAssessmentDraft,
  foldAnswer,
  validateQuestionDraft,
  QUESTION_TIMER_PRESETS,
} from "./adminAssessmentService";
import type {
  Assessment,
  AssessmentDraft,
  AssessmentResult,
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
    type: "multiple_choice",
    acceptedAnswers: [""],
    prompt: "Which layer routes packets?",
    points: "2",
    timeLimitSeconds: null,
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
      version: 1,
      title: "Before you start",
      description: null,
      isPublished: true,
      archivedAt: null,
      createdAt: null,
      updatedAt: null,
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
      version: 1,
      title: "Before you start",
      description: "Answer what you can.",
      isPublished: false,
      archivedAt: null,
      createdAt: null,
      updatedAt: null,
      attemptsCount: 0,
      questionsCount: null,
      questions: [
        {
          id: 21,
          type: "multiple_choice",
          acceptedAnswers: [],
          prompt: "Which layer routes packets?",
          points: 2,
          timeLimitSeconds: null,
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

describe("reading results", () => {
  const apiResult = () => ({
    id: 500,
    student: { id: 7, student_id: "2024-00123", full_name: "Juan Dela Cruz" },
    earned_points: 8,
    total_points: 10,
    percent: 80,
    submitted_at: "2026-09-17T08:30:00.000000Z",
  });

  it("asks the admin results route for one assessment", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    await fetchAssessmentResults(11);

    expect(api.get).toHaveBeenCalledWith("/admin/assessments/11/results");
  });

  it("maps a result to who took it, what they scored and when", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiResult()] });

    const [result] = await fetchAssessmentResults(11);

    expect(result).toEqual<AssessmentResult>({
      id: 500,
      student: { id: 7, studentId: "2024-00123", fullName: "Juan Dela Cruz" },
      earnedPoints: 8,
      totalPoints: 10,
      percent: 80,
      submittedAt: "2026-09-17T08:30:00.000000Z",
    });
  });

  it("keeps the percentage the server rounded, whichever way it sent it", async () => {
    vi.mocked(api.get).mockResolvedValue({
      // Two thirds, and as a string: the API sends a decimal, and a driver may
      // hand it over quoted. Recomputing it here is how an instructor and a
      // student end up reading different scores.
      data: [{ ...apiResult(), earned_points: 2, total_points: 3, percent: "66.67" }],
    });

    const [result] = await fetchAssessmentResults(11);

    expect(result.percent).toBe(66.67);
  });

  it("reads an assessment nobody has taken as an empty list", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    // An answer, not a failure: nothing here turns it into one.
    await expect(fetchAssessmentResults(11)).resolves.toEqual([]);
  });

  it("carries a student with no school id of their own", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ ...apiResult(), student: { id: 7, student_id: null, full_name: "Juan Dela Cruz" } }],
    });

    const [result] = await fetchAssessmentResults(11);

    expect(result.student.studentId).toBeNull();
    expect(result.student.fullName).toBe("Juan Dela Cruz");
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
    // Always sent: null is "no timer", and on an edit it is what clears one.
    time_limit_seconds: null,
    choices: [
      { label: "Network", is_correct: true },
      { label: "Transport", is_correct: false },
      { label: "Session", is_correct: false },
      { label: "Physical", is_correct: false },
    ],
  };

  it("creates on the assessment with its type, prompt, points and all four choices", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    await createQuestion(11, questionDraft());

    // The type goes on a create, where it is chosen.
    expect(api.post).toHaveBeenCalledWith(
      "/admin/assessments/11/questions",
      { type: "multiple_choice", ...expectedPayload },
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
      type: "multiple_choice",
      acceptedAnswers: [],
      prompt: "Which layer routes packets?",
      points: 2,
      timeLimitSeconds: null,
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

  it("starts a new question with one blank choice, not correct, for the author to add to", () => {
    expect(EMPTY_QUESTION_DRAFT.prompt).toBe("");
    expect(EMPTY_QUESTION_DRAFT.points).toBe("1");
    expect(EMPTY_QUESTION_DRAFT.choices).toEqual([{ label: "", isCorrect: false }]);
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

  /** `count` labelled choices, the first one correct. */
  const choicesOf = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      label: `Choice ${index}`,
      isCorrect: index === 0,
    }));

  it("refuses fewer than two choices or more than six", () => {
    for (const count of [0, 1, 7]) {
      expect(
        validateQuestionDraft(questionDraft({ choices: choicesOf(count) })).choices,
      ).toBe("A question has between 2 and 6 choices.");
    }
    expect(QUESTION_CHOICE_MIN).toBe(2);
    expect(QUESTION_CHOICE_MAX).toBe(6);
  });

  it("accepts anywhere from two to six choices", () => {
    for (const count of [2, 3, 4, 5, 6]) {
      expect(validateQuestionDraft(questionDraft({ choices: choicesOf(count) }))).toEqual({});
    }
  });

  it("accepts a true/false question, and still needs exactly one of the two correct", () => {
    const trueFalse = (trueCorrect: boolean, falseCorrect: boolean) =>
      questionDraft({
        choices: [
          { label: "True", isCorrect: trueCorrect },
          { label: "False", isCorrect: falseCorrect },
        ],
      });

    expect(validateQuestionDraft(trueFalse(false, true))).toEqual({});
    expect(validateQuestionDraft(trueFalse(true, true)).choices).toBe(
      "Mark exactly one choice as correct.",
    );
    expect(validateQuestionDraft(trueFalse(false, false)).choices).toBe(
      "Mark exactly one choice as correct.",
    );
  });

  it("needs exactly one correct choice whatever the count", () => {
    for (const count of [2, 6]) {
      const none = choicesOf(count).map((choice) => ({ ...choice, isCorrect: false }));
      const two = choicesOf(count).map((choice, index) => ({ ...choice, isCorrect: index < 2 }));

      expect(validateQuestionDraft(questionDraft({ choices: none })).choices).toBe(
        "Mark exactly one choice as correct.",
      );
      expect(validateQuestionDraft(questionDraft({ choices: two })).choices).toBe(
        "Mark exactly one choice as correct.",
      );
    }
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

    // One row is not yet a question: the count is what is wrong with the choices.
    expect(Object.keys(found).sort()).toEqual(["choices", "points", "prompt"]);
    expect(found.choices).toBe("A question has between 2 and 6 choices.");
  });
});

describe("the question timer", () => {
  it("reads a question's time limit, and no limit as null", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion({ time_limit_seconds: 30 }) });
    expect((await createQuestion(11, questionDraft())).timeLimitSeconds).toBe(30);

    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion({ time_limit_seconds: null }) });
    expect((await createQuestion(11, questionDraft())).timeLimitSeconds).toBeNull();

    // A response from before the field existed reads as no timer, not undefined.
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });
    expect((await createQuestion(11, questionDraft())).timeLimitSeconds).toBeNull();
  });

  it("sends the timer as whole seconds, and no timer as null", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiQuestion() });

    await updateQuestion(21, questionDraft({ timeLimitSeconds: 45 }));
    await updateQuestion(21, questionDraft({ timeLimitSeconds: null }));

    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ time_limit_seconds: 45 });
    expect(vi.mocked(api.put).mock.calls[1][1]).toMatchObject({ time_limit_seconds: null });
  });

  it("carries a stored question's timer into its draft", () => {
    const question: AssessmentQuestion = {
      id: 21,
      type: "multiple_choice",
      prompt: "Q?",
      points: 1,
      timeLimitSeconds: 90,
      order: 0,
      choices: [],
      acceptedAnswers: [],
    };

    expect(draftOfQuestion(question).timeLimitSeconds).toBe(90);
  });

  it("offers the same presets the server accepts", () => {
    expect([...QUESTION_TIMER_PRESETS]).toEqual([10, 15, 20, 30, 45, 60, 90, 120]);
  });

  it("accepts no timer and every preset, and refuses anything else", () => {
    expect(validateQuestionDraft(questionDraft({ timeLimitSeconds: null })).time_limit_seconds).toBeUndefined();

    for (const seconds of QUESTION_TIMER_PRESETS) {
      expect(validateQuestionDraft(questionDraft({ timeLimitSeconds: seconds })).time_limit_seconds).toBeUndefined();
    }

    for (const seconds of [0, -10, 7, 25, 121]) {
      expect(validateQuestionDraft(questionDraft({ timeLimitSeconds: seconds })).time_limit_seconds).toBe(
        "Choose one of the timer settings, or no timer.",
      );
    }
  });
});

describe("versions", () => {
  it("leaves archived versions out of the topic listing unless asked for", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    await fetchTopicAssessments(4);
    await fetchTopicAssessments(4, { includeArchived: true });

    expect(api.get).toHaveBeenNthCalledWith(1, "/admin/topics/4/assessments");
    expect(api.get).toHaveBeenNthCalledWith(2, "/admin/topics/4/assessments?include_archived=1");
  });

  it("maps a version's number, archive date and timestamps", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        apiListed({
          version: 3,
          archived_at: "2026-09-20T10:00:00.000000Z",
          created_at: "2026-09-01T10:00:00.000000Z",
          updated_at: "2026-09-02T10:00:00.000000Z",
        }),
      ],
    });

    const [version] = await fetchAssessmentVersions(11);

    expect(api.get).toHaveBeenCalledWith("/admin/assessments/11/versions");
    expect(version).toMatchObject({
      version: 3,
      archivedAt: "2026-09-20T10:00:00.000000Z",
      createdAt: "2026-09-01T10:00:00.000000Z",
      updatedAt: "2026-09-02T10:00:00.000000Z",
    });
  });

  it("creates a new version from an existing one, sending nothing else", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAssessment({ id: 18, version: 2 }) });

    const created = await createAssessmentVersion(11);

    expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/versions");
    expect(created).toMatchObject({ id: 18, version: 2, isPublished: false });
  });

  it("archives and restores through their own routes", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: apiAssessment({ archived_at: "2026-09-20T10:00:00Z" }) })
      .mockResolvedValueOnce({ data: apiAssessment({ archived_at: null }) });

    expect((await archiveAssessment(11)).archivedAt).toBe("2026-09-20T10:00:00Z");
    expect((await restoreAssessment(11)).archivedAt).toBeNull();

    expect(api.post).toHaveBeenNthCalledWith(1, "/admin/assessments/11/archive");
    expect(api.post).toHaveBeenNthCalledWith(2, "/admin/assessments/11/restore");
  });

  it("passes a conflict through as the server's refusal", async () => {
    const { ApiError } = await import("@/services/api");
    vi.mocked(api.post).mockRejectedValue(
      new ApiError("Version 1 of \"Before you start\" is the one students are taking, so it cannot be archived.", 409),
    );

    await expect(archiveAssessment(11)).rejects.toMatchObject({ status: 409 });
  });

  it("reads an archived, untaken version as archived, and a taken one as taken", () => {
    expect(lockStateOf({ isPublished: false, attemptsCount: 0, archivedAt: "2026-09-20" })).toBe(
      "archived",
    );
    expect(lockStateOf({ isPublished: false, attemptsCount: 2, archivedAt: "2026-09-20" })).toBe(
      "taken",
    );
  });

  it("settles title and description once taken or archived, not when only published", () => {
    expect(detailsEditable({ attemptsCount: 0, archivedAt: null })).toBe(true);
    expect(detailsEditable({ attemptsCount: 1, archivedAt: null })).toBe(false);
    expect(detailsEditable({ attemptsCount: 0, archivedAt: "2026-09-20" })).toBe(false);
  });

  it("names a version by its number", () => {
    expect(versionLabel({ version: 2 })).toBe("V2");
  });
});

describe("the archive", () => {
  function apiArchived(over: Record<string, unknown> = {}) {
    return {
      id: 13,
      type: "pre_test",
      version: 2,
      title: "Before you start",
      archived_at: "2026-09-20T10:00:00.000000Z",
      created_at: "2026-09-01T10:00:00.000000Z",
      updated_at: "2026-09-20T10:00:00.000000Z",
      attempts_count: 0,
      questions_count: 4,
      topic: { id: 16, title: "Routing" },
      roadmap: { id: 4, title: "Networking Essentials" },
      purge: { eligible: false, eligible_at: "2026-10-20T10:00:00.000000Z" },
      ...over,
    };
  }

  function page(data: unknown[], meta: Record<string, number> = {}) {
    return { data, meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length, ...meta } };
  }

  it("asks for one type, sending only the filters given", async () => {
    vi.mocked(api.get).mockResolvedValue(page([]));

    await fetchArchivedAssessments({ type: "post_test" });

    expect(api.get).toHaveBeenCalledWith("/admin/archive/assessments?type=post_test");
  });

  it("sends topic, taken and paging as the API names them", async () => {
    vi.mocked(api.get).mockResolvedValue(page([]));

    await fetchArchivedAssessments({ type: "pre_test", topicId: 16, taken: false, page: 2, perPage: 10 });
    await fetchArchivedAssessments({ type: "pre_test", taken: true });

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/admin/archive/assessments?type=pre_test&topic_id=16&taken=false&page=2&per_page=10",
    );
    expect(api.get).toHaveBeenNthCalledWith(2, "/admin/archive/assessments?type=pre_test&taken=true");
  });

  it("maps a row to the exact version it is, and the page it is on", async () => {
    vi.mocked(api.get).mockResolvedValue(
      page([apiArchived()], { current_page: 2, last_page: 3, per_page: 1, total: 3 }),
    );

    expect(await fetchArchivedAssessments({ type: "pre_test", page: 2, perPage: 1 })).toEqual({
      items: [
        {
          id: 13,
          type: "pre_test",
          version: 2,
          title: "Before you start",
          archivedAt: "2026-09-20T10:00:00.000000Z",
          createdAt: "2026-09-01T10:00:00.000000Z",
          updatedAt: "2026-09-20T10:00:00.000000Z",
          attemptsCount: 0,
          questionsCount: 4,
          topic: { id: 16, title: "Routing" },
          roadmap: { id: 4, title: "Networking Essentials" },
          purge: { eligible: false, eligibleAt: "2026-10-20T10:00:00.000000Z" },
        },
      ],
      page: 2,
      lastPage: 3,
      perPage: 1,
      total: 3,
    });
  });

  it("reads a taken version as kept for good", async () => {
    vi.mocked(api.get).mockResolvedValue(
      page([apiArchived({ attempts_count: 3, purge: { eligible: false, eligible_at: null } })]),
    );

    const [row] = (await fetchArchivedAssessments({ type: "pre_test" })).items;

    expect(row.attemptsCount).toBe(3);
    expect(row.purge).toEqual({ eligible: false, eligibleAt: null });
  });

  it("deletes only what is still archived when asked to", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteAssessment(13, { expected: "archived" });
    await deleteAssessment(14);

    expect(api.delete).toHaveBeenNthCalledWith(1, "/admin/assessments/13?expected=archived");
    // Every existing caller: the delete it always was.
    expect(api.delete).toHaveBeenNthCalledWith(2, "/admin/assessments/14");
  });

  it("passes the server's refusal through when the version was restored meanwhile", async () => {
    const { ApiError } = await import("@/services/api");
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError('Version 2 of "Before you start" is no longer archived, so it was not deleted.', 409),
    );

    await expect(deleteAssessment(13, { expected: "archived" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("a fill-in-the-blank question", () => {
  const fillInBlank = (acceptedAnswers: string[]): AssessmentQuestionDraft => ({
    ...questionDraft(),
    type: "fill_in_blank",
    choices: [],
    acceptedAnswers,
  });

  it("starts every new question with one empty accepted-answer row, ready if it is chosen", () => {
    expect(EMPTY_QUESTION_DRAFT.type).toBe("multiple_choice");
    expect(EMPTY_QUESTION_DRAFT.acceptedAnswers).toEqual([""]);
  });

  it("accepts one to ten accepted answers, and refuses none or eleven", () => {
    for (let count = ACCEPTED_ANSWER_MIN; count <= ACCEPTED_ANSWER_MAX; count++) {
      const answers = Array.from({ length: count }, (_, index) => `Answer ${index}`);
      expect(validateQuestionDraft(fillInBlank(answers))).toEqual({});
    }

    for (const count of [0, 11]) {
      const answers = Array.from({ length: count }, (_, index) => `Answer ${index}`);
      expect(validateQuestionDraft(fillInBlank(answers)).accepted_answers).toBe(
        "A question has between 1 and 10 accepted answers.",
      );
    }
  });

  it("refuses an accepted answer that folds to nothing, under that answer", () => {
    for (const blank of ["", "   ", "-_", " - "]) {
      const found = validateQuestionDraft(fillInBlank(["Router", blank]));

      expect(found["accepted_answers.1"]).toMatch(/letters or numbers/);
      expect(found["accepted_answers.0"]).toBeUndefined();
    }
  });

  it("allows an accepted answer of 255 characters and refuses 256", () => {
    expect(validateQuestionDraft(fillInBlank(["a".repeat(255)]))).toEqual({});
    expect(validateQuestionDraft(fillInBlank(["a".repeat(256)]))["accepted_answers.0"]).toMatch(
      /255 characters or fewer/,
    );
  });

  it("does not ask for choices, or a correct one", () => {
    expect(validateQuestionDraft(fillInBlank(["Router"])).choices).toBeUndefined();
  });

  it("folds an answer the way the server compares it", () => {
    expect(foldAnswer("  Default-Gateway_ ")).toBe("default gateway");
    expect(foldAnswer("ＲＯＵＴＥＲ")).toBe("router");
    expect(foldAnswer("Router.")).toBe("router.");
    expect(foldAnswer("-_ ")).toBe("");
    expect(foldAnswer("s")).toBe("s");
    expect(foldAnswer("router   gateway")).toBe("router gateway");
  });

  it("creates with its type and accepted answers, and no choices", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: apiQuestion({ type: "fill_in_blank", choices: [], accepted_answers: ["Router", "gateway"] }),
    });

    const created = await createQuestion(11, fillInBlank([" Router ", "gateway"]));

    expect(api.post).toHaveBeenCalledWith("/admin/assessments/11/questions", {
      type: "fill_in_blank",
      prompt: "Which layer routes packets?",
      points: 2,
      time_limit_seconds: null,
      accepted_answers: ["Router", "gateway"],
    });
    expect(created.type).toBe("fill_in_blank");
    expect(created.acceptedAnswers).toEqual(["Router", "gateway"]);
  });

  it("edits with the accepted answers and never a type", async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: apiQuestion({ type: "fill_in_blank", choices: [], accepted_answers: ["switch"] }),
    });

    await updateQuestion(21, fillInBlank(["switch"]));

    const [, payload] = vi.mocked(api.put).mock.calls[0];
    expect(payload).toEqual({
      prompt: "Which layer routes packets?",
      points: 2,
      time_limit_seconds: null,
      accepted_answers: ["switch"],
    });
    expect(payload).not.toHaveProperty("type");
    expect(payload).not.toHaveProperty("choices");
  });

  it("reads a stored question's type and accepted answers into its draft", () => {
    const draft = draftOfQuestion({
      id: 21,
      type: "fill_in_blank",
      prompt: "Which device forwards packets?",
      points: 2,
      timeLimitSeconds: null,
      order: 0,
      choices: [],
      acceptedAnswers: ["Router", "gateway"],
    });

    expect(draft.type).toBe("fill_in_blank");
    expect(draft.acceptedAnswers).toEqual(["Router", "gateway"]);
  });

  it("reads a question from before fill in the blank as multiple choice", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiQuestion() });

    const created = await createQuestion(11, questionDraft());

    expect(created.type).toBe("multiple_choice");
    expect(created.acceptedAnswers).toEqual([]);
  });
});
