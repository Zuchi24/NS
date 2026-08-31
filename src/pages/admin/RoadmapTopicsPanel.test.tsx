// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoadmapTopicsPanel } from "./RoadmapTopicsPanel";
import { ApiError } from "@/services/api";
import type { Topic } from "@/features/content/types";

/**
 * Authoring a roadmap's topics.
 *
 * The service is stubbed, so these say what the panel asks the API for and what
 * it does with the answer. The real validation rules are kept — the point of
 * several of these is that a bad draft never reaches the network.
 *
 * The reorder tests matter more than they look: a topic's position decides
 * which topics unlock after it, so sending the wrong list would move students'
 * unlock chain rather than merely redrawing a list.
 */

vi.mock("@/features/content/topicService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/topicService")
  >();

  return {
    ...actual,
    createTopic: vi.fn(),
    updateTopic: vi.fn(),
    deleteTopic: vi.fn(),
    reorderTopics: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/content/topicService");

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 4,
    title: "Hardware and Cabling",
    description: "Building a machine and making a cable.",
    videoUrl: null,
    order: 0,
    challengesCount: 2,
    progress: null,
    ...over,
  };
}

const first = topic({ id: 1, title: "First up", order: 0 });
const second = topic({ id: 2, title: "Second up", order: 1 });
const third = topic({ id: 3, title: "Third up", order: 2 });

const onChanged = vi.fn();
const onSelect = vi.fn();

function renderWith(topics: Topic[], selectedTopicId: number | null = null) {
  return render(
    <RoadmapTopicsPanel
      roadmapId={4}
      roadmapTitle="Networking Essentials"
      topics={topics}
      selectedTopicId={selectedTopicId}
      onSelect={onSelect}
      onChanged={onChanged}
    />,
  );
}

/**
 * The form's own submit button.
 *
 * Scoped to the form: the header's "Add topic" button carries the same words,
 * which is right on screen — one opens the form, one commits it — and ambiguous
 * only to a query that ignores where it is.
 */
function submitButton(name: RegExp) {
  return within(screen.getByRole("form")).getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("RoadmapTopicsPanel", () => {
  it("says the roadmap has no topics yet when the list is empty", () => {
    renderWith([]);

    expect(screen.getByText(/no topics yet/i)).toBeInTheDocument();
  });

  it("lists the topics with their position in the roadmap", () => {
    renderWith([first, second, third]);

    expect(screen.getByText("First up")).toBeInTheDocument();
    expect(screen.getByText("Third up")).toBeInTheDocument();

    // The position is shown, not left to be inferred: it is what decides which
    // topics unlock after which.
    expect(screen.getByText(/position 1/i)).toBeInTheDocument();
    expect(screen.getByText(/position 3/i)).toBeInTheDocument();
  });

  it("counts the challenges placed in each topic", () => {
    renderWith([topic({ challengesCount: 1 })]);

    expect(screen.getByText(/1 challenge$/i)).toBeInTheDocument();
  });

  /*
   * Creating
   */

  it("creates a topic from the form", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.type(
      screen.getByLabelText(/description/i),
      "Splitting a network up.",
    );
    await user.click(submitButton(/add topic/i));

    expect(service.createTopic).toHaveBeenCalledWith(4, {
      title: "Subnetting",
      description: "Splitting a network up.",
      videoUrl: "",
    });

    // The page reloads from the server rather than this panel patching a local
    // copy, so what is on screen is what was actually stored.
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not send a topic with no title", async () => {
    const user = userEvent.setup();

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.click(submitButton(/add topic/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /give the topic a title/i,
    );
    expect(service.createTopic).not.toHaveBeenCalled();
  });

  it("does not send a video link that is not an http address", async () => {
    const user = userEvent.setup();

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Dodgy");
    await user.type(
      screen.getByLabelText(/headline video/i),
      "javascript:alert(1)",
    );
    await user.click(submitButton(/add topic/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /must start with http/i,
    );
    expect(service.createTopic).not.toHaveBeenCalled();
  });

  it("shows the server's own message against the field it rejected", async () => {
    const user = userEvent.setup();

    vi.mocked(service.createTopic).mockRejectedValueOnce(
      new ApiError("Unprocessable", 422, {
        ytube_link: ["The address must start with http:// or https://."],
      }),
    );

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Passes here, fails there");
    await user.click(submitButton(/add topic/i));

    // The API names the column; the message is put back under the box that
    // carries it rather than shown as a bare toast.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /must start with http/i,
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  /*
   * Editing
   */

  it("opens the edit form filled in with the topic", async () => {
    const user = userEvent.setup();

    renderWith([topic({ title: "Before", videoUrl: "https://example.com/v" })]);

    await user.click(screen.getByRole("button", { name: /edit before/i }));

    expect(screen.getByLabelText(/title/i)).toHaveValue("Before");
    expect(screen.getByLabelText(/headline video/i)).toHaveValue(
      "https://example.com/v",
    );
  });

  it("saves an edit", async () => {
    const user = userEvent.setup();
    vi.mocked(service.updateTopic).mockResolvedValue(first);

    renderWith([topic({ id: 9, title: "Before" })]);

    await user.click(screen.getByRole("button", { name: /edit before/i }));
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), "After");
    await user.click(submitButton(/save changes/i));

    expect(service.updateTopic).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ title: "After" }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  /*
   * Deleting
   */

  it("asks before deleting, and says what goes with the topic", async () => {
    const user = userEvent.setup();

    renderWith([topic({ title: "Doomed" })]);

    await user.click(screen.getByRole("button", { name: /delete doomed/i }));

    // Deleting a topic takes its materials and their files; a student's
    // attempts survive. Both are worth saying before the click, not after.
    expect(screen.getByText(/delete this topic/i)).toBeInTheDocument();
    expect(screen.getByText(/students keep every attempt/i)).toBeInTheDocument();
    expect(service.deleteTopic).not.toHaveBeenCalled();
  });

  it("deletes the topic once confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(service.deleteTopic).mockResolvedValue(undefined);

    renderWith([topic({ id: 12, title: "Doomed" })]);

    await user.click(screen.getByRole("button", { name: /delete doomed/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(service.deleteTopic).toHaveBeenCalledWith(12);
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const user = userEvent.setup();

    renderWith([topic({ title: "Spared" })]);

    await user.click(screen.getByRole("button", { name: /delete spared/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(service.deleteTopic).not.toHaveBeenCalled();
  });

  /*
   * Reordering
   */

  it("sends the whole new order when a topic is moved down", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderTopics).mockResolvedValue([]);

    renderWith([first, second, third]);

    await user.click(screen.getByRole("button", { name: /move first up down/i }));

    // The complete list, in its new order — not the moved pair. The server
    // insists on it, because a partial list would renumber the topics it left
    // out and move students' unlock chain with them.
    expect(service.reorderTopics).toHaveBeenCalledWith(4, [2, 1, 3]);
    expect(onChanged).toHaveBeenCalled();
  });

  it("sends the whole new order when a topic is moved up", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderTopics).mockResolvedValue([]);

    renderWith([first, second, third]);

    await user.click(screen.getByRole("button", { name: /move third up up/i }));

    expect(service.reorderTopics).toHaveBeenCalledWith(4, [1, 3, 2]);
  });

  it("cannot move the first topic up or the last one down", () => {
    renderWith([first, second, third]);

    expect(
      screen.getByRole("button", { name: /move first up up/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /move third up down/i }),
    ).toBeDisabled();

    // The ones in between stay live.
    expect(
      screen.getByRole("button", { name: /move second up up/i }),
    ).toBeEnabled();
  });

  it("reports a failed reorder without reloading the page", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.mocked(service.reorderTopics).mockRejectedValueOnce(
      new ApiError("The order must list every topic in this roadmap.", 422),
    );

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /move first up down/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "The order must list every topic in this roadmap.",
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  /*
   * Selection
   */

  it("tells the page which topic was picked", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /select second up/i }));

    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
