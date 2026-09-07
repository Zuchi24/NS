import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMaterial,
  openMaterial,
  readableSize,
  updateMaterial,
  validateDraft,
  videoEmbedUrl,
  viewerFor,
  youtubeId,
} from "./materialService";
import type { MaterialDraft } from "./materialService";
import type { LearningMaterial } from "./types";
import { api } from "@/services/api";

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

/**
 * What actually goes on the wire.
 *
 * The API reads `file`, `title`, `kind`, `url` and `is_published`; a form that
 * spells any of them differently gets a 422 about a missing field rather than
 * about the file, which is a long way to walk to find a typo. These pin the
 * names against the ones StoreLearningMaterialRequest validates.
 */
describe("the multipart body", () => {
  const upload = vi.fn();

  beforeEach(() => {
    upload.mockReset().mockResolvedValue({
      data: {
        id: 1,
        topic_id: 7,
        title: "Diagram",
        description: null,
        kind: "file",
        kind_label: "File",
        filename: "diagram.webp",
        mime_type: "image/webp",
        size_bytes: 44,
        order: 0,
        is_published: true,
      },
    });

    vi.spyOn(api, "upload").mockImplementation(upload);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The FormData the service built for the last call. */
  function sentForm(): FormData {
    return upload.mock.calls[0][1] as FormData;
  }

  it("sends a file under the field name the API validates", async () => {
    const file = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], "diagram.webp", {
      type: "image/webp",
    });

    await createMaterial(7, draft({ kind: "file", file, title: "Diagram" }));

    expect(upload).toHaveBeenCalledWith(
      "/admin/topics/7/materials",
      expect.any(FormData),
    );

    const form = sentForm();

    // `file`, not `upload` or `attachment`.
    expect(form.get("file")).toBe(file);
    expect(form.get("title")).toBe("Diagram");
    expect(form.get("kind")).toBe("file");
    // Booleans cross multipart as strings Laravel reads as booleans.
    expect(form.get("is_published")).toBe("1");
    // The kind decides which of the two is sent; never both.
    expect(form.has("url")).toBe(false);
  });

  it("sends a url material's address and no file part", async () => {
    await createMaterial(7, draft({ kind: "link" }));

    const form = sentForm();

    expect(form.get("url")).toBe("https://example.com/primer");
    expect(form.has("file")).toBe(false);
  });

  it("spoofs the method on an edit, because multipart does not survive PATCH", async () => {
    const file = new File(["PK"], "handout.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await updateMaterial(12, draft({ kind: "file", file }));

    expect(upload).toHaveBeenCalledWith("/admin/materials/12", expect.any(FormData));
    expect(sentForm().get("_method")).toBe("PATCH");
    expect(sentForm().get("file")).toBe(file);
  });
});

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

  it("accepts a video hosted somewhere other than YouTube", () => {
    // The API takes any http(s) address for a video, so refusing these here
    // rejected work the server would have accepted — a Google Drive recording
    // is the shape most of this material actually arrives in.
    for (const url of [
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing",
      "https://vimeo.com/123456789",
      "https://media.university.edu/lectures/subnetting.mp4",
    ]) {
      expect(
        validateDraft(draft({ kind: "video", url }), { isNew: true }),
      ).toEqual({});
    }
  });

  it("still refuses a video address a browser cannot open", () => {
    const errors = validateDraft(
      draft({ kind: "video", url: "javascript:alert(1)" }),
      { isNew: true },
    );

    expect(errors.url).toBeDefined();
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

describe("videoEmbedUrl", () => {
  it("builds a YouTube player address from any of its link shapes", () => {
    expect(videoEmbedUrl("https://youtu.be/abcdefghijk")).toBe(
      "https://www.youtube.com/embed/abcdefghijk",
    );
  });

  it("builds a Google Drive preview from a share link", () => {
    expect(
      videoEmbedUrl(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing",
      ),
    ).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview");
  });

  it("has no player to build for anywhere else, which is not an error", () => {
    // The material is still valid; the student opens it where it lives.
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBeNull();
    expect(videoEmbedUrl(null)).toBeNull();
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


/**
 * Which materials can be read in the page, and how one is fetched to be read.
 *
 * The rule is about what a browser can display, not about what an author
 * uploaded: a deck and a spreadsheet are perfectly good materials with nowhere
 * in a page to be shown, so they keep the download they always had.
 */

function fileMaterial(over: Partial<LearningMaterial> = {}): LearningMaterial {
  return {
    id: 1,
    topicId: 7,
    title: "Lab worksheet",
    description: null,
    kind: "file",
    kindLabel: "File",
    url: null,
    downloadUrl: "http://127.0.0.1:8000/api/materials/1/download",
    filename: "worksheet.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    order: 0,
    isPublished: true,
    ...over,
  };
}

describe("viewerFor", () => {
  it("shows a PDF in the page", () => {
    expect(viewerFor(fileMaterial())).toBe("pdf");
  });

  it("shows the image types the API accepts", () => {
    for (const mimeType of [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]) {
      expect(viewerFor(fileMaterial({ mimeType }))).toBe("image");
    }
  });

  it("reads a content type however it was cased", () => {
    expect(viewerFor(fileMaterial({ mimeType: "Application/PDF" }))).toBe("pdf");
  });

  it("has no viewer for the files a browser cannot display", () => {
    for (const mimeType of [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.ms-excel",
      "application/zip",
      "text/csv",
    ]) {
      expect(viewerFor(fileMaterial({ mimeType }))).toBeNull();
    }
  });

  it("has no viewer for a material with no recorded type", () => {
    expect(viewerFor(fileMaterial({ mimeType: null }))).toBeNull();
  });

  it("has no viewer for a link or a video", () => {
    const link = fileMaterial({
      kind: "link",
      url: "https://example.com/primer",
      downloadUrl: null,
      mimeType: null,
    });

    expect(viewerFor(link)).toBeNull();
    expect(viewerFor({ ...link, kind: "video" })).toBeNull();
  });
});

describe("openMaterial", () => {
  const objectUrls = { create: vi.fn(), revoke: vi.fn() };

  beforeEach(() => {
    objectUrls.create.mockReset().mockReturnValue("blob:netsim/1");
    objectUrls.revoke.mockReset();

    // Not present outside a browser, and the point of these is what the
    // service does with the blob rather than what a browser makes of it.
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: objectUrls.create,
      revokeObjectURL: objectUrls.revoke,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches through the API route, not a storage path", async () => {
    const download = vi
      .spyOn(api, "download")
      .mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));

    const opened = await openMaterial(fileMaterial());

    // The origin and /api prefix are the client's to add, and the private
    // storage path never appears at all.
    expect(download).toHaveBeenCalledWith("/materials/1/download");
    expect(opened.href).toBe("blob:netsim/1");
  });

  it("reports the type the response gave, not the type the row claimed", async () => {
    vi.spyOn(api, "download").mockResolvedValue(
      new Blob(["<html>"], { type: "text/html" }),
    );

    // The row says application/pdf. What actually arrived is what the caller
    // has to decide on, because that is what would be rendered.
    const opened = await openMaterial(fileMaterial());

    expect(opened.type).toBe("text/html");
  });

  it("hands back the means to release it", async () => {
    vi.spyOn(api, "download").mockResolvedValue(
      new Blob(["x"], { type: "image/png" }),
    );

    const opened = await openMaterial(fileMaterial({ mimeType: "image/png" }));

    expect(objectUrls.revoke).not.toHaveBeenCalled();

    opened.revoke();

    expect(objectUrls.revoke).toHaveBeenCalledWith("blob:netsim/1");
  });

  it("refuses a material that has no file", async () => {
    const download = vi.spyOn(api, "download");

    await expect(
      openMaterial(fileMaterial({ downloadUrl: null })),
    ).rejects.toThrow(/no file/i);

    expect(download).not.toHaveBeenCalled();
  });

  it("lets the server's refusal through", async () => {
    vi.spyOn(api, "download").mockRejectedValue(
      new Error("This action is unauthorized."),
    );

    await expect(openMaterial(fileMaterial())).rejects.toThrow(
      "This action is unauthorized.",
    );
  });
});
