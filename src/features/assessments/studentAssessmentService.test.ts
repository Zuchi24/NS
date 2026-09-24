import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answersFor,
  fetchOwnAttempt,
  fetchOwnAttemptReview,
  fetchStudentAssessment,
  submitAssessment,
  unansweredQuestions,
} from "./studentAssessmentService";
import type {
  AssessmentResult,
  AssessmentReview,
  StudentAssessment,
  StudentAssessmentQuestion,
} from "./studentAssessmentService";

/**
 * The student's half of the assessment API.
 *
 * The transport is stubbed, so these say what is asked for and what is made of
 * the answer. The ones that carry weight: a response that did carry the answer
 * key, or staff-only fields, comes out without them; the submission is the
 * answers and nothing a score is made of; and no request ever names a student.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

const { api, ApiError } = await import("@/services/api");

function apiQuestion(over: Record<string, unknown> = {}) {
  return {
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
    ...over,
  };
}

function apiAttempt(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    assessment_id: 11,
    earned_points: 8,
    total_points: 10,
    percent: 80,
    submitted_at: "2026-09-15T10:00:00.000000Z",
    ...over,
  };
}

/**
 * A reviewed attempt: the 3-pointer answered wrongly, the 1-pointer rightly.
 *
 * Every number is its own — the points asked, the points awarded, the choice
 * picked and the choice that was right all differ — so a mapping that read the
 * wrong field could not land on a value that happens to match.
 */
function apiReview(over: Record<string, unknown> = {}) {
  return {
    ...apiAttempt({ earned_points: 1, total_points: 4, percent: 25 }),
    assessment: {
      id: 11,
      topic_id: 4,
      type: "pre_test",
      title: "Networking Fundamentals",
      description: "What you already know about cabling.",
    },
    questions: [
      {
        id: 21,
        prompt: "What does a switch primarily do?",
        points: 3,
        order: 1,
        choices: [
          { id: 31, label: "Assign public IP addresses", order: 1 },
          { id: 32, label: "Connect devices within a LAN", order: 2 },
          { id: 33, label: "Encrypt traffic", order: 3 },
        ],
        selected_choice_id: 33,
        correct_choice_id: 32,
        is_correct: false,
        points_awarded: 0,
      },
      {
        id: 22,
        prompt: "Which layer does a router work at?",
        points: 1,
        order: 2,
        choices: [
          { id: 41, label: "Network", order: 1 },
          { id: 42, label: "Physical", order: 2 },
        ],
        selected_choice_id: 41,
        correct_choice_id: 41,
        is_correct: true,
        points_awarded: 1,
      },
    ],
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("reading an assessment", () => {
  it("asks the student route, naming nobody", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 11,
        topic_id: 4,
        type: "pre_test",
        title: "Networking Fundamentals",
        description: null,
        questions: [],
      },
    });

    await fetchStudentAssessment(11);

    expect(api.get).toHaveBeenCalledWith("/assessments/11");
  });

  it("maps what a student is sent, and drops anything else the response carried", async () => {
    // As if the server had leaked the key and the staff-only fields. None of it
    // may come out the other side.
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 11,
        topic_id: 4,
        type: "post_test",
        title: "Networking Fundamentals",
        description: "Answer what you can.",
        is_published: true,
        attempts_count: 12,
        questions_count: 1,
        questions: [
          apiQuestion({
            points_awarded: 2,
            choices: [
              { id: 31, label: "Connect devices within a LAN", order: 1, is_correct: true },
              { id: 32, label: "Assign public IP addresses", order: 2, is_correct: false },
            ],
          }),
        ],
      },
    });

    expect(await fetchStudentAssessment(11)).toEqual<StudentAssessment>({
      id: 11,
      topicId: 4,
      type: "post_test",
      title: "Networking Fundamentals",
      description: "Answer what you can.",
      questions: [
        {
          id: 21,
          prompt: "What does a switch primarily do?",
          points: 2,
          timeLimitSeconds: null,
          order: 1,
          choices: [
            { id: 31, label: "Connect devices within a LAN", order: 1 },
            { id: 32, label: "Assign public IP addresses", order: 2 },
          ],
        },
      ],
    });
  });

  it("keeps the questions in the order the server sent them", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 11,
        topic_id: 4,
        type: "pre_test",
        title: "Networking Fundamentals",
        description: null,
        questions: [apiQuestion({ id: 22, order: 2 }), apiQuestion({ id: 21, order: 1 })],
      },
    });

    const { questions } = await fetchStudentAssessment(11);

    expect(questions.map((question) => question.id)).toEqual([22, 21]);
  });
});

describe("reading the student's own result", () => {
  it("asks for the signed-in student's attempt and maps it", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiAttempt() });

    expect(await fetchOwnAttempt(11)).toEqual<AssessmentResult>({
      id: 5,
      assessmentId: 11,
      earnedPoints: 8,
      totalPoints: 10,
      percent: 80,
      submittedAt: "2026-09-15T10:00:00.000000Z",
    });
    expect(api.get).toHaveBeenCalledWith("/assessments/11/attempt");
  });

  it("reads 'not taken yet' as no result rather than as a failure", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError("Not found.", 404));

    await expect(fetchOwnAttempt(11)).resolves.toBeNull();
  });

  it("passes any other refusal on", async () => {
    vi.mocked(api.get).mockRejectedValue(
      new ApiError("This topic has not been released yet.", 403),
    );

    await expect(fetchOwnAttempt(11)).rejects.toMatchObject({ status: 403 });
  });

  it("reads a percentage sent as text as a number", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiAttempt({ percent: "66.67" }) });

    expect((await fetchOwnAttempt(11))?.percent).toBe(66.67);
  });

  it("still reads the totals alone out of the fuller reply the route now sends", async () => {
    // The route answers with the whole review. This caller asked for the score,
    // so the score is all it gets: the questions and the key stay behind.
    vi.mocked(api.get).mockResolvedValue({ data: apiReview() });

    const result = await fetchOwnAttempt(11);

    expect(result).toEqual<AssessmentResult>({
      id: 5,
      assessmentId: 11,
      earnedPoints: 1,
      totalPoints: 4,
      percent: 25,
      submittedAt: "2026-09-15T10:00:00.000000Z",
    });
    expect(Object.keys(result ?? {})).not.toContain("questions");
  });
});

describe("reading the student's own review", () => {
  it("asks the same route, naming nobody, and maps the whole review", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiReview() });

    expect(await fetchOwnAttemptReview(11)).toEqual<AssessmentReview>({
      id: 5,
      assessmentId: 11,
      earnedPoints: 1,
      totalPoints: 4,
      percent: 25,
      submittedAt: "2026-09-15T10:00:00.000000Z",
      assessment: {
        id: 11,
        topicId: 4,
        type: "pre_test",
        title: "Networking Fundamentals",
        description: "What you already know about cabling.",
      },
      questions: [
        {
          id: 21,
          prompt: "What does a switch primarily do?",
          points: 3,
          order: 1,
          choices: [
            { id: 31, label: "Assign public IP addresses", order: 1 },
            { id: 32, label: "Connect devices within a LAN", order: 2 },
            { id: 33, label: "Encrypt traffic", order: 3 },
          ],
          selectedChoiceId: 33,
          correctChoiceId: 32,
          isCorrect: false,
          pointsAwarded: 0,
        },
        {
          id: 22,
          prompt: "Which layer does a router work at?",
          points: 1,
          order: 2,
          choices: [
            { id: 41, label: "Network", order: 1 },
            { id: 42, label: "Physical", order: 2 },
          ],
          selectedChoiceId: 41,
          correctChoiceId: 41,
          isCorrect: true,
          pointsAwarded: 1,
        },
      ],
    });
    expect(api.get).toHaveBeenCalledWith("/assessments/11/attempt");
  });

  it("keeps the choice picked apart from the choice that was right", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiReview() });

    const [wrong, right] = (await fetchOwnAttemptReview(11))!.questions;

    // A wrong answer: two different ids, and neither read from the other.
    expect(wrong.selectedChoiceId).toBe(33);
    expect(wrong.correctChoiceId).toBe(32);

    // A right one: the same id twice, which is what makes it right.
    expect(right.selectedChoiceId).toBe(41);
    expect(right.correctChoiceId).toBe(41);
  });

  it("keeps the correctness and the points the server awarded, rather than working them out", async () => {
    // The server has awarded 2 of the 3 points and called it wrong. Neither
    // number follows from the choices, so only a mapping that copies them can
    // produce them.
    vi.mocked(api.get).mockResolvedValue({
      data: apiReview({
        questions: [
          {
            id: 21,
            prompt: "What does a switch primarily do?",
            points: 3,
            order: 1,
            choices: [{ id: 31, label: "Connect devices within a LAN", order: 1 }],
            selected_choice_id: 31,
            correct_choice_id: 31,
            is_correct: false,
            points_awarded: 2,
          },
        ],
      }),
    });

    const [question] = (await fetchOwnAttemptReview(11))!.questions;

    expect(question.isCorrect).toBe(false);
    expect(question.pointsAwarded).toBe(2);
  });

  it("keeps a zero award and a false correctness as themselves, not as gaps", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiReview() });

    const [wrong] = (await fetchOwnAttemptReview(11))!.questions;

    expect(wrong.pointsAwarded).toBe(0);
    expect(wrong.isCorrect).toBe(false);
  });

  it("keeps the questions and their choices in the order the server sent them", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiReview() });

    const { questions } = (await fetchOwnAttemptReview(11))!;

    expect(questions.map((question) => question.id)).toEqual([21, 22]);
    expect(questions.map((question) => question.order)).toEqual([1, 2]);
    expect(questions.map((question) => question.points)).toEqual([3, 1]);
    expect(questions[0].choices.map((choice) => choice.id)).toEqual([31, 32, 33]);
    expect(questions[0].choices.map((choice) => choice.label)).toEqual([
      "Assign public IP addresses",
      "Connect devices within a LAN",
      "Encrypt traffic",
    ]);
    expect(questions[0].choices.map((choice) => choice.order)).toEqual([1, 2, 3]);
  });

  it("carries a question with no stored answer as a gap rather than as a zero", async () => {
    // Nothing a student can reach produces one, but a null must stay a null:
    // read as 0 it would claim the question was answered and scored nothing.
    vi.mocked(api.get).mockResolvedValue({
      data: apiReview({
        questions: [
          {
            id: 21,
            prompt: "What does a switch primarily do?",
            points: 3,
            order: 1,
            choices: [],
            selected_choice_id: null,
            correct_choice_id: null,
            is_correct: null,
            points_awarded: null,
          },
        ],
      }),
    });

    expect((await fetchOwnAttemptReview(11))!.questions[0]).toMatchObject({
      selectedChoiceId: null,
      correctChoiceId: null,
      isCorrect: null,
      pointsAwarded: null,
      choices: [],
    });
  });

  it("drops anything else the reply carried", async () => {
    // As if the server had named the student and flagged the choices. The
    // review says which choice was right on the question and nowhere else.
    vi.mocked(api.get).mockResolvedValue({
      data: apiReview({
        user_id: 7,
        student: { id: 7, full_name: "A Classmate" },
        assessment: {
          id: 11,
          topic_id: 4,
          type: "pre_test",
          title: "Networking Fundamentals",
          description: null,
          is_published: false,
          attempts_count: 12,
        },
        questions: [
          {
            id: 21,
            prompt: "What does a switch primarily do?",
            points: 3,
            order: 1,
            choices: [{ id: 31, label: "Connect devices within a LAN", order: 1, is_correct: true }],
            selected_choice_id: 31,
            correct_choice_id: 31,
            is_correct: true,
            points_awarded: 3,
          },
        ],
      }),
    });

    const review = (await fetchOwnAttemptReview(11))!;

    expect(review).not.toHaveProperty("user_id");
    expect(review).not.toHaveProperty("student");
    expect(Object.keys(review.assessment)).toEqual([
      "id",
      "topicId",
      "type",
      "title",
      "description",
    ]);
    expect(Object.keys(review.questions[0].choices[0])).toEqual(["id", "label", "order"]);
  });

  it("reads 'not taken yet' as no review rather than as a failure", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError("Not found.", 404));

    await expect(fetchOwnAttemptReview(11)).resolves.toBeNull();
  });

  it("passes any other refusal on", async () => {
    vi.mocked(api.get).mockRejectedValue(
      new ApiError("This topic has not been released yet.", 403),
    );

    await expect(fetchOwnAttemptReview(11)).rejects.toMatchObject({ status: 403 });
  });

  it("reads a percentage sent as text as a number", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiReview({ percent: "66.67" }) });

    expect((await fetchOwnAttemptReview(11))?.percent).toBe(66.67);
  });
});

describe("a question's timer", () => {
  it("reads each question's time limit, and no limit as null", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 11,
        topic_id: 4,
        type: "pre_test",
        title: "Networking Fundamentals",
        description: null,
        questions: [
          apiQuestion({ id: 21, time_limit_seconds: 30 }),
          apiQuestion({ id: 22, time_limit_seconds: null }),
          apiQuestion({ id: 23 }),
        ],
      },
    });

    const { questions } = await fetchStudentAssessment(11);

    expect(questions.map((q) => q.timeLimitSeconds)).toEqual([30, null, null]);
  });

  it("sends a timed-out question with a null choice, and nothing else about it", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAttempt() });

    await submitAssessment(11, [
      { questionId: 21, choiceId: 32 },
      { questionId: 22, choiceId: null },
    ]);

    expect(api.post).toHaveBeenCalledWith("/assessments/11/attempts", {
      answers: [
        { question_id: 21, choice_id: 32 },
        { question_id: 22, choice_id: null },
      ],
    });
  });
});

describe("submitting", () => {
  it("posts only the answers, each a question and a choice", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiAttempt() });

    await submitAssessment(11, [
      { questionId: 21, choiceId: 32 },
      { questionId: 22, choiceId: 41 },
    ]);

    expect(api.post).toHaveBeenCalledWith("/assessments/11/attempts", {
      answers: [
        { question_id: 21, choice_id: 32 },
        { question_id: 22, choice_id: 41 },
      ],
    });

    const [path, payload] = vi.mocked(api.post).mock.calls[0];
    const body = payload as { answers: Record<string, unknown>[] };

    // Nothing a score is made of, and nobody's id.
    expect(path).not.toContain("?");
    expect(Object.keys(body)).toEqual(["answers"]);
    for (const answer of body.answers) {
      expect(Object.keys(answer).sort()).toEqual(["choice_id", "question_id"]);
    }
  });

  it("hands back the server's score", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: apiAttempt({ earned_points: 3, total_points: 4, percent: 75 }),
    });

    const result = await submitAssessment(11, [{ questionId: 21, choiceId: 31 }]);

    expect(result).toMatchObject({ earnedPoints: 3, totalPoints: 4, percent: 75 });
  });

  it("passes a refusal on untouched", async () => {
    vi.mocked(api.post).mockRejectedValue(
      new ApiError("Already submitted.", 409),
    );

    await expect(
      submitAssessment(11, [{ questionId: 21, choiceId: 31 }]),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("working out the answers", () => {
  const question = (id: number): StudentAssessmentQuestion => ({
    id,
    prompt: `Question ${id}`,
    points: 1,
    timeLimitSeconds: null,
    order: id,
    choices: [],
  });

  const questions = [question(21), question(22), question(23)];

  it("names the questions still unanswered, in the order they were asked", () => {
    expect(
      unansweredQuestions(questions, { 22: 41 }).map((unanswered) => unanswered.id),
    ).toEqual([21, 23]);
    expect(unansweredQuestions(questions, { 21: 1, 22: 2, 23: 3 })).toEqual([]);
  });

  it("counts a timed-out question as settled, and sends it with no choice", () => {
    // 22 timed out: settled with null, so not unanswered, and sent as null.
    expect(unansweredQuestions(questions, { 21: 31, 22: null }).map((q) => q.id)).toEqual([23]);
    expect(answersFor(questions, { 21: 31, 22: null, 23: 53 })).toEqual([
      { questionId: 21, choiceId: 31 },
      { questionId: 22, choiceId: null },
      { questionId: 23, choiceId: 53 },
    ]);
  });

  it("turns the picks into answers in question order, ignoring strays", () => {
    // 99 is not a question of this assessment, so it is not sent.
    expect(answersFor(questions, { 23: 53, 21: 31, 99: 1 })).toEqual([
      { questionId: 21, choiceId: 31 },
      { questionId: 23, choiceId: 53 },
    ]);
  });
});
