// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopicMaterialsPanel } from "./TopicMaterialsPanel";
import { ApiError } from "@/services/api";
import type { LearningMaterial } from "@/features/content/types";

/**
 * Authoring a topic's materials.
 *
 * The service is stubbed, so these say what the panel asks the API for and
 * what it does with the answer. The real validation rules are kept — the point
 * of several of these is that a bad draft never reaches the network.
 */

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return {
    ...actual,
    fetchTopicMaterials: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    reorderMaterials: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/content/materialService");

function material(over: Partial<LearningMaterial> = {}): LearningMaterial {
  return {
    id: 1,
    topicId: 7,
    title: "Subnetting primer",
    description: null,
    kind: "link",
    kindLabel: "Link",
    url: "https://example.com/primer",
    downloadUrl: null,
    filename: null,
    mimeType: null,
    sizeBytes: null,
    order: 0,
    isPublished: true,
    ...over,
  };
}

const first = material({ id: 1, title: "First up", order: 0 });
const second = material({ id: 2, title: "Second up", order: 1 });

/** Renders with a resolved list and waits for the loading state to clear. */
async function renderWith(materials: LearningMaterial[]) {
  vi.mocked(service.fetchTopicMaterials).mockResolvedValue(materials);

  const result = render(<TopicMaterialsPanel topicId={7} />);

  await waitFor(() =>
    expect(screen.queryByText(/loading materials/i)).not.toBeInTheDocument(),
  );

  return result;
}

/**
 * The form's own submit button.
 *
 * Scoped to the form: the header's "Add material" button carries the same
 * words, which is right on screen — one opens the form, one commits it — and
 * ambiguous only to a query that ignores where it is.
 */
function submitButton(name: RegExp) {
  return within(screen.getByRole("form")).getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("TopicMaterialsPanel", () => {
  it("shows a loading state while the first request is in flight", () => {
    vi.mocked(service.fetchTopicMaterials).mockReturnValue(new Promise(() => {}));

    render(<TopicMaterialsPanel topicId={7} />);

    expect(screen.getByText(/loading materials/i)).toBeInTheDocument();
  });

  it("shows an error state with a retry when the request fails", async () => {
    vi.mocked(service.fetchTopicMaterials).mockRejectedValueOnce(
      new Error("Cannot reach the server."),
    );

    render(<TopicMaterialsPanel topicId={7} />);

    await waitFor(() =>
      expect(screen.getByText("Cannot reach the server.")).toBeInTheDocument(),
    );

    vi.mocked(service.fetchTopicMaterials).mockResolvedValue([first]);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText("First up")).toBeInTheDocument(),
    );
  });

  it("shows an empty state when the topic has no materials", async () => {
    await renderWith([]);

    expect(screen.getByText(/no materials yet/i)).toBeInTheDocument();
  });

  it("lists the topic materials in the order the API returned", async () => {
    await renderWith([first, second]);

    const items = screen.getAllByRole("listitem");

    expect(within(items[0]).getByText("First up")).toBeInTheDocument();
    expect(within(items[1]).getByText("Second up")).toBeInTheDocument();
    expect(service.fetchTopicMaterials).toHaveBeenCalledWith(7);
  });

  it("marks an unpublished material as a draft", async () => {
    await renderWith([material({ isPublished: false })]);

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  describe("the form", () => {
    it("opens when Add material is clicked", async () => {
      await renderWith([]);

      expect(screen.queryByRole("form")).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );

      expect(
        screen.getByRole("form", { name: /add material/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it("offers exactly the three kinds the API accepts", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );

      const options = within(
        screen.getByLabelText(/type/i),
      ).getAllByRole("option");

      expect(options.map((option) => option.textContent)).toEqual([
        "Video",
        "Link",
        "File",
      ]);
    });

    it("swaps the address field for a file picker when the kind is file", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );

      expect(screen.getByLabelText(/web address/i)).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");

      expect(screen.queryByLabelText(/web address/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^file$/i)).toBeInTheDocument();
    });

    it("refuses to send a draft with no title", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(
        screen.getByLabelText(/web address/i),
        "https://example.com",
      );
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
      expect(service.createMaterial).not.toHaveBeenCalled();
    });

    it("refuses an address that is not http or https", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Dodgy");
      await userEvent.type(
        screen.getByLabelText(/web address/i),
        "javascript:alert(1)",
      );
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(/http/i);
      expect(service.createMaterial).not.toHaveBeenCalled();
    });

    it("takes a video hosted somewhere other than YouTube", async () => {
      // The API accepts any http(s) address for a video, and a Google Drive
      // share link is how most of this material arrives. Refusing it here
      // rejected work the server would have taken.
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Recorded lecture");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "video");
      await userEvent.type(
        screen.getByLabelText(/video address/i),
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view",
      );
      await userEvent.click(submitButton(/^add material$/i));

      await waitFor(() => expect(service.createMaterial).toHaveBeenCalled());

      expect(vi.mocked(service.createMaterial).mock.calls[0][1]).toMatchObject({
        kind: "video",
        url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view",
      });
    });

    it("still refuses a video address a browser cannot open", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Not a video");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "video");
      await userEvent.type(
        screen.getByLabelText(/video address/i),
        "javascript:alert(1)",
      );
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(/http/i);
      expect(service.createMaterial).not.toHaveBeenCalled();
    });

    it("refuses a file material with nothing chosen", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Handout");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(/choose a file/i);
      expect(service.createMaterial).not.toHaveBeenCalled();
    });

    it("sends a valid link and reloads the list", async () => {
      await renderWith([]);

      vi.mocked(service.createMaterial).mockResolvedValueOnce(first);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "RFC 1918");
      await userEvent.type(
        screen.getByLabelText(/web address/i),
        "https://datatracker.ietf.org/doc/html/rfc1918",
      );
      await userEvent.click(submitButton(/^add material$/i));

      await waitFor(() =>
        expect(service.createMaterial).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            title: "RFC 1918",
            kind: "link",
            url: "https://datatracker.ietf.org/doc/html/rfc1918",
          }),
        ),
      );

      // Two loads: the first render, and the reload after saving.
      await waitFor(() =>
        expect(service.fetchTopicMaterials).toHaveBeenCalledTimes(2),
      );
    });

    it("uploads a chosen file", async () => {
      await renderWith([]);

      vi.mocked(service.createMaterial).mockResolvedValueOnce(first);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Worksheet");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");

      const file = new File(["hello"], "worksheet.pdf", {
        type: "application/pdf",
      });

      await userEvent.upload(screen.getByLabelText(/^file$/i), file);
      await userEvent.click(submitButton(/^add material$/i));

      await waitFor(() =>
        expect(service.createMaterial).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ kind: "file", file }),
        ),
      );
    });

    it("uploads an image, which is a file like any other", async () => {
      await renderWith([]);

      vi.mocked(service.createMaterial).mockResolvedValueOnce(first);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Topology diagram");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");

      // WebP and Word documents are what the upload bug refused; both go the
      // same way as the PDF above, and nothing about the kind is special. The
      // bytes are a RIFF header, which is what the server reads to decide.
      const image = new File(
        [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
        "diagram.webp",
        { type: "image/webp" },
      );

      await userEvent.upload(screen.getByLabelText(/^file$/i), image);
      await userEvent.click(submitButton(/^add material$/i));

      await waitFor(() =>
        expect(service.createMaterial).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ kind: "file", file: image }),
        ),
      );
    });

    it("uploads a word document", async () => {
      await renderWith([]);

      vi.mocked(service.createMaterial).mockResolvedValueOnce(first);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Lab handout");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");

      const doc = new File(["PK"], "handout.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      await userEvent.upload(screen.getByLabelText(/^file$/i), doc);
      await userEvent.click(submitButton(/^add material$/i));

      await waitFor(() =>
        expect(service.createMaterial).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ kind: "file", file: doc }),
        ),
      );
    });

    it("refuses a file over the limit before sending it anywhere", async () => {
      await renderWith([]);

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Enormous");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");

      const huge = new File(["x"], "video.png", { type: "image/png" });

      // A real 30 MB file cannot be built in a test and does not need to be:
      // what is checked is the size the browser reports.
      Object.defineProperty(huge, "size", { value: 30 * 1024 * 1024 });

      await userEvent.upload(screen.getByLabelText(/^file$/i), huge);
      await userEvent.click(submitButton(/^add material$/i));

      // The size it is, the size allowed, and what to do instead — rather than
      // a minute spent uploading something that was never going to be taken.
      const alert = await screen.findByRole("alert");

      expect(alert).toHaveTextContent(/30 MB/);
      expect(alert).toHaveTextContent(/20 MB/);
      expect(service.createMaterial).not.toHaveBeenCalled();
    });

    it("shows what the server says when it is the one refusing the size", async () => {
      await renderWith([]);

      // Under the app's own ceiling, so the client sends it — and PHP's limit,
      // which only the server knows, turns it back. The message names the size
      // that server actually accepts rather than failing generically.
      vi.mocked(service.createMaterial).mockRejectedValueOnce(
        new ApiError("That file is larger than 2 MB.", 422, {
          file: [
            "That file is larger than 2 MB, which is the most this server " +
              "accepts. Compress it, or add it as a link instead.",
          ],
        }),
      );

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Photo");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");
      await userEvent.upload(
        screen.getByLabelText(/^file$/i),
        new File(["x"], "photo.jpg", { type: "image/jpeg" }),
      );
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /larger than 2 MB, which is the most this server accepts/i,
      );
    });

    it("shows the server's own field errors when it rejects the draft", async () => {
      await renderWith([]);

      // The client's rules are a courtesy; the server is the authority, and
      // what it objects to has to reach the field it objected about.
      vi.mocked(service.createMaterial).mockRejectedValueOnce(
        new ApiError("The given data was invalid.", 422, {
          file: ["The file field must be a file of type: pdf, docx."],
        }),
      );

      await userEvent.click(
        screen.getByRole("button", { name: /add material/i }),
      );
      await userEvent.type(screen.getByLabelText(/title/i), "Handout");
      await userEvent.selectOptions(screen.getByLabelText(/type/i), "file");
      await userEvent.upload(
        screen.getByLabelText(/^file$/i),
        new File(["x"], "payload.exe"),
      );
      await userEvent.click(submitButton(/^add material$/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /must be a file of type/i,
      );
    });

    it("opens prefilled when editing, and saves an update", async () => {
      await renderWith([first]);

      vi.mocked(service.updateMaterial).mockResolvedValueOnce(first);

      await userEvent.click(
        screen.getByRole("button", { name: /edit first up/i }),
      );

      const title = screen.getByLabelText(/title/i);

      expect(title).toHaveValue("First up");

      await userEvent.clear(title);
      await userEvent.type(title, "Renamed");
      await userEvent.click(submitButton(/save changes/i));

      await waitFor(() =>
        expect(service.updateMaterial).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ title: "Renamed" }),
        ),
      );
    });
  });

  describe("deleting", () => {
    it("asks before removing, and does nothing if cancelled", async () => {
      await renderWith([first]);

      await userEvent.click(
        screen.getByRole("button", { name: /delete first up/i }),
      );

      expect(screen.getByText(/delete this material\?/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

      expect(service.deleteMaterial).not.toHaveBeenCalled();
    });

    it("removes the material once confirmed and reloads", async () => {
      await renderWith([first]);

      vi.mocked(service.deleteMaterial).mockResolvedValueOnce(undefined);

      await userEvent.click(
        screen.getByRole("button", { name: /delete first up/i }),
      );
      await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => expect(service.deleteMaterial).toHaveBeenCalledWith(1));
      await waitFor(() =>
        expect(service.fetchTopicMaterials).toHaveBeenCalledTimes(2),
      );
    });
  });

  describe("ordering", () => {
    it("cannot move the first material up or the last one down", async () => {
      await renderWith([first, second]);

      expect(
        screen.getByRole("button", { name: /move first up up/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /move second up down/i }),
      ).toBeDisabled();
    });

    it("sends the whole new order when a material is moved down", async () => {
      await renderWith([first, second]);

      vi.mocked(service.reorderMaterials).mockResolvedValueOnce([second, first]);

      await userEvent.click(
        screen.getByRole("button", { name: /move first up down/i }),
      );

      // The complete list, not a moved pair — so what is stored is the order
      // the author was looking at.
      await waitFor(() =>
        expect(service.reorderMaterials).toHaveBeenCalledWith(7, [2, 1]),
      );
    });

    it("sends the whole new order when a material is moved up", async () => {
      await renderWith([first, second]);

      vi.mocked(service.reorderMaterials).mockResolvedValueOnce([second, first]);

      await userEvent.click(
        screen.getByRole("button", { name: /move second up up/i }),
      );

      await waitFor(() =>
        expect(service.reorderMaterials).toHaveBeenCalledWith(7, [2, 1]),
      );
    });
  });
});
