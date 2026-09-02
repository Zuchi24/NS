// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoadmapPanel } from "./RoadmapPanel";
import { ApiError } from "@/services/api";
import type { Roadmap } from "@/features/content/types";

/**
 * Managing the roadmaps themselves.
 *
 * The service is stubbed, so these say what the panel asks the API for and what
 * it does with the answer. The two that matter most are the pair the API keeps
 * apart: unpublishing withdraws a roadmap and keeps every student's history,
 * deleting takes the rows — and when the server refuses a delete because that
 * history exists, the author has to be told why, in the server's own words,
 * with the roadmap still in front of them.
 */

vi.mock("@/features/content/roadmapService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/roadmapService")
  >();

  return {
    ...actual,
    createRoadmap: vi.fn(),
    updateRoadmap: vi.fn(),
    publishRoadmap: vi.fn(),
    unpublishRoadmap: vi.fn(),
    deleteRoadmap: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/content/roadmapService");
const { toast } = await import("sonner");

function roadmap(over: Partial<Roadmap> = {}): Roadmap {
  return {
    id: 1,
    title: "Networking Basics",
    description: "Where everyone starts.",
    order: 0,
    isPublished: true,
    topics: [],
    ...over,
  };
}

const published = roadmap();

const draft = roadmap({
  id: 2,
  title: "Wireless Networking",
  description: "Still being written.",
  order: 1,
  isPublished: false,
});

/** Renders the panel over a catalogue, showing one of its roadmaps. */
function renderPanel(
  roadmaps: Roadmap[],
  showing: Roadmap | null = roadmaps[0] ?? null,
) {
  const onSelect = vi.fn();
  const onChanged = vi.fn();

  render(
    <RoadmapPanel
      roadmaps={roadmaps}
      roadmap={showing}
      onSelect={onSelect}
      onChanged={onChanged}
    />,
  );

  return { onSelect, onChanged };
}

/** The form's own submit button, scoped so the header's does not match it. */
function submitButton(name: RegExp) {
  return within(screen.getByRole("form")).getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("status", () => {
  it("marks the roadmap in view as published", () => {
    renderPanel([published]);

    expect(screen.getByText(/^published$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^draft$/i)).not.toBeInTheDocument();
  });

  it("marks a draft, and says what being a draft means", () => {
    renderPanel([published, draft], draft);

    expect(screen.getByText(/^draft$/i)).toBeInTheDocument();
    expect(screen.getByText(/students cannot see it/i)).toBeInTheDocument();
  });

  it("names the drafts among the roadmaps that are not in view", () => {
    // A native select shows only the chosen row when closed, so the option text
    // has to carry the mark as well as the badge beside the title.
    renderPanel([published, draft]);

    expect(
      screen.getByRole("option", { name: "Networking Basics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Wireless Networking (draft)" }),
    ).toBeInTheDocument();
  });

  it("offers to add the first roadmap rather than saying nothing can be done", () => {
    renderPanel([], null);

    expect(screen.getByText(/no roadmaps yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new roadmap/i }),
    ).toBeInTheDocument();
  });
});

describe("creating", () => {
  it("adds a roadmap and shows the one just added", async () => {
    const created = roadmap({ id: 9, title: "Network Security" });

    vi.mocked(service.createRoadmap).mockResolvedValueOnce(created);

    const { onChanged } = renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /new roadmap/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Network Security");
    await userEvent.type(
      screen.getByLabelText(/description/i),
      "Firewalls and access control.",
    );
    await userEvent.click(submitButton(/^add roadmap$/i));

    await waitFor(() =>
      expect(service.createRoadmap).toHaveBeenCalledWith({
        title: "Network Security",
        description: "Firewalls and access control.",
      }),
    );

    // The author lands on what they just made, not back on the first roadmap.
    expect(onChanged).toHaveBeenCalledWith(9);
  });

  it("can add the first roadmap into an empty catalogue", async () => {
    vi.mocked(service.createRoadmap).mockResolvedValueOnce(
      roadmap({ id: 3, title: "Networking Basics", isPublished: false }),
    );

    const { onChanged } = renderPanel([], null);

    await userEvent.click(screen.getByRole("button", { name: /new roadmap/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Networking Basics");
    await userEvent.click(submitButton(/^add roadmap$/i));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(3));
  });

  it("refuses to send a roadmap with no title", async () => {
    renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /new roadmap/i }));
    await userEvent.click(submitButton(/^add roadmap$/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(service.createRoadmap).not.toHaveBeenCalled();
  });

  it("puts the server's own complaint under the field it named", async () => {
    vi.mocked(service.createRoadmap).mockRejectedValueOnce(
      new ApiError("Invalid.", 422, { title: ["That title is taken."] }),
    );

    renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /new roadmap/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Networking Basics");
    await userEvent.click(submitButton(/^add roadmap$/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That title is taken.",
    );
  });
});

describe("editing", () => {
  it("opens prefilled and saves the whole draft", async () => {
    vi.mocked(service.updateRoadmap).mockResolvedValueOnce(
      roadmap({ title: "Networking Foundations" }),
    );

    const { onChanged } = renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /edit details/i }));

    const title = screen.getByLabelText(/title/i);

    expect(title).toHaveValue("Networking Basics");

    await userEvent.clear(title);
    await userEvent.type(title, "Networking Foundations");
    await userEvent.click(submitButton(/^save changes$/i));

    await waitFor(() =>
      expect(service.updateRoadmap).toHaveBeenCalledWith(1, {
        title: "Networking Foundations",
        description: "Where everyone starts.",
      }),
    );

    expect(onChanged).toHaveBeenCalledWith(1);
  });

  it("does not offer publishing as a field on the edit form", async () => {
    // Releasing a roadmap is its own action, and the API ignores the flag on an
    // update — a checkbox here would look like it worked and do nothing.
    renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /edit details/i }));

    expect(
      within(screen.getByRole("form")).queryByRole("checkbox"),
    ).not.toBeInTheDocument();
  });
});

describe("publishing", () => {
  it("publishes a draft and keeps it in view", async () => {
    vi.mocked(service.publishRoadmap).mockResolvedValueOnce(
      roadmap({ id: 2, isPublished: true }),
    );

    const { onChanged } = renderPanel([published, draft], draft);

    await userEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() => expect(service.publishRoadmap).toHaveBeenCalledWith(2));

    expect(onChanged).toHaveBeenCalledWith(2);
  });

  it("unpublishes a released roadmap", async () => {
    vi.mocked(service.unpublishRoadmap).mockResolvedValueOnce(
      roadmap({ isPublished: false }),
    );

    const { onChanged } = renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /unpublish/i }));

    await waitFor(() =>
      expect(service.unpublishRoadmap).toHaveBeenCalledWith(1),
    );

    expect(onChanged).toHaveBeenCalledWith(1);
  });

  it("offers only the one of the pair that applies", () => {
    renderPanel([published]);

    expect(
      screen.getByRole("button", { name: /unpublish/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^publish$/i }),
    ).not.toBeInTheDocument();
  });
});

describe("deleting", () => {
  it("asks before deleting, and says what goes with it", async () => {
    renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByText(/their learning materials/i)).toBeInTheDocument();
    expect(service.deleteRoadmap).not.toHaveBeenCalled();
  });

  it("deletes once confirmed and shows no roadmap afterwards", async () => {
    vi.mocked(service.deleteRoadmap).mockResolvedValueOnce(undefined);

    const { onChanged } = renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /delete roadmap/i }),
    );

    await waitFor(() => expect(service.deleteRoadmap).toHaveBeenCalledWith(1));

    // Null, not the deleted id: the page falls back to whatever is left.
    expect(onChanged).toHaveBeenCalledWith(null);
  });

  it("keeps the roadmap when the confirmation is cancelled", async () => {
    renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.queryByRole("button", { name: /delete roadmap/i }),
    ).not.toBeInTheDocument();
    expect(service.deleteRoadmap).not.toHaveBeenCalled();
  });

  it("shows the server's reason when student history blocks the delete", async () => {
    // The API answers 409 with the explanation, and it is a better one than
    // this panel could invent: the roadmap is unpublished rather than erased.
    vi.mocked(service.deleteRoadmap).mockRejectedValueOnce(
      new ApiError(
        "This roadmap has student history. Unpublish it instead of deleting it.",
        409,
      ),
    );

    const { onChanged } = renderPanel([published]);

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /delete roadmap/i }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This roadmap has student history. Unpublish it instead of deleting it.",
      ),
    );

    // Nothing was removed, so nothing is reloaded and the roadmap stays in view.
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText(/^published$/i)).toBeInTheDocument();
  });
});

describe("selecting", () => {
  it("hands the chosen roadmap back to the page", async () => {
    const { onSelect } = renderPanel([published, draft]);

    await userEvent.selectOptions(screen.getByLabelText(/authoring/i), "2");

    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
