import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeSubtopic,
  fetchTopicProgression,
  openNextSubtopic,
  subtopicStatus,
} from "./progressionService";
import type { TopicProgression } from "./progressionService";

/**
 * Reading a student's progression and marking a subtopic complete.
 *
 * The transport is stubbed, so these say what is asked for and what is made of
 * the answer. What carries weight: neither request names a student or carries
 * a body the server would have to trust, and the page is handed the server's
 * judgements as they came rather than a second opinion.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

const { api } = await import("@/services/api");

function apiProgression(over: Record<string, unknown> = {}) {
  return {
    topic_id: 1,
    pre_test: {
      id: 51,
      title: "Before you start",
      submitted: true,
      waived: false,
      required: false,
      result: {
        earned_points: 8,
        total_points: 10,
        percent: "80.00",
        submitted_at: "2026-09-15T10:00:00.000000Z",
      },
    },
    subtopics: [
      { id: 101, title: "OSI Model", order: 0, status: "completed" },
      { id: 102, title: "TCP/IP", order: 1, status: "available" },
      { id: 103, title: "Subnetting", order: 2, status: "locked" },
    ],
    next_subtopic_id: 102,
    completed_count: 1,
    total_count: 3,
    remaining_count: 2,
    post_test: {
      id: 52,
      title: "Check your understanding",
      available: false,
      submitted: false,
      locked_reason:
        'Complete every subtopic of "Networking Fundamentals" before taking its post-test (2 left).',
      result: null,
    },
    past_results: [],
    ...over,
  };
}

const mapped: TopicProgression = {
  topicId: 1,
  preTest: {
    id: 51,
    title: "Before you start",
    submitted: true,
    waived: false,
    required: false,
    result: {
      earnedPoints: 8,
      totalPoints: 10,
      percent: 80,
      submittedAt: "2026-09-15T10:00:00.000000Z",
    },
  },
  subtopics: [
    { id: 101, title: "OSI Model", order: 0, status: "completed" },
    { id: 102, title: "TCP/IP", order: 1, status: "available" },
    { id: 103, title: "Subnetting", order: 2, status: "locked" },
  ],
  nextSubtopicId: 102,
  completedCount: 1,
  totalCount: 3,
  remainingCount: 2,
  postTest: {
    id: 52,
    title: "Check your understanding",
    available: false,
    submitted: false,
    lockedReason:
      'Complete every subtopic of "Networking Fundamentals" before taking its post-test (2 left).',
    result: null,
  },
  pastResults: [],
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("reading a progression", () => {
  it("asks for the root topic's progression, naming nobody", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiProgression() });

    await fetchTopicProgression(1);

    expect(api.get).toHaveBeenCalledWith("/topics/1/progression");
    expect(vi.mocked(api.get).mock.calls[0][0]).not.toContain("?");
  });

  it("carries every judgement across as the server made it", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiProgression() });

    expect(await fetchTopicProgression(1)).toEqual(mapped);
  });

  it("carries a topic with no published assessments and no subtopics", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: apiProgression({
        pre_test: null,
        post_test: null,
        subtopics: [],
        next_subtopic_id: null,
        completed_count: 0,
        total_count: 0,
        remaining_count: 0,
      }),
    });

    expect(await fetchTopicProgression(1)).toMatchObject({
      preTest: null,
      postTest: null,
      subtopics: [],
      nextSubtopicId: null,
      totalCount: 0,
    });
  });

  it("carries the student's own results on assessments no longer offered", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: apiProgression({
        pre_test: null,
        past_results: [
          {
            assessment_id: 51,
            type: "pre_test",
            title: "Before you start",
            earned_points: 8,
            total_points: 10,
            percent: "80.00",
            submitted_at: "2026-09-15T10:00:00.000000Z",
          },
        ],
      }),
    });

    const { pastResults } = await fetchTopicProgression(1);

    // The same reading of a percentage the rest of the page gets: a number,
    // whether the wire carried one or the text of one.
    expect(pastResults).toEqual([
      {
        assessmentId: 51,
        type: "pre_test",
        title: "Before you start",
        result: {
          earnedPoints: 8,
          totalPoints: 10,
          percent: 80,
          submittedAt: "2026-09-15T10:00:00.000000Z",
        },
      },
    ]);
  });

  it("reads no earlier results as none rather than as missing", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: apiProgression({ past_results: [] }) });

    expect((await fetchTopicProgression(1)).pastResults).toEqual([]);
  });

  it("drops anything else an earlier result carried", async () => {
    // As if the server had sent the questions with it. A result says what it
    // came to; which answers were right is the review's, on its own route.
    vi.mocked(api.get).mockResolvedValue({
      data: apiProgression({
        past_results: [
          {
            assessment_id: 51,
            type: "post_test",
            title: "Check your understanding",
            earned_points: 2,
            total_points: 4,
            percent: 50,
            submitted_at: null,
            questions: [{ id: 1, correct_choice_id: 9, is_correct: true }],
            user_id: 7,
          },
        ],
      }),
    });

    const [past] = (await fetchTopicProgression(1)).pastResults;

    expect(Object.keys(past).sort()).toEqual(["assessmentId", "result", "title", "type"]);
    expect(Object.keys(past.result).sort()).toEqual([
      "earnedPoints",
      "percent",
      "submittedAt",
      "totalPoints",
    ]);
  });
});

describe("marking a subtopic complete", () => {
  it("posts to the subtopic's own completion route with nothing in the body", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiProgression() });

    await completeSubtopic(102);

    expect(api.post).toHaveBeenCalledWith("/topics/102/completion");
    // No body at all: not a student, not a status, not a timestamp.
    expect(vi.mocked(api.post).mock.calls[0]).toHaveLength(1);
  });

  it("hands back the progression the server answered with", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiProgression() });

    expect(await completeSubtopic(102)).toEqual(mapped);
  });
});

describe("reading a progression back", () => {
  it("looks a subtopic's status up rather than working it out", () => {
    expect(subtopicStatus(mapped, 101)).toBe("completed");
    expect(subtopicStatus(mapped, 103)).toBe("locked");
    expect(subtopicStatus(mapped, 999)).toBeNull();
    expect(subtopicStatus(null, 101)).toBeNull();
  });

  it("offers the next subtopic only once the server has opened it", () => {
    expect(openNextSubtopic(mapped)).toMatchObject({ id: 102 });

    // Next in order, but still shut behind the pre-test.
    expect(
      openNextSubtopic({
        ...mapped,
        nextSubtopicId: 101,
        subtopics: mapped.subtopics.map((subtopic) => ({ ...subtopic, status: "locked" })),
      }),
    ).toBeNull();
    expect(openNextSubtopic({ ...mapped, nextSubtopicId: null })).toBeNull();
    expect(openNextSubtopic(null)).toBeNull();
  });
});
