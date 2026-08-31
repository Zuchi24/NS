import { describe, expect, it } from "vitest";

import { readableSize, validateDraft, youtubeId } from "./materialService";
import type { MaterialDraft } from "./materialService";

/**
 * The material form's own arithmetic and rules.
 *
 * These run without a DOM: the checks below are what decides whether a draft
 * is worth sending, and they should be readable without standing a page up.
 * The server validates all of it again — nothing here is the authority, it
 * just saves the author a round trip.
 */

function draft(over: Partial<MaterialDraft> = {}): MaterialDraft {
  return {
    title: "Subnetting primer",
    description: "",
    kind: "link",
    url: "https://example.com/primer",
    file: null,
    isPublished: true,
    ...over,
  };
}

describe("validateDraft", () => {
  it("accepts a well-formed link", () => {
    expect(validateDraft(draft(), { isNew: true })).toEqual({});
  });

  it("requires a title", () => {
    const errors = validateDraft(draft({ title: "   " }), { isNew: true });

    expect(errors.title).toBeDefined();
  });

  it("requires an address for a link", () => {
    const errors = validateDraft(draft({ url: "" }), { isNew: true });

    expect(errors.url).toBeDefined();
  });

  it("rejects an address that is not http or https", () => {
    // The server refuses these too; catching them here names the field.
    for (const url of [
      "javascript:alert(1)",
      "mailto:someone@example.com",
      "file:///etc/passwd",
      "example.com",
    ]) {
      expect(validateDraft(draft({ url }), { isNew: true }).url).toBeDefined();
    }
  });

  it("requires a YouTube address for a video", () => {
    const errors = validateDraft(
      draft({ kind: "video", url: "https://example.com/not-a-video" }),
      { isNew: true },
    );

    expect(errors.url).toBeDefined();
  });

  it("accepts the shapes a YouTube link is pasted in", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/abcdefghijk",
      "https://www.youtube.com/embed/abcdefghijk",
    ]) {
      expect(validateDraft(draft({ kind: "video", url }), { isNew: true }))
        .toEqual({});
    }
  });

  it("requires a file on a new file material", () => {
    const errors = validateDraft(draft({ kind: "file", file: null }), {
      isNew: true,
    });

    expect(errors.file).toBeDefined();
  });

  it("does not require a file when editing one that already has it", () => {
    // An edit keeps the upload it already has unless a new one is chosen, so
    // renaming a file material must not demand the file be re-picked.
    const errors = validateDraft(draft({ kind: "file", file: null }), {
      isNew: false,
    });

    expect(errors.file).toBeUndefined();
  });

  it("ignores the url when the kind is file", () => {
    const errors = validateDraft(
      draft({ kind: "file", url: "not a url", file: new File([""], "a.pdf") }),
      { isNew: true },
    );

    expect(errors).toEqual({});
  });
});

describe("youtubeId", () => {
  it("reads the id out of each link shape", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=abcdefghijk")).toBe(
      "abcdefghijk",
    );
    expect(youtubeId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeId("https://www.youtube.com/embed/abcdefghijk")).toBe(
      "abcdefghijk",
    );
  });

  it("accepts a bare id, which is how it is most often pasted wrong", () => {
    expect(youtubeId("abcdefghijk")).toBe("abcdefghijk");
  });

  it("returns null for nothing and for a non-video address", () => {
    expect(youtubeId(null)).toBeNull();
    expect(youtubeId("https://example.com/article")).toBeNull();
  });
});

describe("readableSize", () => {
  it("scales to a unit a person reads", () => {
    expect(readableSize(0)).toBe("0 B");
    expect(readableSize(900)).toBe("900 B");
    expect(readableSize(2048)).toBe("2.0 KB");
    expect(readableSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("has nothing to say about an unknown size", () => {
    expect(readableSize(null)).toBeNull();
  });
});
