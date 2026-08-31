import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTopic,
  draftOfTopic,
  reorderTopics,
  updateTopic,
  validateTopicDraft,
} from "./topicService";
import type { TopicDraft } from "./topicService";
import type { Topic } from "./types";

/**
 * The topic form's rules, and what it actually puts on the wire.
 *
 * Two things are being pinned here. The validation is what decides whether a
 * draft is worth sending — the server checks all of it again and has the final
 * say, this only saves the author a round trip. The payload shaping is not
 * cosmetic: an empty box has to reach the API as null, or a description could
 * be written and never taken away again.
 */

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const { api } = await import("@/services/api");

function draft(over: Partial<TopicDraft> = {}): TopicDraft {
  return {
    title: "Addressing the Network",
    description: "Giving the network a gateway.",
    videoUrl: "",
    ...over,
  };
}

const apiTopic = {
  id: 7,
  roadmap_id: 4,
  title: "Addressing the Network",
  description: "Giving the network a gateway.",
  ytube_link: null,
  order: 2,
  challenges_count: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateTopicDraft", () => {
  it("accepts a well-formed topic", () => {
    expect(validateTopicDraft(draft())).toEqual({});
  });

  it("accepts a topic with no description and no video", () => {
    // Both are optional; only the title is not.
    expect(
      validateTopicDraft(draft({ description: "", videoUrl: "" })),
    ).toEqual({});
  });

  it("requires a title", () => {
    expect(validateTopicDraft(draft({ title: "   " })).title).toBeDefined();
  });

  it("rejects a title longer than the column holds", () => {
    expect(
      validateTopicDraft(draft({ title: "a".repeat(256) })).title,
    ).toBeDefined();

    expect(validateTopicDraft(draft({ title: "a".repeat(255) }))).toEqual({});
  });

  it("rejects a video address that is not http or https", () => {
    // The server refuses these too; catching them here names the field. A
    // javascript: or mailto: address passes a naive "is it a URL" check and
    // neither belongs in a lesson.
    for (const videoUrl of [
      "javascript:alert(1)",
      "mailto:someone@example.com",
      "file:///etc/passwd",
      "example.com",
    ]) {
      expect(validateTopicDraft(draft({ videoUrl })).videoUrl).toBeDefined();
    }
  });

  it("accepts a video address that is http or https", () => {
    for (const videoUrl of [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "http://example.com/lesson",
    ]) {
      expect(validateTopicDraft(draft({ videoUrl }))).toEqual({});
    }
  });
});

describe("draftOfTopic", () => {
  it("turns a topic's nulls into empty boxes", () => {
    const topic: Topic = {
      id: 1,
      roadmapId: 4,
      title: "Bare",
      description: null,
      videoUrl: null,
      order: 0,
      challengesCount: 0,
      progress: null,
    };

    // A form field cannot hold null without becoming uncontrolled, so the two
    // absent fields arrive as empty strings — and go back out as null.
    expect(draftOfTopic(topic)).toEqual({
      title: "Bare",
      description: "",
      videoUrl: "",
    });
  });
});

describe("createTopic", () => {
  it("posts the draft to the roadmap's topics", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiTopic });

    await createTopic(4, draft());

    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps/4/topics", {
      title: "Addressing the Network",
      description: "Giving the network a gateway.",
      ytube_link: null,
    });
  });

  it("sends an empty description as null rather than an empty string", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiTopic });

    await createTopic(4, draft({ description: "   ", videoUrl: "  " }));

    // "No description" and "a description that is blank" are different things
    // to the API, and only the first is what an empty box means.
    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps/4/topics", {
      title: "Addressing the Network",
      description: null,
      ytube_link: null,
    });
  });

  it("leaves the position out entirely when none is given", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiTopic });

    await createTopic(4, draft());

    // Absent, not zero: the API appends when there is no position, and sending
    // 0 would insert at the front of the roadmap instead.
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty("order");
  });

  it("sends a position when one is asked for", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiTopic });

    await createTopic(4, draft(), 0);

    expect(api.post).toHaveBeenCalledWith(
      "/admin/roadmaps/4/topics",
      expect.objectContaining({ order: 0 }),
    );
  });

  it("reads the API's snake_case answer back as a topic", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...apiTopic, ytube_link: "https://example.com/v" },
    });

    const topic = await createTopic(4, draft());

    expect(topic).toEqual({
      id: 7,
      roadmapId: 4,
      title: "Addressing the Network",
      description: "Giving the network a gateway.",
      videoUrl: "https://example.com/v",
      order: 2,
      challengesCount: 3,
      // These endpoints answer about the topic, not about any one student.
      progress: null,
    });
  });
});

describe("updateTopic", () => {
  it("puts the whole draft to the topic", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiTopic });

    await updateTopic(7, draft({ videoUrl: "https://example.com/v" }));

    expect(api.put).toHaveBeenCalledWith("/admin/topics/7", {
      title: "Addressing the Network",
      description: "Giving the network a gateway.",
      ytube_link: "https://example.com/v",
    });
  });

  it("never sends an order, so an edit cannot move a topic", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: apiTopic });

    await updateTopic(7, draft());

    // Where a topic sits decides which topics unlock after it, so moving one
    // is a separate act with its own endpoint. The API ignores an order sent
    // here; this makes sure the client never sends one in the first place.
    expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty("order");
  });
});

describe("reorderTopics", () => {
  it("sends the complete running order", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: [apiTopic] });

    await reorderTopics(4, [3, 1, 2]);

    expect(api.put).toHaveBeenCalledWith("/admin/roadmaps/4/topics/order", {
      topic_ids: [3, 1, 2],
    });
  });
});
