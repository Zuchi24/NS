import { beforeEach, describe, expect, it, vi } from "vitest";

import contractText from "./progression-contract.v1.json?raw";
import type { TopicProgression } from "../progressionService";

/**
 * The progression payload, checked from the frontend side.
 *
 * progression-contract.v1.json is shared, byte for byte, with the backend's
 * tests/Fixtures/progression/, and it is not written by hand at either end: it
 * is three real replies from GET /api/topics/{topic}/progression, recorded by
 * the backend contract test and pinned there against what
 * TopicProgressionResource still produces.
 *
 * So what these do is the other half. The recorded bytes go in at the top of
 * progressionService — through the same api.get the app calls and the same
 * mapping the pages read — and what comes out is checked. Between the two
 * files, a field the server renames, moves a level, or stops sending fails one
 * suite or the other rather than turning into `undefined` on a page that then
 * draws nothing and says nothing.
 *
 * These are not a second copy of progressionService.test.ts. That one says what
 * the mapper does with a payload written for it; this one says the payload it is
 * given is the one the server actually sends.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const { api } = await import("@/services/api");
const { fetchTopicProgression } = await import("../progressionService");

/** SHA-256 of the fixture with line endings normalised to LF. Update both repos together. */
const CONTRACT_SHA256 = "4695290abd2f77a9662d45474c38aa09a85dde1e7f67231b96b301811b74e078";

interface Contract {
  version: string;
  endpoint: string;
  cases: Record<string, { payload: { topic_id: number } & Record<string, unknown> }>;
}

const contract = JSON.parse(contractText) as Contract;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text.replace(/\r\n/g, "\n")),
  );

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The recorded reply for `$name`, put through the real service. */
async function mapped(name: keyof Contract["cases"]): Promise<TopicProgression> {
  const { payload } = contract.cases[name];

  vi.mocked(api.get).mockResolvedValue({ data: payload });

  return fetchTopicProgression(payload.topic_id);
}

/**
 * Every path in the mapped model holding `undefined`.
 *
 * The one failure a mapper cannot raise on its own. Nothing in TopicProgression
 * is optional, so a key the server renamed or moved does not throw here — it
 * reads as `undefined`, survives every type at compile time because the shape
 * off the wire is only asserted, and reaches a page as a blank where a score or
 * a title should be. This is what makes that visible.
 */
function undefinedPaths(value: unknown, path = "progression"): string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    undefinedPaths(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`),
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("the shared progression contract", () => {
  it("holds the same contract bytes as the backend", async () => {
    expect(await sha256(contractText)).toBe(CONTRACT_SHA256);
    expect(contract.version).toBe("1.1.0");
    expect(contract.endpoint).toBe("GET /api/topics/{topic}/progression");
  });

  it("asks the endpoint the contract is recorded from", async () => {
    await mapped("paced");

    expect(api.get).toHaveBeenCalledWith("/topics/1/progression");
  });

  it("leaves nothing undefined anywhere in the model it builds", async () => {
    for (const name of Object.keys(contract.cases)) {
      expect(undefinedPaths(await mapped(name))).toEqual([]);
    }
  });
});

describe("a topic part way through", () => {
  it("builds the whole model from the recorded reply", async () => {
    // Field for field against the real payload: the names the server sends, the
    // names the pages read, and the one place the two are written down together.
    expect(await mapped("paced")).toEqual<TopicProgression>({
      topicId: 1,
      preTest: {
        id: 1,
        version: 1,
        title: "Before you start",
        submitted: true,
        waived: false,
        required: false,
        result: {
          assessmentId: 1,
          version: 1,
          earnedPoints: 2,
          totalPoints: 3,
          // 2 of 3 on the wire is 66.67, which is the case that proves the
          // percentage survives the crossing as a number rather than as text.
          percent: 66.67,
          submittedAt: "2026-09-18T10:00:00.000000Z",
        },
      },
      subtopics: [
        { id: 2, title: "VLANs", order: 0, status: "completed" },
        { id: 3, title: "Trunks", order: 1, status: "available" },
        { id: 4, title: "Spanning Tree", order: 2, status: "locked" },
      ],
      nextSubtopicId: 3,
      completedCount: 1,
      totalCount: 3,
      remainingCount: 2,
      postTest: {
        id: 2,
        version: 1,
        title: "Check your understanding",
        available: false,
        submitted: false,
        // The server's own words, carried rather than composed here — a page
        // that wrote its own would eventually disagree with the policy.
        lockedReason:
          'Complete every subtopic of "Switching" before taking its post-test (2 left).',
        result: null,
      },
      pastResults: [],
    });
  });

  it("carries every subtopic standing the server has", async () => {
    const { subtopics } = await mapped("paced");

    expect(subtopics.map((subtopic) => subtopic.status)).toEqual([
      "completed",
      "available",
      "locked",
    ]);
  });
});

describe("a topic with a result on something no longer offered", () => {
  it("nests a past result under its own totals", async () => {
    const { pastResults, postTest, preTest } = await mapped("withdrawn");

    // The wire is flat — assessment_id, type, title and the totals side by side
    // — and the model is not. This is the one place in the payload where the
    // two shapes differ, so it is the one most worth holding.
    expect(pastResults).toEqual([
      {
        assessmentId: 4,
        version: 1,
        type: "post_test",
        title: "Routing wrap-up",
        result: {
          assessmentId: 4,
          version: 1,
          earnedPoints: 1,
          totalPoints: 2,
          percent: 50,
          submittedAt: "2026-09-18T10:00:00.000000Z",
        },
      },
    ]);

    // Withdrawn means gone from the pacing, not gone from the page: no post-test
    // step, and the pre-test still offered with the result it was taken for.
    expect(postTest).toBeNull();
    expect(preTest?.result).toEqual({
      assessmentId: 3,
      version: 1,
      earnedPoints: 2,
      totalPoints: 2,
      // A whole percentage crosses as 100 rather than 100.0, which is why the
      // service reads it through Number() instead of trusting the JSON type.
      percent: 100,
      submittedAt: "2026-09-18T10:00:00.000000Z",
    });
  });

  it("reads a finished topic as having nothing next", async () => {
    const { nextSubtopicId, completedCount, totalCount, remainingCount } =
      await mapped("withdrawn");

    expect(nextSubtopicId).toBeNull();
    expect([completedCount, totalCount, remainingCount]).toEqual([2, 2, 0]);
  });
});

describe("a topic whose pre-test has a newer version than the one taken", () => {
  it("offers the newer version and keeps the result on the one taken", async () => {
    const { preTest, pastResults, subtopics } = await mapped("replaced");

    expect(preTest).toEqual({
      id: 6,
      version: 2,
      title: "Addressing check-in",
      submitted: true,
      waived: false,
      required: false,
      result: {
        assessmentId: 5,
        version: 1,
        earnedPoints: 1,
        totalPoints: 2,
        percent: 50,
        submittedAt: "2026-09-18T10:00:00.000000Z",
      },
    });

    // Not sent back to take it: the subtopics are open, and the result is in
    // the step rather than listed again as an earlier one.
    expect(subtopics.map((subtopic) => subtopic.status)).toEqual(["available"]);
    expect(pastResults).toEqual([]);
  });
});

describe("a topic with nothing to pace", () => {
  it("reads absent assessments as null and absent sections as empty", async () => {
    // What most topics are, and the case a mapper reading a missing key as a
    // crash would take the page down on.
    expect(await mapped("bare")).toEqual<TopicProgression>({
      topicId: 10,
      preTest: null,
      subtopics: [],
      nextSubtopicId: null,
      completedCount: 0,
      totalCount: 0,
      remainingCount: 0,
      postTest: null,
      pastResults: [],
    });
  });
});
