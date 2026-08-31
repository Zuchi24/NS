// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MaterialList } from "./MaterialList";
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

  return { ...actual, downloadMaterial: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { downloadMaterial } = await import("@/features/content/materialService");
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

beforeEach(() => {
  vi.clearAllMocks();
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
});
