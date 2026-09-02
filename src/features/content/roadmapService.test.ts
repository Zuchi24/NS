import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRoadmap,
  deleteRoadmap,
  draftOfRoadmap,
  publishRoadmap,
  unpublishRoadmap,
  updateRoadmap,
  validateRoadmapDraft,
} from "./roadmapService";
import type { RoadmapDraft } from "./roadmapService";
import type { Roadmap } from "./types";

/**
 * The roadmap form's rules, and what it actually puts on the wire.
 *
 * Two things are pinned here. The validation is what decides whether a draft is
 * worth sending — the server checks all of it again and has the final say, this
 * only saves the author a round trip. The endpoints are the other half: publish
 * and unpublish are their own routes rather than a field on the edit, and an
 * edit that quietly carried a publish flag would release an unfinished roadmap
 * to a class by accident.
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

function draft(over: Partial<RoadmapDraft> = {}): RoadmapDraft {
  return {
    title: "Wireless Networking",
    description: "Access points, channels and roaming.",
    ...over,
  };
}

const apiRoadmap = {
  id: 4,
  title: "Wireless Networking",
  description: "Access points, channels and roaming.",
  order: 3,
  is_published: false,
  topics_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateRoadmapDraft", () => {
  it("accepts a well-formed roadmap", () => {
    expect(validateRoadmapDraft(draft())).toEqual({});
  });

  it("requires a title", () => {
    expect(validateRoadmapDraft(draft({ title: "   " })).title).toBeDefined();
  });

  it("refuses a title the column cannot hold", () => {
    expect(
      validateRoadmapDraft(draft({ title: "a".repeat(256) })).title,
    ).toBeDefined();
  });

  it("does not require a description", () => {
    expect(validateRoadmapDraft(draft({ description: "" }))).toEqual({});
  });
});

describe("createRoadmap", () => {
  it("posts the draft and reads the roadmap back", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: apiRoadmap });

    const roadmap = await createRoadmap(draft());

    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps", {
      title: "Wireless Networking",
      description: "Access points, channels and roaming.",
    });

    expect(roadmap).toEqual({
      id: 4,
      title: "Wireless Networking",
      description: "Access points, channels and roaming.",
      order: 3,
      isPublished: false,
      topics: [],
    });
  });

  it("sends an empty description as null rather than as an empty string", async () => {
    // An empty box means "no description". Sending "" would write one that
    // could never be taken away again.
    vi.mocked(api.post).mockResolvedValueOnce({ data: apiRoadmap });

    await createRoadmap(draft({ description: "  " }));

    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps", {
      title: "Wireless Networking",
      description: null,
    });
  });

  it("never asks for a roadmap to be published on creation", async () => {
    // Writing a roadmap down is not the same decision as putting it in front of
    // a class, and the API defaults a new one to a draft.
    vi.mocked(api.post).mockResolvedValueOnce({ data: apiRoadmap });

    await createRoadmap(draft());

    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty(
      "is_published",
    );
  });
});

describe("updateRoadmap", () => {
  it("sends the whole draft to the roadmap's own route", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { ...apiRoadmap, title: "Wireless" },
    });

    const roadmap = await updateRoadmap(4, draft({ title: "Wireless" }));

    expect(api.put).toHaveBeenCalledWith("/admin/roadmaps/4", {
      title: "Wireless",
      description: "Access points, channels and roaming.",
    });

    expect(roadmap.title).toBe("Wireless");
  });

  it("does not touch the publish state", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: apiRoadmap });

    await updateRoadmap(4, draft());

    expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty(
      "is_published",
    );
  });
});

describe("publishRoadmap and unpublishRoadmap", () => {
  it("releases a roadmap through its own route", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...apiRoadmap, is_published: true },
    });

    const roadmap = await publishRoadmap(4);

    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps/4/publish");
    expect(roadmap.isPublished).toBe(true);
  });

  it("withdraws a roadmap through its own route", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: apiRoadmap });

    const roadmap = await unpublishRoadmap(4);

    expect(api.post).toHaveBeenCalledWith("/admin/roadmaps/4/unpublish");
    expect(roadmap.isPublished).toBe(false);
  });
});

describe("deleteRoadmap", () => {
  it("deletes through the admin route", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);

    await deleteRoadmap(4);

    expect(api.delete).toHaveBeenCalledWith("/admin/roadmaps/4");
  });

  it("lets the server's refusal through untouched", async () => {
    // The API answers 409 with the reason — that a roadmap students have worked
    // through is unpublished rather than destroyed. Callers show that message,
    // so nothing here may swallow or reword it.
    vi.mocked(api.delete).mockRejectedValueOnce(
      new Error("This roadmap has student history."),
    );

    await expect(deleteRoadmap(4)).rejects.toThrow(/student history/i);
  });
});

describe("draftOfRoadmap", () => {
  it("fills the form from an existing roadmap", () => {
    const roadmap: Roadmap = {
      id: 1,
      title: "Networking Basics",
      description: "Where everyone starts.",
      order: 0,
      isPublished: true,
      topics: [],
    };

    expect(draftOfRoadmap(roadmap)).toEqual({
      title: "Networking Basics",
      description: "Where everyone starts.",
    });
  });
});
