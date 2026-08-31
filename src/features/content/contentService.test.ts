import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoadmaps } from "./contentService";

/**
 * Reading the roadmap list.
 *
 * The API answers in snake_case and nothing outside contentService should have
 * to know that, so these pin the translation — in particular `is_published`,
 * which the authoring screens read to mark a roadmap as a draft.
 *
 * Nothing here filters. Which roadmaps come back is the server's decision: a
 * student is sent published ones only, staff are sent both, and this function
 * reports faithfully whatever it was given. A client-side filter would be a
 * second opinion on an authorization question, which is exactly the mistake to
 * avoid.
 */

vi.mock("@/services/api", () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const { api } = await import("@/services/api");

function page(data: unknown[]) {
  return {
    data,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: data.length },
  };
}

const live = {
  id: 1,
  title: "Released roadmap",
  description: "Out already.",
  order: 0,
  is_published: true,
  topics: [
    {
      id: 1,
      roadmap_id: 1,
      title: "Released topic",
      description: null,
      ytube_link: null,
      order: 0,
    },
  ],
};

const draft = {
  id: 2,
  title: "Unreleased roadmap",
  description: "Still being written.",
  order: 1,
  is_published: false,
  topics: [
    {
      id: 2,
      roadmap_id: 2,
      title: "Unreleased topic",
      description: null,
      ytube_link: null,
      order: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchRoadmaps", () => {
  it("asks for the topics along with the roadmaps", async () => {
    vi.mocked(api.get).mockResolvedValue(page([live]));

    await fetchRoadmaps();

    expect(vi.mocked(api.get).mock.calls[0][0]).toContain("/roadmaps");
    // One request for the whole tree rather than a fetch per roadmap.
    expect(vi.mocked(api.get).mock.calls[0][0]).toContain("include=topics");
  });

  it("reads is_published back as isPublished", async () => {
    vi.mocked(api.get).mockResolvedValue(page([live, draft]));

    const roadmaps = await fetchRoadmaps();

    expect(roadmaps.map((r) => [r.title, r.isPublished])).toEqual([
      ["Released roadmap", true],
      ["Unreleased roadmap", false],
    ]);
  });

  it("returns a draft roadmap exactly as the server sent it", async () => {
    // Whether a draft is in the response at all is the server's decision — a
    // student is never sent one. When it is sent, it comes through whole,
    // topics included, because staff are going to author it.
    vi.mocked(api.get).mockResolvedValue(page([draft]));

    const [roadmap] = await fetchRoadmaps();

    expect(roadmap).toEqual({
      id: 2,
      title: "Unreleased roadmap",
      description: "Still being written.",
      order: 1,
      isPublished: false,
      topics: [
        expect.objectContaining({ id: 2, title: "Unreleased topic" }),
      ],
    });
  });

  it("treats a roadmap as published when the response does not say", async () => {
    // The safe reading of a missing field: a roadmap must not be silently
    // marked as a draft nobody can see because an older response omitted it.
    const { is_published: _omitted, ...withoutFlag } = live;

    vi.mocked(api.get).mockResolvedValue(page([withoutFlag]));

    const [roadmap] = await fetchRoadmaps();

    expect(roadmap.isPublished).toBe(true);
  });
});
