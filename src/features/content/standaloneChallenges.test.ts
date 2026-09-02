import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchChallenges, fetchTopic } from "./contentService";

/**
 * Challenges as a top-level feature, from the client's side.
 *
 * The API no longer sends a challenge's topics, its placement, or whether it is
 * locked, and no longer nests challenges inside a topic. These pin that the
 * client asks for none of it and invents none of it either — a stale field
 * arriving from an older server must not quietly reintroduce the coupling.
 */

vi.mock("@/services/api", () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const { api } = await import("@/services/api");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the challenge catalogue", () => {
  it("reads a challenge without any notion of a topic or a lock", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 7,
          title: "Build a LAN",
          description: "Wire it up.",
          kind: "topology",
          difficulty: "beginner",
          config: null,
          required_families: ["switch"],
          order: 0,
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    });

    const [challenge] = await fetchChallenges();

    expect(challenge).toEqual({
      id: 7,
      title: "Build a LAN",
      description: "Wire it up.",
      kind: "topology",
      difficulty: "beginner",
      config: null,
      requiredFamilies: ["switch"],
      order: 0,
    });
  });

  it("ignores topic and lock fields from an older server", async () => {
    // Belt and braces: the coupling is gone from the API, and a response that
    // still carried it must not put it back on the client.
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 7,
          title: "Build a LAN",
          description: null,
          kind: "topology",
          difficulty: "beginner",
          config: null,
          required_families: [],
          order: 0,
          is_locked: true,
          topics: [{ id: 1, title: "Your First LAN" }],
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    });

    const [challenge] = await fetchChallenges();

    expect(challenge).not.toHaveProperty("locked");
    expect(challenge).not.toHaveProperty("topicIds");
  });

  it("asks the flat catalogue route, not one scoped to a topic", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });

    await fetchChallenges();

    expect(vi.mocked(api.get).mock.calls[0][0]).toContain("/challenges");
    expect(vi.mocked(api.get).mock.calls[0][0]).not.toContain("/topics/");
  });
});

describe("a topic", () => {
  it("carries reading and its siblings, and no challenges or standing", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: 3,
        roadmap_id: 1,
        title: "Your First LAN",
        description: "Switches and cables.",
        ytube_link: null,
        order: 1,
        roadmap: {
          id: 1,
          title: "Networking Essentials",
          description: "",
          order: 0,
          is_published: true,
          topics: [
            {
              id: 3,
              roadmap_id: 1,
              title: "Your First LAN",
              description: null,
              ytube_link: null,
              order: 1,
            },
          ],
        },
      },
    });

    const detail = await fetchTopic(3);

    expect(detail).not.toHaveProperty("challenges");
    expect(detail.topic).not.toHaveProperty("progress");
    expect(detail.topic).not.toHaveProperty("challengesCount");
    expect(detail.roadmapTitle).toBe("Networking Essentials");
    expect(detail.siblings).toHaveLength(1);
  });
});
