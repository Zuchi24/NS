// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { MaterialList } from "./MaterialList";
import { fetchTopicMaterials } from "@/features/content/materialService";
import { ApiError } from "@/services/api";
import { useAsync } from "@/services/useAsync";
import type { LearningMaterial } from "@/features/content/types";

/**
 * The materials card as the topic page assembles it: loading, then either the
 * list, an empty state, or the locked state that a 403 means.
 *
 * The page itself is behind a router, an auth context and three other
 * requests; this stands the same pieces up around the real loader so the
 * states are asserted without dragging all of that in.
 */

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return { ...actual, fetchTopicMaterials: vi.fn(), downloadMaterial: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/** The same shape the topic page uses: a 403 is a locked topic, not an error. */
function MaterialsCard({ topicId }: { topicId: number }) {
  const { data, error, loading } = useAsync(async () => {
    try {
      return { locked: false as const, materials: await fetchTopicMaterials(topicId) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        return { locked: true as const };
      }

      throw e;
    }
  }, [topicId]);

  if (loading) return <p>Loading topic…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return null;

  if (data.locked) return <p>This topic is locked.</p>;

  return (
    <section>
      <h2>Learning Materials</h2>
      {data.materials.length === 0 ? (
        <p>No learning materials for this topic yet.</p>
      ) : (
        <MaterialList materials={data.materials} />
      )}
    </section>
  );
}

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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("the topic page materials card", () => {
  it("shows a loading state first", () => {
    vi.mocked(fetchTopicMaterials).mockReturnValue(new Promise(() => {}));

    render(<MaterialsCard topicId={7} />);

    expect(screen.getByText(/loading topic/i)).toBeInTheDocument();
  });

  it("renders the topic materials once they arrive", async () => {
    vi.mocked(fetchTopicMaterials).mockResolvedValue([
      material({ title: "Subnetting primer" }),
      material({ id: 2, title: "Lab worksheet", kind: "file", kindLabel: "File", url: null, downloadUrl: "http://x/api/materials/2/download", filename: "w.pdf" }),
    ]);

    render(<MaterialsCard topicId={7} />);

    expect(await screen.findByText("Subnetting primer")).toBeInTheDocument();
    expect(screen.getByText("Lab worksheet")).toBeInTheDocument();
    expect(fetchTopicMaterials).toHaveBeenCalledWith(7);
  });

  it("shows an empty state for a topic with no materials", async () => {
    vi.mocked(fetchTopicMaterials).mockResolvedValue([]);

    render(<MaterialsCard topicId={7} />);

    // The old page said "No learning materials uploaded yet" whatever the API
    // held, because it never asked. This one asked and got nothing.
    expect(
      await screen.findByText(/no learning materials for this topic yet/i),
    ).toBeInTheDocument();
  });

  it("shows the locked state rather than an error when the API refuses", async () => {
    vi.mocked(fetchTopicMaterials).mockRejectedValue(
      new ApiError("This action is unauthorized.", 403),
    );

    render(<MaterialsCard topicId={7} />);

    expect(await screen.findByText(/this topic is locked/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error state when the request genuinely fails", async () => {
    vi.mocked(fetchTopicMaterials).mockRejectedValue(
      new ApiError("Cannot reach the server.", 0),
    );

    render(<MaterialsCard topicId={7} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /cannot reach the server/i,
      ),
    );
  });
});
