// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

// The materials panel does its own fetching; stubbed so these tests are about
// the topic cards rather than about what hangs off the open one.
vi.mock("./TopicMaterialsPanel", () => ({
  TopicMaterialsPanel: ({ topicId }: { topicId: number }) => (
    <div data-testid="materials-panel">Materials for {topicId}</div>
  ),
}));

// The assessments panel fetches and navigates on its own; stubbed for the same
// reason, carrying the two ids it is handed so the card is seen to pass them.
vi.mock("./TopicAssessmentsPanel", () => ({
  TopicAssessmentsPanel: ({
    topicId,
    roadmapId,
  }: {
    topicId: number;
    roadmapId: number;
  }) => (
    <div data-testid="assessments-panel">
      Assessments for {topicId} in roadmap {roadmapId}
    </div>
  ),
}));

// The Add Topic dialog can open a topic's tests once the topic exists. Only
// the write is stubbed; the type labels and captions stay real, so the boxes
// are found by the words an author actually reads.
vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return { ...actual, createAssessment: vi.fn() };
});

// Staged materials are held in the browser and sent by a later phase. Stubbed
// so these can say that nothing reaches the network yet.
vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return { ...actual, createMaterial: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/content/topicService");
const assessments = await import("@/features/assessments/adminAssessmentService");
const materials = await import("@/features/content/materialService");
const { toast } = await import("sonner");

/**
 * The materials group inside a create dialog.
 *
 * Scoped, and it has to be: the material's own Title box carries the same label
 * as the topic's, which is right on screen and ambiguous only to a query that
 * ignores where it is looking.
 */
function materialsGroup() {
  return screen.getByRole("group", { name: /learning materials/i });
}

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 4,
    title: "Hardware and Cabling",
    description: "Building a machine and making a cable.",
    videoUrl: null,
    parentId: null,
    order: 0,
    ...over,
  };
}

const first = topic({ id: 1, title: "First up", order: 0 });
const second = topic({ id: 2, title: "Second up", order: 1 });
const third = topic({ id: 3, title: "Third up", order: 2 });

const onChanged = vi.fn();

function renderWith(
  topics: Topic[],
  { initialExpandedTopicId }: { initialExpandedTopicId?: number | null } = {},
) {
  return render(
    <RoadmapTopicsPanel
      roadmapId={4}
      roadmapTitle="Networking Essentials"
      topics={topics}
      onChanged={onChanged}
      initialExpandedTopicId={initialExpandedTopicId}
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

    expect(screen.getByText(/no topics in this roadmap/i)).toBeInTheDocument();
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

  /*
   * Creating
   *
   * Adding a topic is a modal over the roadmap, not a form at the foot of the
   * list: a new topic has no card to be written in, and an author adding the
   * eleventh topic should not have to scroll past ten to reach the boxes.
   */

  it("asks for a new topic in a modal, not in the list", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add topic/i }));

    const modal = screen.getByRole("dialog");

    expect(
      within(modal).getByRole("heading", { name: /add topic/i }),
    ).toBeInTheDocument();

    // The three boxes a topic is written in, all inside the modal.
    expect(within(modal).getByLabelText(/title/i)).toBeInTheDocument();
    expect(within(modal).getByLabelText(/overview/i)).toBeInTheDocument();
    expect(within(modal).getByLabelText(/headline video/i)).toBeInTheDocument();
    expect(
      within(modal).getByRole("form", { name: /add topic/i }),
    ).toBeInTheDocument();
  });

  it("closes the modal and opens the new topic once it is stored", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    // What the panel is handed after its reload contains the created topic.
    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "First up");
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    // Open, so the instructor can put learning materials on it straight away.
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("keeps the modal open, and the typing in it, when a draft is refused", async () => {
    const user = userEvent.setup();

    renderWith([first]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/overview/i), "Half written.");
    await user.click(submitButton(/add topic/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /give the topic a title/i,
    );

    // Closing on a refusal would throw the draft away and say nothing.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/overview/i)).toHaveValue("Half written.");
  });

  it("writes nothing when the modal is cancelled", async () => {
    const user = userEvent.setup();

    renderWith([first]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Second thoughts");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /cancel/i,
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(service.createTopic).not.toHaveBeenCalled();

    // And it opens empty next time rather than holding the abandoned draft.
    await user.click(screen.getByRole("button", { name: /add topic/i }));

    expect(screen.getByLabelText(/title/i)).toHaveValue("");
  });

  /*
   * The overview, and how much of it is left
   *
   * A topic's overview is the sentence under its title, on the roadmap and on
   * the topic itself, so it has a length the layout can carry. The counter is
   * what keeps that from being a surprise at save time, and the limit is the
   * server's — these say the two agree.
   */

  it("counts the overview down as it is written, in both forms", async () => {
    const user = userEvent.setup();

    renderWith([first]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));

    expect(screen.getByText(/280 of 280 characters left/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/overview/i), "Ten chars.");

    expect(screen.getByText(/270 of 280 characters left/i)).toBeInTheDocument();

    // The same field, the same counter, when editing an existing topic.
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /cancel/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /edit first up/i }));

    // "Building a machine and making a cable." is 38 characters.
    expect(screen.getByText(/242 of 280 characters left/i)).toBeInTheDocument();
  });

  it("says how far over the limit an overview has gone", async () => {
    const user = userEvent.setup();

    renderWith([topic({ description: "a".repeat(295) })]);

    await user.click(
      screen.getByRole("button", { name: /edit hardware and cabling/i }),
    );

    // Counting past the limit rather than stopping at zero: an author pasting
    // a paragraph needs to know how much to lose.
    expect(
      screen.getByText(/15 over the 280 character limit/i),
    ).toBeInTheDocument();
  });

  it("will not send an overview past the limit", async () => {
    const user = userEvent.setup();

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Too much to say");

    // Pasted rather than typed, which is how an overview goes over: the box
    // does not stop at the limit, so the whole paragraph arrives at once.
    await user.click(screen.getByLabelText(/overview/i));
    await user.paste("b".repeat(281));

    await user.click(submitButton(/add topic/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /keep the overview to 280 characters or fewer/i,
    );
    expect(service.createTopic).not.toHaveBeenCalled();
  });

  it("takes an overview at exactly the limit, from the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Right on the line");
    await user.click(screen.getByLabelText(/overview/i));
    await user.paste("a".repeat(280));

    expect(screen.getByText(/0 of 280 characters left/i)).toBeInTheDocument();

    await user.click(submitButton(/add topic/i));

    // Sent whole, at the limit: the boundary is inclusive on both ends.
    await waitFor(() =>
      expect(service.createTopic).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ description: "a".repeat(280) }),
      ),
    );
  });

  it("takes an overview one under the limit, from the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "One to spare");
    await user.click(screen.getByLabelText(/overview/i));
    await user.paste("a".repeat(279));

    expect(screen.getByText(/1 of 280 characters left/i)).toBeInTheDocument();

    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(service.createTopic).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ description: "a".repeat(279) }),
      ),
    );
  });

  /*
   * One case per length, rather than three turns of a loop inside one test.
   *
   * The three are independent — each opens the modal, writes an overview of its
   * own length and expects the same refusal — so nothing was holding them
   * together except the loop. Sharing a test meant sharing its five-second
   * budget as well, and three modal cycles came to about two seconds of it on
   * an idle machine; on a machine running the whole suite at once that is
   * enough to lose. Apart, each case is a quarter of the budget rather than
   * most of it, and a failure names the length that failed.
   */
  it.each([281, 350, 500])(
    "refuses an overview of %i characters, from the modal",
    async (length) => {
      const user = userEvent.setup();

      renderWith([]);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByLabelText(/title/i), "Too much to say");
      await user.click(screen.getByLabelText(/overview/i));
      await user.paste("b".repeat(length));

      await user.click(submitButton(/add topic/i));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /keep the overview to 280 characters or fewer/i,
      );

      // Nothing was sent, and nothing was quietly cut down to fit either.
      expect(service.createTopic).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/overview/i)).toHaveValue("b".repeat(length));
      expect(
        screen.getByText(new RegExp(`${length - 280} over the 280 character limit`, "i")),
      ).toBeInTheDocument();
    },
  );

  it("holds an edit to the same boundary", async () => {
    const user = userEvent.setup();
    vi.mocked(service.updateTopic).mockResolvedValue(first);

    renderWith([topic({ id: 9, title: "Editable" })]);

    await user.click(screen.getByRole("button", { name: /edit editable/i }));

    const overview = screen.getByLabelText(/overview/i);

    // One over: refused, with the text left as the author wrote it.
    await user.clear(overview);
    await user.click(overview);
    await user.paste("c".repeat(281));
    await user.click(submitButton(/save changes/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /keep the overview to 280 characters or fewer/i,
    );
    expect(service.updateTopic).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/overview/i)).toHaveValue("c".repeat(281));

    // Exactly the limit: saved.
    await user.clear(screen.getByLabelText(/overview/i));
    await user.click(screen.getByLabelText(/overview/i));
    await user.paste("c".repeat(280));
    await user.click(submitButton(/save changes/i));

    await waitFor(() =>
      expect(service.updateTopic).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ description: "c".repeat(280) }),
      ),
    );
  });

  it("opens a topic written before the limit without cutting it down", async () => {
    const user = userEvent.setup();

    const long = "d".repeat(680);

    renderWith([topic({ id: 5, title: "Grandfathered", description: long })]);

    await user.click(screen.getByRole("button", { name: /edit grandfathered/i }));

    // The stored text is in the box in full — the form shows what is there,
    // it does not trim it to fit the rule it now has.
    expect(screen.getByLabelText(/overview/i)).toHaveValue(long);
    expect(screen.getByText(/400 over the 280 character limit/i)).toBeInTheDocument();

    // And the author is told why saving will not go through yet, rather than
    // finding out when it does not.
    expect(
      screen.getByText(/written before the 280 character limit/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing has been cut/i)).toBeInTheDocument();
  });

  it("saves a grandfathered topic once its overview is shortened", async () => {
    const user = userEvent.setup();
    vi.mocked(service.updateTopic).mockResolvedValue(first);

    renderWith([
      topic({ id: 5, title: "Grandfathered", description: "d".repeat(680) }),
    ]);

    await user.click(screen.getByRole("button", { name: /edit grandfathered/i }));
    await user.clear(screen.getByLabelText(/overview/i));
    await user.type(screen.getByLabelText(/overview/i), "Shortened by hand.");
    await user.click(submitButton(/save changes/i));

    await waitFor(() =>
      expect(service.updateTopic).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ description: "Shortened by hand." }),
      ),
    );
  });

  it("creates a topic from the form", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.type(
      screen.getByLabelText(/overview/i),
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

  /*
   * The tests a topic is opened with
   *
   * Both are drafts and neither carries a field an author fills in here, so the
   * dialog asks the only question it can: whether to make them. They are made
   * after the topic, because the id they hang off is the one the server hands
   * back — which is what these pin down.
   */

  it("opens no assessment when neither box is ticked", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.click(submitButton(/add topic/i));

    await waitFor(() => expect(service.createTopic).toHaveBeenCalled());
    expect(assessments.createAssessment).not.toHaveBeenCalled();
  });

  it("opens the tests that were ticked, against the topic just created", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.click(screen.getByLabelText(/pre-test/i));
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(assessments.createAssessment).toHaveBeenCalledTimes(1),
    );

    // The id the server gave back, not one this panel guessed at, and a draft
    // named after what it is — the questions are written in the builder.
    expect(assessments.createAssessment).toHaveBeenCalledWith(first.id, {
      type: "pre_test",
      title: "Pre-test",
      description: "",
    });
  });

  it("opens both tests when both are ticked", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.click(screen.getByLabelText(/pre-test/i));
    await user.click(screen.getByLabelText(/post-test/i));
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(assessments.createAssessment).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(assessments.createAssessment).mock.calls.map(([, draft]) => draft.type),
    ).toEqual(["pre_test", "post_test"]);
  });

  it("opens no test when the topic itself was refused", async () => {
    const user = userEvent.setup();

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    // No title, so the draft never reaches the network.
    await user.click(screen.getByLabelText(/pre-test/i));
    await user.click(submitButton(/add topic/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(service.createTopic).not.toHaveBeenCalled();
    // Nothing to hang a test on, so none is attempted.
    expect(assessments.createAssessment).not.toHaveBeenCalled();
  });

  it("forgets the boxes once the topic is stored", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "Subnetting");
    await user.click(screen.getByLabelText(/pre-test/i));
    await user.click(submitButton(/add topic/i));

    await waitFor(() => expect(assessments.createAssessment).toHaveBeenCalled());

    // The dialog stays mounted between openings; the next topic starts on
    // empty boxes rather than on the last one's answers.
    await user.click(screen.getByRole("button", { name: /add topic/i }));
    expect(screen.getByLabelText(/pre-test/i)).not.toBeChecked();
  });

  /*
   * Materials written beside the topic
   *
   * They are staged, not sent: the endpoint takes the owner's id in its path
   * and there is no id until the topic exists. So these say what the list does
   * while it is being written, and that nothing leaves the browser yet.
   */

  async function openAddTopic(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /add topic/i }));
  }

  async function stageMaterial(
    user: ReturnType<typeof userEvent.setup>,
    { title, url }: { title: string; url: string },
  ) {
    await user.click(
      within(materialsGroup()).getByRole("button", { name: /add material/i }),
    );
    await user.type(within(materialsGroup()).getByLabelText(/^title$/i), title);
    await user.type(within(materialsGroup()).getByLabelText(/web address/i), url);
    await user.click(
      within(materialsGroup()).getByRole("button", { name: /add to list/i }),
    );
  }

  it("offers the materials group with nothing staged in it", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);

    expect(materialsGroup()).toBeInTheDocument();
    // No boxes until the author asks for them, which is what keeps the topic's
    // own Title unambiguous on open.
    expect(
      within(materialsGroup()).queryByLabelText(/^title$/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("topic-add-material-list")).not.toBeInTheDocument();
  });

  it("stages a material into the list without sending it", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);
    await stageMaterial(user, { title: "OSI Model", url: "https://example.com/osi" });

    const list = screen.getByTestId("topic-add-material-list");

    expect(within(list).getByText(/1\. OSI Model/)).toBeInTheDocument();
    expect(within(list).getByText(/example\.com\/osi/)).toBeInTheDocument();
    // Staging is a browser-side list; nothing is stored until a later phase
    // attaches it to the topic that gets created.
    expect(materials.createMaterial).not.toHaveBeenCalled();
  });

  it("stages several, in the order they were written", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);
    await stageMaterial(user, { title: "First", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Second", url: "https://example.com/2" });

    const rows = within(screen.getByTestId("topic-add-material-list")).getAllByRole(
      "listitem",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("1. First");
    expect(rows[1]).toHaveTextContent("2. Second");
  });

  it("keeps a material with no title out of the list", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);

    await user.click(
      within(materialsGroup()).getByRole("button", { name: /add material/i }),
    );
    await user.click(
      within(materialsGroup()).getByRole("button", { name: /add to list/i }),
    );

    // An empty link fails two rules at once, and both are said: the title it
    // has no title, and the address it has no address.
    const complaints = (await within(materialsGroup()).findAllByRole("alert")).map(
      (alert) => alert.textContent,
    );

    expect(complaints).toEqual([
      "Give the material a title.",
      "Add the web address.",
    ]);
    expect(screen.queryByTestId("topic-add-material-list")).not.toBeInTheDocument();
  });

  it("edits a staged material in place", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);
    await stageMaterial(user, { title: "Typo", url: "https://example.com/a" });

    await user.click(screen.getByRole("button", { name: /edit Typo/i }));

    const title = within(materialsGroup()).getByLabelText(/^title$/i);
    await user.clear(title);
    await user.type(title, "Fixed");
    await user.click(
      within(materialsGroup()).getByRole("button", { name: /save material/i }),
    );

    const list = screen.getByTestId("topic-add-material-list");

    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText(/1\. Fixed/)).toBeInTheDocument();
  });

  it("removes a staged material", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);
    await stageMaterial(user, { title: "Keep", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Drop", url: "https://example.com/2" });

    await user.click(screen.getByRole("button", { name: /remove Drop/i }));

    const rows = within(screen.getByTestId("topic-add-material-list")).getAllByRole(
      "listitem",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("1. Keep");
  });

  it("forgets what was staged when the dialog is cancelled", async () => {
    const user = userEvent.setup();

    renderWith([]);
    await openAddTopic(user);
    await stageMaterial(user, { title: "Abandoned", url: "https://example.com/x" });

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }),
    );
    await openAddTopic(user);

    // Neither the list nor a half-written material comes back with the next one.
    expect(screen.queryByTestId("topic-add-material-list")).not.toBeInTheDocument();
    expect(
      within(materialsGroup()).queryByLabelText(/^title$/i),
    ).not.toBeInTheDocument();
  });

  it("forgets what was staged once the topic is stored", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "Handout", url: "https://example.com/h" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() => expect(service.createTopic).toHaveBeenCalled());

    await openAddTopic(user);
    expect(screen.queryByTestId("topic-add-material-list")).not.toBeInTheDocument();
  });

  /*
   * Staged materials, once the topic exists
   *
   * The endpoint takes the owner's id in its path, so these can only go after
   * the topic has been stored — and they go one at a time, because the server
   * appends each to the end of the list and a batch would land in whatever
   * order the requests finished in.
   */

  it("attaches the staged materials to the topic that was just created", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);
    vi.mocked(materials.createMaterial).mockResolvedValue(
      {} as Awaited<ReturnType<typeof materials.createMaterial>>,
    );

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "First", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Second", url: "https://example.com/2" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(2),
    );

    // The id the server gave back, and the order the author wrote them in.
    const calls = vi.mocked(materials.createMaterial).mock.calls;

    expect(calls.map(([topicId]) => topicId)).toEqual([first.id, first.id]);
    expect(calls.map(([, draft]) => draft.title)).toEqual(["First", "Second"]);
  });

  it("sends nothing when no material was staged", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await user.click(submitButton(/add topic/i));

    await waitFor(() => expect(service.createTopic).toHaveBeenCalled());
    expect(materials.createMaterial).not.toHaveBeenCalled();
  });

  it("keeps the topic, and says which material would not go", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);
    vi.mocked(materials.createMaterial)
      .mockResolvedValueOnce(
        {} as Awaited<ReturnType<typeof materials.createMaterial>>,
      )
      .mockRejectedValueOnce(new Error("Storage is full"));

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "Stored", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Refused", url: "https://example.com/2" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(2),
    );

    // The topic is real and so is the material that did go, so this is not
    // reported as a failed create — it names what is left to do.
    const complaints = vi.mocked(toast.error).mock.calls;
    const complaint = complaints[complaints.length - 1][0];

    expect(complaint).toMatch(/topic was created/i);
    expect(complaint).toMatch(/Refused/);
    expect(complaint).not.toMatch(/Stored/);

    // And the dialog still closes onto the topic, which exists either way.
    expect(onChanged).toHaveBeenCalled();
  });

  it("says why the server would not take a material", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);
    vi.mocked(materials.createMaterial).mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        file: ["The file must be a file of type: pdf, docx, pptx."],
      }),
    );

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "Slides", url: "https://example.com/1" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(1),
    );

    // Everything an author could have been told beforehand was asked while they
    // were typing, so a material that gets this far was refused for something
    // only the server knows. Saying only that it would not go leaves them to
    // guess, so its own words are carried through.
    const complaints = vi.mocked(toast.error).mock.calls;
    const complaint = complaints[complaints.length - 1][0];

    expect(complaint).toMatch(/"Slides"/);
    expect(complaint).toMatch(/file of type: pdf, docx, pptx/);
  });

  it("names the refused material by its number when two share a title", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);
    vi.mocked(materials.createMaterial)
      .mockResolvedValueOnce(
        {} as Awaited<ReturnType<typeof materials.createMaterial>>,
      )
      .mockRejectedValueOnce(new ApiError("That file is too large.", 413));

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "Diagram", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Diagram", url: "https://example.com/2" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(2),
    );

    // Nothing stops an author titling two materials alike, and the list numbers
    // them rather than naming them — so the number goes with the name, and it
    // is the number of the row they can see.
    const complaints = vi.mocked(toast.error).mock.calls;
    const complaint = complaints[complaints.length - 1][0];

    expect(complaint).toMatch(/2\. "Diagram" — That file is too large/);
  });

  it("goes on to the later materials after one is refused", async () => {
    const user = userEvent.setup();
    const stored = {} as Awaited<ReturnType<typeof materials.createMaterial>>;

    vi.mocked(service.createTopic).mockResolvedValue(first);
    vi.mocked(materials.createMaterial)
      .mockResolvedValueOnce(stored)
      .mockRejectedValueOnce(new ApiError("That file is too large.", 413))
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(stored);

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "One", url: "https://example.com/1" });
    await stageMaterial(user, { title: "Two", url: "https://example.com/2" });
    await stageMaterial(user, { title: "Three", url: "https://example.com/3" });
    await stageMaterial(user, { title: "Four", url: "https://example.com/4" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(4),
    );

    // A refusal is one material's answer, not the end of the list: the three
    // that were going to store still do, and the one that did not is not sent
    // again. Four calls, once each, in the order they were written.
    const calls = vi.mocked(materials.createMaterial).mock.calls;

    expect(calls.map(([, draft]) => draft.title)).toEqual([
      "One",
      "Two",
      "Three",
      "Four",
    ]);
    expect(calls.map(([topicId]) => topicId)).toEqual([
      first.id,
      first.id,
      first.id,
      first.id,
    ]);

    // Only the one that was refused is named; the three that stored are not
    // reported as lost, and nothing is undone.
    const complaints = vi.mocked(toast.error).mock.calls;
    const complaint = complaints[complaints.length - 1][0];

    expect(complaint).toMatch(/one material could not be stored/i);
    expect(complaint).toMatch(/"Two"/);
    expect(complaint).not.toMatch(/"One"|"Three"|"Four"/);
    expect(onChanged).toHaveBeenCalled();
  });

  it("sends no material when the topic itself was refused", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        title: ["A topic with that title is already in this roadmap."],
      }),
    );

    renderWith([]);
    await openAddTopic(user);
    await user.type(screen.getByLabelText(/^title$/i), "Subnetting");
    await stageMaterial(user, { title: "Handout", url: "https://example.com/1" });
    await user.click(submitButton(/add topic/i));

    await waitFor(() => expect(service.createTopic).toHaveBeenCalled());

    // There is no id to hang them on, so nothing is attempted — a material
    // creation here would be against whatever topic that path guessed at.
    expect(materials.createMaterial).not.toHaveBeenCalled();
    // And the modal stays open, still holding what was staged.
    expect(screen.getByTestId("topic-add-material-list")).toBeInTheDocument();
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

    renderWith([
      topic({
        title: "Before",
        description: "How it reads now.",
        videoUrl: "https://example.com/v",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: /edit before/i }));

    expect(screen.getByLabelText(/title/i)).toHaveValue("Before");
    expect(screen.getByLabelText(/overview/i)).toHaveValue("How it reads now.");
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
   * Opening and closing a card
   *
   * A card carries the topic's content and its materials, so a roadmap of any
   * length is only workable if the cards start folded and the author opens the
   * one they came for. These say that folding is real — the content is not
   * merely hidden with CSS, the materials panel is not mounted — and that the
   * order controls, which is what the folded list is for, stay reachable.
   */

  it("starts with every card collapsed", () => {
    renderWith([first, second, third]);

    // The titles and their positions are the whole of a folded card.
    expect(screen.getByText("First up")).toBeInTheDocument();
    expect(screen.queryByTestId("materials-panel")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/building a machine and making a cable/i),
    ).not.toBeInTheDocument();
  });

  it("opens a topic onto its content and its materials", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));

    expect(
      screen.getByText(/building a machine and making a cable/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
    expect(
      screen.getByRole("button", { name: /collapse first up/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("folds a topic away again when its header is clicked twice", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));
    await user.click(
      screen.getByRole("button", { name: /collapse first up/i }),
    );

    expect(screen.queryByTestId("materials-panel")).not.toBeInTheDocument();
  });

  it("keeps one card open at a time", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));
    await user.click(screen.getByRole("button", { name: /expand second up/i }));

    // Two open cards would push the order controls apart and fetch materials
    // for both, so opening one closes the other.
    expect(screen.getAllByTestId("materials-panel")).toHaveLength(1);
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 2",
    );
  });

  it("still reorders while a card is open", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderTopics).mockResolvedValue([]);

    renderWith([first, second, third]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));
    await user.click(
      screen.getByRole("button", { name: /move first up down/i }),
    );

    expect(service.reorderTopics).toHaveBeenCalledWith(4, [2, 1, 3]);
  });

  /*
   * Staying open through a write
   *
   * The topic being written is the one the author is about to add materials to,
   * so it is the one that has to be in front of them when the form closes.
   */

  it("edits a topic inside its own card, in place of what it is editing", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /edit first up/i }));

    // The form is in the card it belongs to, not somewhere else on the page.
    const card = screen.getAllByRole("listitem")[0];
    const form = within(card).getByRole("form", { name: /edit topic/i });

    expect(form).toBeInTheDocument();
    expect(within(form).getByLabelText(/title/i)).toHaveValue("First up");
    expect(within(form).getByLabelText(/overview/i)).toHaveValue(
      "Building a machine and making a cable.",
    );

    // And it takes the place of the display: the title and the description are
    // in the boxes about to change them, not also sitting above as text.
    expect(screen.queryByText("First up")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/building a machine and making a cable/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/position 1/i)).not.toBeInTheDocument();

    // Nothing folds the form away, and nothing acts on the topic behind it.
    expect(
      screen.queryByRole("button", { name: /collapse first up/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete first up/i }),
    ).not.toBeInTheDocument();

    // The topic's materials are not part of the edit and stay where they are.
    expect(within(card).getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );

    // Only this card is editing; the rest of the roadmap is untouched.
    expect(screen.getByText("Second up")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand second up/i }),
    ).toBeInTheDocument();
  });

  it("leaves the topic open after its edit is saved", async () => {
    const user = userEvent.setup();
    vi.mocked(service.updateTopic).mockResolvedValue(first);

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /edit first up/i }));
    await user.click(submitButton(/save changes/i));

    await waitFor(() =>
      expect(screen.queryByRole("form")).not.toBeInTheDocument(),
    );

    // The card goes back to displaying the topic, still open, still showing the
    // materials the author came to add to.
    expect(screen.getByText("First up")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /collapse first up/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
  });

  it("opens the topic it just created", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createTopic).mockResolvedValue(first);

    // The list the panel is handed already contains the topic the create will
    // return, which is what the page's reload would give it.
    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /add topic/i }));
    await user.type(screen.getByLabelText(/title/i), "First up");
    await user.click(submitButton(/add topic/i));

    await waitFor(() =>
      expect(screen.getByTestId("materials-panel")).toHaveTextContent(
        "Materials for 1",
      ),
    );
  });
});

/**
 * A topic's pre-test and post-test.
 *
 * The panel itself is stubbed; these are about where the card puts it. It hangs
 * off an open topic of the roadmap beside the materials, is a fetch like they
 * are and so follows the same one-open-card rule, and is never offered on a row
 * that is a section — which cannot own an assessment.
 */
describe("a topic's assessments", () => {
  it("mounts no assessments panel on a folded card", () => {
    renderWith([first, second]);

    expect(screen.queryByTestId("assessments-panel")).not.toBeInTheDocument();
  });

  it("offers them inside an open topic's card, beside its materials", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));

    const card = screen.getAllByRole("listitem")[0];

    expect(within(card).getByTestId("assessments-panel")).toHaveTextContent(
      "Assessments for 1 in roadmap 4",
    );
    expect(within(card).getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
  });

  it("keeps them to the one open card, and takes them down when it folds", async () => {
    const user = userEvent.setup();

    renderWith([first, second]);

    await user.click(screen.getByRole("button", { name: /expand first up/i }));
    await user.click(screen.getByRole("button", { name: /expand second up/i }));

    expect(screen.getAllByTestId("assessments-panel")).toHaveLength(1);
    expect(screen.getByTestId("assessments-panel")).toHaveTextContent(
      "Assessments for 2",
    );

    await user.click(screen.getByRole("button", { name: /collapse second up/i }));

    expect(screen.queryByTestId("assessments-panel")).not.toBeInTheDocument();
  });

  it("offers none on a row that is a section, while its materials stay", async () => {
    const user = userEvent.setup();

    // Sections are drawn in their parent's branch, not handed here as topics.
    // The guard is on the row regardless, so one that did arrive gets nothing.
    renderWith([topic({ id: 9, title: "Stray section", parentId: 1 })]);

    await user.click(
      screen.getByRole("button", { name: /expand stray section/i }),
    );

    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 9",
    );
    expect(screen.queryByTestId("assessments-panel")).not.toBeInTheDocument();
  });

  it("opens the topic the page names on arrival", () => {
    renderWith([first, second], { initialExpandedTopicId: 2 });

    expect(
      screen.getByRole("button", { name: /collapse second up/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 2",
    );
    expect(screen.getByTestId("assessments-panel")).toHaveTextContent(
      "Assessments for 2",
    );
  });
});
