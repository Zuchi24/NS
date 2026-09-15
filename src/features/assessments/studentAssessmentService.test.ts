import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answersFor,
  fetchOwnAttempt,
  fetchStudentAssessment,
  submitAssessment,
  unansweredQuestions,
} from "./studentAssessmentService";
import type {
  AssessmentResult,
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

  it("turns the picks into answers in question order, ignoring strays", () => {
    // 99 is not a question of this assessment, so it is not sent.
    expect(answersFor(questions, { 23: 53, 21: 31, 99: 1 })).toEqual([
      { questionId: 21, choiceId: 31 },
      { questionId: 23, choiceId: 53 },
    ]);
  });
});
