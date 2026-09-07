// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MaterialList } from "./MaterialList";
import { ApiError } from "@/services/api";
import type { LearningMaterial } from "@/features/content/types";

/**
 * How a student meets a topic's materials.
 *
 * The API is stubbed at the module boundary rather than at fetch, so these say
 * what the component does with what the service returns — the service's own
 * mapping is covered by its tests, and the server's rules are covered by the
 * backend suite.
 */

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  // viewerFor stays real: which files can be shown is the rule under test.
  return { ...actual, downloadMaterial: vi.fn(), openMaterial: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { downloadMaterial, openMaterial } = await import(
  "@/features/content/materialService"
);
const { toast } = await import("sonner");

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

const fileMaterial = material({
  id: 2,
  title: "Lab worksheet",
  kind: "file",
  kindLabel: "File",
  url: null,
  downloadUrl: "http://127.0.0.1:8000/api/materials/2/download",
  filename: "worksheet.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
});

const videoMaterial = material({
  id: 3,
  title: "How a switch learns",
  kind: "video",
  kindLabel: "Video",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
});

const imageMaterial = material({
  id: 4,
  title: "Straight-through pinout",
  kind: "file",
  kindLabel: "File",
  url: null,
  downloadUrl: "http://127.0.0.1:8000/api/materials/4/download",
  filename: "pinout.png",
  mimeType: "image/png",
  sizeBytes: 40960,
});

const deckMaterial = material({
  id: 5,
  title: "Week 3 slides",
  kind: "file",
  kindLabel: "File",
  url: null,
  downloadUrl: "http://127.0.0.1:8000/api/materials/5/download",
  filename: "week-3.pptx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  sizeBytes: 1048576,
});

/** What openMaterial resolves to: bytes already in the tab, and their type. */
function opened(type: string) {
  return { href: `blob:netsim/${type}`, type, revoke: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks forgets calls but keeps implementations, and these are set
  // per test — a resolved value left behind would answer the next one.
  vi.mocked(openMaterial).mockReset();
  vi.mocked(downloadMaterial).mockReset();
});

afterEach(cleanup);

describe("MaterialList", () => {
  it("renders each material with its title and type", () => {
    render(
      <MaterialList materials={[material(), fileMaterial, videoMaterial]} />,
    );

    expect(screen.getByText("Subnetting primer")).toBeInTheDocument();
    expect(screen.getByText("Lab worksheet")).toBeInTheDocument();
    expect(screen.getByText("How a switch learns")).toBeInTheDocument();

    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("keeps the order it was given", () => {
    render(
      <MaterialList materials={[videoMaterial, material(), fileMaterial]} />,
    );

    const headings = screen.getAllByRole("heading", { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "How a switch learns",
      "Subnetting primer",
      "Lab worksheet",
    ]);
  });

  it("shows a description when the author wrote one", () => {
    render(
      <MaterialList
        materials={[material({ description: "Where addresses come from." })]}
      />,
    );

    expect(screen.getByText("Where addresses come from.")).toBeInTheDocument();
  });

  describe("a link", () => {
    it("opens in a new tab, without opener access", async () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);

      render(<MaterialList materials={[material()]} />);

      await userEvent.click(screen.getByRole("button", { name: /open link/i }));

      expect(open).toHaveBeenCalledWith(
        "https://example.com/primer",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  describe("a video", () => {
    it("embeds the player rather than only linking out", () => {
      const { container } = render(<MaterialList materials={[videoMaterial]} />);

      const frame = container.querySelector("iframe");

      expect(frame).not.toBeNull();
      expect(frame?.getAttribute("src")).toBe(
        "https://www.youtube.com/embed/abcdefghijk",
      );
    });

    it("still offers the original link", async () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);

      render(<MaterialList materials={[videoMaterial]} />);

      await userEvent.click(
        screen.getByRole("button", { name: /watch on youtube/i }),
      );

      expect(open).toHaveBeenCalledWith(
        videoMaterial.url,
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  describe("a file", () => {
    it("names the file and its size", () => {
      render(<MaterialList materials={[fileMaterial]} />);

      expect(screen.getByText(/worksheet\.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    });

    it("downloads through the API rather than linking to storage", async () => {
      const { container } = render(<MaterialList materials={[fileMaterial]} />);

      // The private path must not reach the page at all: an anchor to it would
      // be a link the browser could follow without the caller's token, and
      // there is no such URL to follow.
      expect(container.querySelector("a[href]")).toBeNull();
      expect(container.innerHTML).not.toContain("learning-materials/");

      await userEvent.click(screen.getByRole("button", { name: /download/i }));

      expect(downloadMaterial).toHaveBeenCalledWith(fileMaterial);
    });

    it("says so when the download is refused", async () => {
      vi.mocked(downloadMaterial).mockRejectedValueOnce(
        new Error("This action is unauthorized."),
      );

      render(<MaterialList materials={[fileMaterial]} />);

      await userEvent.click(screen.getByRole("button", { name: /download/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });
  });

  /*
   * Reading a file in the page.
   *
   * A picture and a PDF can be read here; everything else keeps the download it
   * always had. Nothing is fetched until somebody asks for it, and what comes
   * back is released when they are done — a topic of twenty handouts should
   * cost nothing to open.
   */
  describe("viewing a file in the page", () => {
    it("offers to show a picture", () => {
      render(<MaterialList materials={[imageMaterial]} />);

      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
      // The download is an addition, not a replacement.
      expect(
        screen.getByRole("button", { name: /download/i }),
      ).toBeInTheDocument();
    });

    it("offers to show a PDF", () => {
      render(<MaterialList materials={[fileMaterial]} />);

      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    });

    it("offers no viewer for a slide deck", () => {
      render(<MaterialList materials={[deckMaterial]} />);

      // Nothing a browser ships can show a deck, so it is download-only.
      expect(screen.queryByRole("button", { name: "View" })).toBeNull();
      expect(
        screen.getByRole("button", { name: /download/i }),
      ).toBeInTheDocument();
    });

    it("offers no viewer for a link or a video", () => {
      render(<MaterialList materials={[material(), videoMaterial]} />);

      expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    });

    it("fetches nothing until it is asked to", () => {
      render(<MaterialList materials={[imageMaterial, fileMaterial]} />);

      expect(openMaterial).not.toHaveBeenCalled();
    });

    it("shows a picture through the API, not a storage path", async () => {
      vi.mocked(openMaterial).mockResolvedValue(opened("image/png"));

      const { container } = render(<MaterialList materials={[imageMaterial]} />);

      await userEvent.click(screen.getByRole("button", { name: "View" }));

      const image = await screen.findByRole("img", {
        name: imageMaterial.title,
      });

      expect(openMaterial).toHaveBeenCalledWith(imageMaterial);
      expect(image).toHaveAttribute("src", "blob:netsim/image/png");
      // The private path must never reach the page, viewer or not.
      expect(container.innerHTML).not.toContain("learning-materials/");
    });

    it("shows a PDF in a sandboxed frame", async () => {
      vi.mocked(openMaterial).mockResolvedValue(opened("application/pdf"));

      const { container } = render(<MaterialList materials={[fileMaterial]} />);

      await userEvent.click(screen.getByRole("button", { name: "View" }));

      await waitFor(() =>
        expect(container.querySelector("iframe")).not.toBeNull(),
      );

      const frame = container.querySelector("iframe")!;

      expect(frame).toHaveAttribute("src", "blob:netsim/application/pdf");
      // An address made from a blob carries this page's origin, so whatever
      // goes in a frame is sandboxed out of it.
      expect(frame).toHaveAttribute("sandbox", "");
    });

    it("refuses to frame a file that did not arrive as a PDF", async () => {
      const response = opened("text/html");
      vi.mocked(openMaterial).mockResolvedValue(response);

      const { container } = render(<MaterialList materials={[fileMaterial]} />);

      await userEvent.click(screen.getByRole("button", { name: "View" }));

      // The row said PDF and the response did not. The response is what is
      // about to be rendered, so the response is what decides.
      expect(await screen.findByText(/did not arrive as a PDF/)).toBeInTheDocument();
      expect(container.querySelector("iframe")).toBeNull();
      expect(response.revoke).toHaveBeenCalled();
    });

    it("says while it is opening", async () => {
      let settle: (value: ReturnType<typeof opened>) => void = () => {};
      vi.mocked(openMaterial).mockReturnValue(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );

      render(<MaterialList materials={[imageMaterial]} />);
      await userEvent.click(screen.getByRole("button", { name: "View" }));

      expect(screen.getByText(/Opening/)).toBeInTheDocument();

      settle(opened("image/png"));

      await screen.findByRole("img", { name: imageMaterial.title });
      expect(screen.queryByText(/Opening/)).toBeNull();
    });

    it("says what went wrong, in the server's own words", async () => {
      vi.mocked(openMaterial).mockRejectedValue(
        new ApiError("This action is unauthorized.", 403),
      );

      render(<MaterialList materials={[imageMaterial]} />);
      await userEvent.click(screen.getByRole("button", { name: "View" }));

      // A topic can be withdrawn while a student has it open.
      expect(
        await screen.findByText("This action is unauthorized."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("releases the file when the viewer is closed", async () => {
      const response = opened("image/png");
      vi.mocked(openMaterial).mockResolvedValue(response);

      render(<MaterialList materials={[imageMaterial]} />);

      await userEvent.click(screen.getByRole("button", { name: "View" }));
      await screen.findByRole("img", { name: imageMaterial.title });

      await userEvent.click(screen.getByRole("button", { name: /hide/i }));

      expect(screen.queryByRole("img", { name: imageMaterial.title })).toBeNull();
      // An object URL outlives the document unless it is let go of.
      expect(response.revoke).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    });
  });
});
