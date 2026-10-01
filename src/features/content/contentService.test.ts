import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoadmaps, fetchSubtopic, fetchTopic } from "./contentService";

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

/**
 * Sections, as they arrive from the API.
 *
 * Two things worth pinning in the mapping rather than only in the UI. A
 * response that says nothing about a parent describes a topic of the roadmap —
 * which is what every topic was before sections existed, so an old response
 * must not start reading as a section. And a section's materials go through the
 * material service's own mapper, so a nested material and a fetched one are the
 * same shape rather than two that happen to agree today.
 */
describe("subtopics", () => {
  const topicWithSections = {
    id: 1,
    roadmap_id: 1,
    parent_id: null,
    title: "Networking Fundamentals",
    description: null,
    ytube_link: null,
    order: 0,
    roadmap: { id: 1, title: "Essentials", description: "", order: 0, is_published: true, topics: [] },
    subtopics: [
      {
        id: 101,
        roadmap_id: 1,
        parent_id: 1,
        title: "OSI Model",
        description: "Seven layers.",
        order: 0,
        materials: [
          {
            id: 10,
            topic_id: 101,
            title: "Layer chart",
            description: null,
            kind: "link",
            kind_label: "Link",
            url: "https://example.com/chart",
            filename: null,
            mime_type: null,
            size_bytes: null,
            order: 0,
            is_published: true,
          },
        ],
      },
    ],
  };

  it("reads a topic's sections and their materials", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: topicWithSections });

    const detail = await fetchTopic(1);

    expect(detail.subtopics).toHaveLength(1);
    expect(detail.subtopics[0]).toMatchObject({
      id: 101,
      parentId: 1,
      roadmapId: 1,
      title: "OSI Model",
      description: "Seven layers.",
      order: 0,
    });

    // Mapped by the material service, so `url` and `downloadUrl` are both
    // present and normalised rather than one being absent.
    expect(detail.subtopics[0].materials[0]).toMatchObject({
      id: 10,
      topicId: 101,
      title: "Layer chart",
      url: "https://example.com/chart",
      downloadUrl: null,
    });
  });

  it("reads a topic with no sections as having none", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...topicWithSections, subtopics: [] },
    });

    expect((await fetchTopic(1)).subtopics).toEqual([]);
  });

  it("treats a response that says nothing about sections as having none", async () => {
    const { subtopics: _ignored, ...withoutKey } = topicWithSections;
    vi.mocked(api.get).mockResolvedValue({ data: withoutKey });

    const detail = await fetchTopic(1);

    // A response from before sections existed. It describes a topic of the
    // roadmap with nothing inside it, which is exactly what it was.
    expect(detail.subtopics).toEqual([]);
    expect(detail.topic.parentId).toBeNull();
  });

  it("asks for sections only when they are wanted", async () => {
    vi.mocked(api.get).mockResolvedValue(page([live]));

    await fetchRoadmaps();
    expect(vi.mocked(api.get).mock.calls[0][0]).toContain("include=topics");
    expect(vi.mocked(api.get).mock.calls[0][0]).not.toContain("subtopics");

    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(page([live]));

    await fetchRoadmaps({ withSubtopics: true });
    expect(vi.mocked(api.get).mock.calls[0][0]).toContain(
      "include=topics,subtopics",
    );
  });

  /**
   * The standing a section arrives with.
   *
   * The server judges where a student stands on each section and sends it along
   * with the section; this carries it and nothing else. So what is pinned here
   * is that each of the three values survives the mapping unaltered, and — the
   * one that actually costs something to get wrong — that a section sent
   * without a judgement keeps none.
   *
   * A response says nothing about standing in three ordinary cases: staff read
   * everything and are judged on nothing, a topic of the roadmap is not paced,
   * and a response written before the field existed has none to send. Turning
   * any of those into "locked" here would invent a lock the server never asked
   * for, on a section a student may well be free to open.
   */
  describe("the status it carries", () => {
    const withStatus = (status?: string) => ({
      ...topicWithSections,
      subtopics: [{ ...topicWithSections.subtopics[0], status }],
    });

    it.each(["completed", "available", "locked"] as const)(
      "carries %s through exactly as the server sent it",
      async (status) => {
        vi.mocked(api.get).mockResolvedValue({ data: withStatus(status) });

        const detail = await fetchTopic(1);

        expect(detail.subtopics[0].status).toBe(status);
      },
    );

    it("leaves a section the server did not judge without a status", async () => {
      const { status: _absent, ...noStatus } = withStatus("locked").subtopics[0];
      vi.mocked(api.get).mockResolvedValue({
        data: { ...topicWithSections, subtopics: [noStatus] },
      });

      const detail = await fetchTopic(1);

      // Undefined, and specifically not "locked": what the server did not say,
      // this does not say either.
      expect(detail.subtopics[0].status).toBeUndefined();
      expect(detail.subtopics[0]).toMatchObject({ id: 101, title: "OSI Model" });
    });

    it("carries it down the roadmap list, where the roadmap reads it", async () => {
      vi.mocked(api.get).mockResolvedValue(
        page([
          {
            ...live,
            topics: [
              { ...live.topics[0], subtopics: withStatus("completed").subtopics },
            ],
          },
        ]),
      );

      const [roadmap] = await fetchRoadmaps({ withSubtopics: true });

      expect(roadmap.topics[0].subtopics?.[0].status).toBe("completed");
    });
  });
});

/**
 * Opening one section.
 *
 * A section only learns which topic holds it by being asked for, so this is two
 * requests rather than one — and the second is where everything the page shows
 * comes from, because a topic's response already nests its sections with their
 * materials. What these pin is that shape: the right two ids are asked for, in
 * that order, and the section is picked out of the parent's list rather than
 * rebuilt from the first response.
 *
 * The null cases matter as much as the happy one. This route addresses sections
 * and nothing else, so an id that names a topic of the roadmap has to come back
 * as "not a section" rather than as a half-built page — and so does one that
 * has since been moved out from under the topic that was holding it.
 */
describe("fetchSubtopic", () => {
  const section = {
    id: 101,
    roadmap_id: 1,
    parent_id: 1,
    title: "OSI Model",
    description: "Seven layers.",
    ytube_link: null,
    order: 0,
    roadmap: {
      id: 1,
      title: "Essentials",
      description: "",
      order: 0,
      is_published: true,
      topics: [],
    },
  };

  const parent = {
    id: 1,
    roadmap_id: 1,
    parent_id: null,
    title: "Networking Fundamentals",
    description: "How a network holds together.",
    ytube_link: null,
    order: 0,
    roadmap: {
      id: 1,
      title: "Essentials",
      description: "",
      order: 0,
      is_published: true,
      topics: [],
    },
    subtopics: [
      {
        id: 101,
        roadmap_id: 1,
        parent_id: 1,
        title: "OSI Model",
        description: "Seven layers.",
        order: 0,
        materials: [
          {
            id: 10,
            topic_id: 101,
            title: "Layer chart",
            description: null,
            kind: "link",
            kind_label: "Link",
            url: "https://example.com/chart",
            filename: null,
            mime_type: null,
            size_bytes: null,
            order: 0,
            is_published: true,
          },
        ],
      },
      {
        id: 102,
        roadmap_id: 1,
        parent_id: 1,
        title: "TCP/IP",
        description: null,
        order: 1,
        materials: [],
      },
    ],
  };

  /** Answers the section's own request, then its parent's. */
  function serve() {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: section })
      .mockResolvedValueOnce({ data: parent });
  }

  it("asks for the section, then the topic it names as its parent", async () => {
    serve();

    await fetchSubtopic(101);

    // The parent id is not known until the first response arrives, which is
    // the whole reason this is two requests and not one.
    expect(vi.mocked(api.get).mock.calls.map((call) => call[0])).toEqual([
      "/topics/101",
      "/topics/1",
    ]);
  });

  it("reads the section out of its parent's own list", async () => {
    serve();

    const detail = await fetchSubtopic(101);

    expect(detail?.subtopic).toMatchObject({
      id: 101,
      parentId: 1,
      roadmapId: 1,
      title: "OSI Model",
      description: "Seven layers.",
    });

    // Its materials come with it. Taking them from here rather than asking the
    // materials endpoint is what keeps this to two requests.
    expect(detail?.subtopic.materials).toHaveLength(1);
    expect(detail?.subtopic.materials[0]).toMatchObject({
      id: 10,
      topicId: 101,
      title: "Layer chart",
      url: "https://example.com/chart",
      downloadUrl: null,
    });
  });

  it("names the topic and roadmap the section sits in", async () => {
    serve();

    const detail = await fetchSubtopic(101);

    expect(detail?.parent).toMatchObject({
      id: 1,
      title: "Networking Fundamentals",
      parentId: null,
    });
    expect(detail?.roadmapTitle).toBe("Essentials");
  });

  it("pages through the topic's sections rather than the roadmap's topics", async () => {
    serve();

    const detail = await fetchSubtopic(101);

    // Sections of this topic, in their authored order, this one included.
    // Walking the roadmap's topics here would step a student out of the topic
    // they are reading without saying so.
    expect(detail?.siblings.map((sibling) => sibling.id)).toEqual([101, 102]);
  });

  it("refuses an id that names a topic of the roadmap", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: parent });

    // A root topic has a page of its own and this route is not it. Answered
    // without a second request, since there is no parent to fetch.
    expect(await fetchSubtopic(1)).toBeNull();
    expect(vi.mocked(api.get)).toHaveBeenCalledTimes(1);
  });

  it("refuses a section its parent no longer holds", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { ...section, id: 999 } })
      .mockResolvedValueOnce({ data: parent });

    // Moved out from under the topic between the two requests, or pointing at
    // a parent that never held it. Either way there is no page to draw.
    expect(await fetchSubtopic(999)).toBeNull();
  });
});

describe("a topic's standing in the roadmap", () => {
  it("carries the server's judgement through, and invents none where it made none", async () => {
    const topic = (id: number, extra: Record<string, unknown> = {}) => ({
      id,
      roadmap_id: 1,
      parent_id: null,
      title: `Topic ${id}`,
      description: null,
      ytube_link: null,
      order: id,
      ...extra,
    });

    vi.mocked(api.get).mockResolvedValue(
      page([
        {
          id: 1,
          title: "Roadmap",
          description: null,
          order: 0,
          is_published: true,
          topics: [
            topic(1, { open: true }),
            topic(2, { open: false, locked_reason: 'Submit the post-test for "Topic 1" to unlock "Topic 2".' }),
            topic(3),
          ],
        },
      ]),
    );

    const [roadmap] = await fetchRoadmaps();
    const [open, shut, unjudged] = roadmap.topics!;

    expect(open.open).toBe(true);
    expect(open.lockedReason).toBeUndefined();
    expect(shut.open).toBe(false);
    expect(shut.lockedReason).toBe('Submit the post-test for "Topic 1" to unlock "Topic 2".');
    // No key from the server is not "shut": staff are sent none.
    expect(unjudged.open).toBeUndefined();
  });
});
