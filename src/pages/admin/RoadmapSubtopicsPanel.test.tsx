// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoadmapTopicsPanel } from "./RoadmapTopicsPanel";
import { ApiError } from "@/services/api";
import type {
  LearningMaterial,
  Subtopic,
  Topic,
} from "@/features/content/types";

/**
 * Authoring the sections inside a topic.
 *
 * The service is stubbed, so these say what the panel asks the API for and what
 * it does with the answer. What matters most is which endpoint each action
 * reaches: a section and a topic are the same kind of row, so sending a
 * section's reorder to the roadmap's endpoint would renumber the roadmap and
 * look, on screen, almost like it had worked.
 *
 * The hierarchy assertions are deliberately about structure rather than about
 * styling — a section is found *inside* its topic's list item — because that is
 * the thing the feature promises and the thing a CSS change could quietly
 * break.
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
    createSubtopic: vi.fn(),
    reorderSubtopics: vi.fn(),
  };
});

vi.mock("./TopicMaterialsPanel", () => ({
  TopicMaterialsPanel: ({ topicId }: { topicId: number }) => (
    <div data-testid="materials-panel">Materials for {topicId}</div>
  ),
}));

// Stubbed like the materials panel: it fetches and navigates on its own, and
// what matters here is only which rows it is mounted on.
vi.mock("./TopicAssessmentsPanel", () => ({
  TopicAssessmentsPanel: ({ topicId }: { topicId: number }) => (
    <div data-testid="assessments-panel">Assessments for {topicId}</div>
  ),
}));

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return { ...actual, createMaterial: vi.fn() };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/content/topicService");
const materials = await import("@/features/content/materialService");

function subtopic(over: Partial<Subtopic> = {}): Subtopic {
  return {
    id: 100,
    roadmapId: 4,
    parentId: 1,
    title: "A section",
    description: null,
    order: 0,
    materials: [],
    ...over,
  };
}

function topic(over: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    roadmapId: 4,
    title: "Hardware and Cabling",
    description: null,
    videoUrl: null,
    parentId: null,
    order: 0,
    ...over,
  };
}

const osi = subtopic({ id: 101, title: "OSI Model", order: 0 });
const tcp = subtopic({ id: 102, title: "TCP/IP", order: 1 });

const withSections = topic({
  id: 1,
  title: "Networking Fundamentals",
  order: 0,
  subtopics: [osi, tcp],
});

const withoutSections = topic({
  id: 2,
  title: "Routing",
  order: 1,
  subtopics: [],
});

const onChanged = vi.fn();

function renderWith(topics: Topic[]) {
  return render(
    <RoadmapTopicsPanel
      roadmapId={4}
      roadmapTitle="Networking Essentials"
      topics={topics}
      onChanged={onChanged}
    />,
  );
}

/** The list item for one topic — a section of it has to be found inside this. */
function cardFor(title: string): HTMLElement {
  return screen.getByText(title).closest("li") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("subtopics in the authoring tree", () => {
  it("draws each section inside the topic holding it", () => {
    renderWith([withSections, withoutSections]);

    const first = cardFor("Networking Fundamentals");

    // Nested, not merely adjacent. A flat list showing the same four titles
    // would pass a query that only asked whether the words were on screen.
    expect(within(first).getByText("OSI Model")).toBeInTheDocument();
    expect(within(first).getByText("TCP/IP")).toBeInTheDocument();

    const second = cardFor("Routing");
    expect(within(second).queryByText("OSI Model")).not.toBeInTheDocument();
  });

  it("numbers a section inside its parent rather than in the roadmap", () => {
    renderWith([withSections, withoutSections]);

    // "1.1" and "1.2" — a section of topic 1, which can never be misread as
    // topic 2.
    expect(screen.getByText("1.1")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
  });

  it("says how many materials a section holds, on the action that opens them", () => {
    renderWith([
      topic({
        subtopics: [
          subtopic({
            id: 101,
            title: "OSI Model",
            materials: [
              {
                id: 1,
                topicId: 101,
                title: "Chart",
                description: null,
                kind: "link",
                kindLabel: "Link",
                url: "https://example.com",
                downloadUrl: null,
                filename: null,
                mimeType: null,
                sizeBytes: null,
                order: 0,
                isPublished: true,
              },
            ],
          }),
        ],
      }),
    ]);

    expect(
      screen.getByRole("button", {
        name: /learning materials for OSI Model/i,
      }),
    ).toHaveAccessibleName(/\(1\)/);
  });

  it("draws no tree for a topic with no sections", () => {
    renderWith([withoutSections]);

    expect(screen.queryByText(/add another subtopic/i)).not.toBeInTheDocument();
  });
});

describe("adding a subtopic", () => {
  it("writes it against the topic it was added from", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createSubtopic).mockResolvedValue(
      topic({ id: 103, parentId: 1 }),
    );

    renderWith([withSections, withoutSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Routing/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });
    await user.type(within(form).getByLabelText(/title/i), "Static routes");
    await user.click(within(form).getByRole("button", { name: /add subtopic/i }));

    await waitFor(() => {
      // Against topic 2, the one whose button was pressed — not against the
      // first topic on the page.
      expect(service.createSubtopic).toHaveBeenCalledWith(2, {
        title: "Static routes",
        description: "",
      });
    });

    expect(service.createTopic).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers no video field on a section", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });

    // A section's video belongs in its learning materials, where it can be
    // titled and ordered with everything else.
    expect(within(form).queryByLabelText(/video/i)).not.toBeInTheDocument();
    expect(within(form).getByLabelText(/title/i)).toBeInTheDocument();
    expect(within(form).getByLabelText(/overview/i)).toBeInTheDocument();
  });

  it("stages a section's own materials beside its title", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const group = screen.getByRole("group", { name: /learning materials/i });

    await user.click(within(group).getByRole("button", { name: /add material/i }));
    await user.type(within(group).getByLabelText(/^title$/i), "Cat6 guide");
    await user.type(
      within(group).getByLabelText(/web address/i),
      "https://example.com/cat6",
    );
    await user.click(within(group).getByRole("button", { name: /add to list/i }));

    // A section owns materials exactly as a topic does, so the same staging
    // serves both. Nothing is sent from here — the section has no id yet.
    const list = screen.getByTestId("subtopic-add-material-list");

    expect(within(list).getByText(/1\. Cat6 guide/)).toBeInTheDocument();
    expect(service.createSubtopic).not.toHaveBeenCalled();
    // Staged only: nothing goes until there is a section to attach it to.
    expect(materials.createMaterial).not.toHaveBeenCalled();
  });

  it("attaches the staged materials to the section that was just created", async () => {
    const user = userEvent.setup();
    const created = { ...withSections, id: 99, parentId: withSections.id };

    vi.mocked(service.createSubtopic).mockResolvedValue(created);
    vi.mocked(materials.createMaterial).mockResolvedValue(
      {} as Awaited<ReturnType<typeof materials.createMaterial>>,
    );

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });
    const group = screen.getByRole("group", { name: /learning materials/i });

    await user.type(within(form).getByLabelText(/^title$/i), "Cabling");
    await user.click(within(group).getByRole("button", { name: /add material/i }));
    await user.type(within(group).getByLabelText(/^title$/i), "Cat6 guide");
    await user.type(
      within(group).getByLabelText(/web address/i),
      "https://example.com/cat6",
    );
    await user.click(within(group).getByRole("button", { name: /add to list/i }));
    await user.click(within(form).getByRole("button", { name: /add subtopic/i }));

    await waitFor(() =>
      expect(materials.createMaterial).toHaveBeenCalledTimes(1),
    );

    // Against the section's own id, not its parent's — a section owns its
    // materials, and the endpoint takes whichever topic row is handed to it.
    expect(vi.mocked(materials.createMaterial).mock.calls[0][0]).toBe(created.id);
  });

  it("sends no material when the section itself was refused", async () => {
    const user = userEvent.setup();

    vi.mocked(service.createSubtopic).mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        title: ["A section with that title is already in this topic."],
      }),
    );

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });
    const group = screen.getByRole("group", { name: /learning materials/i });

    await user.type(within(form).getByLabelText(/^title$/i), "Cabling");
    await user.click(within(group).getByRole("button", { name: /add material/i }));
    await user.type(within(group).getByLabelText(/^title$/i), "Cat6 guide");
    await user.type(
      within(group).getByLabelText(/web address/i),
      "https://example.com/cat6",
    );
    await user.click(within(group).getByRole("button", { name: /add to list/i }));
    await user.click(within(form).getByRole("button", { name: /add subtopic/i }));

    await waitFor(() => expect(service.createSubtopic).toHaveBeenCalled());

    // No section, so no id to attach anything to — and a material sent anyway
    // would land on whichever topic that path fell back to, which is the parent.
    expect(materials.createMaterial).not.toHaveBeenCalled();
    // The dialog stays open on the refusal, still holding what was staged.
    expect(screen.getByTestId("subtopic-add-material-list")).toBeInTheDocument();
  });

  it("offers no assessments on a section", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });

    // A section cannot own an assessment — the server refuses one — so the
    // dialog that writes a section does not offer the pair the topic's does.
    expect(within(form).queryByLabelText(/pre-test/i)).not.toBeInTheDocument();
    expect(within(form).queryByLabelText(/post-test/i)).not.toBeInTheDocument();
  });

  it("keeps a titleless draft off the network", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });
    await user.click(within(form).getByRole("button", { name: /add subtopic/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(service.createSubtopic).not.toHaveBeenCalled();
  });
});

describe("editing a subtopic", () => {
  it("saves it through the topic endpoint", async () => {
    const user = userEvent.setup();
    vi.mocked(service.updateTopic).mockResolvedValue(topic({ id: 101 }));

    renderWith([withSections]);

    await user.click(screen.getByRole("button", { name: /edit OSI Model/i }));

    const form = screen.getByRole("form", { name: /edit subtopic/i });
    const title = within(form).getByLabelText(/title/i);

    await user.clear(title);
    await user.type(title, "The OSI Model");
    await user.click(within(form).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      // A section is a topic row, so the edit is the topic edit — aimed at the
      // section's own id, not at its parent's.
      expect(service.updateTopic).toHaveBeenCalledWith(101, {
        title: "The OSI Model",
        description: "",
        videoUrl: "",
      });
    });
  });
});

describe("deleting a subtopic", () => {
  it("confirms, then deletes the section and not its topic", async () => {
    const user = userEvent.setup();
    vi.mocked(service.deleteTopic).mockResolvedValue(undefined);

    renderWith([withSections]);

    await user.click(screen.getByRole("button", { name: /delete OSI Model/i }));

    expect(screen.getByText(/delete this subtopic/i)).toBeInTheDocument();
    expect(service.deleteTopic).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(service.deleteTopic).toHaveBeenCalledWith(101);
    });

    expect(service.deleteTopic).toHaveBeenCalledTimes(1);
  });
});

describe("reordering subtopics", () => {
  it("sends the parent's sections to the parent's own endpoint", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderSubtopics).mockResolvedValue([]);

    renderWith([withSections, withoutSections]);

    await user.click(screen.getByRole("button", { name: /move TCP\/IP up/i }));

    await waitFor(() => {
      // Scoped to topic 1, naming only its sections. The roadmap's own order is
      // a different endpoint and is not touched.
      expect(service.reorderSubtopics).toHaveBeenCalledWith(1, [102, 101]);
    });

    expect(service.reorderTopics).not.toHaveBeenCalled();
  });

  it("cannot move the first section up or the last one down", () => {
    renderWith([withSections]);

    expect(
      screen.getByRole("button", { name: /move OSI Model up/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /move TCP\/IP down/i }),
    ).toBeDisabled();
  });

  it("leaves root topic reordering on the roadmap endpoint", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderTopics).mockResolvedValue([]);

    renderWith([withSections, withoutSections]);

    await user.click(screen.getByRole("button", { name: /move Routing up/i }));

    await waitFor(() => {
      // The two topics, and neither of the sections inside them. A section id
      // in this list is refused by the server, and would be a bug here.
      expect(service.reorderTopics).toHaveBeenCalledWith(4, [2, 1]);
    });

    expect(service.reorderSubtopics).not.toHaveBeenCalled();
  });
});

/** A material on a section, for the counts the rows report. */
function material(over: Partial<LearningMaterial> = {}): LearningMaterial {
  return {
    id: 1,
    topicId: 101,
    title: "Chart",
    description: null,
    kind: "link",
    kindLabel: "Link",
    url: "https://example.com",
    downloadUrl: null,
    filename: null,
    mimeType: null,
    sizeBytes: null,
    order: 0,
    isPublished: true,
    ...over,
  };
}

/** The named action that opens one section's materials. */
function materialsButton(title: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`learning materials for ${title}`, "i"),
  });
}

/**
 * A section's own learning materials, reached from the section's own row.
 *
 * The panel is the one a topic uses, pointed at the section's id — a section is
 * a topic row, and its materials hang off it the same way. Two things matter
 * here and neither is cosmetic.
 *
 * The first is that the action is *visible*. An author must be able to see that
 * a section's materials are theirs to edit without clicking anything to find
 * out, so these look for a named button rather than a title that happens to
 * respond.
 *
 * The second is *when* the panel is mounted: mounting is fetching, so a tree of
 * twenty sections that mounted every panel would be twenty requests for a page
 * an author opened to read. One open node, one fetch.
 */
describe("a section's learning materials", () => {
  it("offers every section a materials action, named and visible", () => {
    renderWith([withSections]);

    // Both of them, on a folded card, before anything has been clicked.
    expect(materialsButton("OSI Model")).toBeInTheDocument();
    expect(materialsButton("TCP/IP")).toBeInTheDocument();
  });

  it("mounts no materials panel until a section is opened", () => {
    renderWith([withSections]);

    expect(screen.queryByTestId("materials-panel")).not.toBeInTheDocument();
  });

  it("opens a section onto its own materials, by its own id", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));

    // 101, the section — not 1, the topic holding it. The parent's id here
    // would fill the section's panel with the topic's materials, and write new
    // ones onto the topic.
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 101",
    );
  });

  it("gives each section its own materials, independently", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 101",
    );

    await user.click(materialsButton("TCP/IP"));
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 102",
    );
  });

  it("draws the panel inside the topic holding the section", async () => {
    const user = userEvent.setup();

    renderWith([withSections, withoutSections]);

    await user.click(materialsButton("TCP/IP"));

    // Nested, not merely present: the panel has to be inside the branch of the
    // topic whose section was opened.
    const parent = cardFor("Networking Fundamentals");
    expect(within(parent).getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 102",
    );

    expect(cardFor("Routing")).not.toContainElement(
      screen.getByTestId("materials-panel"),
    );
  });

  it("folds the panel away again, unmounted", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));
    await user.click(materialsButton("OSI Model"));

    // Gone, not hidden. A panel left mounted goes on refetching behind a
    // section nobody is looking at.
    expect(screen.queryByTestId("materials-panel")).not.toBeInTheDocument();
  });

  it("keeps one section open at a time", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));
    await user.click(materialsButton("TCP/IP"));

    expect(screen.getAllByTestId("materials-panel")).toHaveLength(1);
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 102",
    );
  });

  it("closes an open topic card when a section is opened", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /expand Networking Fundamentals/i }),
    );
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );

    await user.click(materialsButton("OSI Model"));

    // A topic's panel and a section's panel are both fetches, so the rule that
    // holds one card open holds across both kinds of node.
    expect(screen.getAllByTestId("materials-panel")).toHaveLength(1);
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 101",
    );
  });

  it("closes an open section when its topic card is opened", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));
    await user.click(
      screen.getByRole("button", { name: /expand Networking Fundamentals/i }),
    );

    // The root topic's own materials, still reached the way they always were.
    expect(screen.getAllByTestId("materials-panel")).toHaveLength(1);
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
  });

  it("offers no assessments on an open section", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));

    // A section's materials, and nothing else: a section cannot own a pre-test
    // or a post-test, so neither is offered on it.
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 101",
    );
    expect(screen.queryByTestId("assessments-panel")).not.toBeInTheDocument();
  });

  it("keeps the assessments on the topic holding the sections", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /expand Networking Fundamentals/i }),
    );

    // One panel, for the topic by its own id — not one per section inside it.
    expect(screen.getAllByTestId("assessments-panel")).toHaveLength(1);
    expect(
      within(cardFor("Networking Fundamentals")).getByTestId("assessments-panel"),
    ).toHaveTextContent("Assessments for 1");

    // Opening a section folds the topic, and its assessments go with it.
    await user.click(materialsButton("OSI Model"));

    expect(screen.queryByTestId("assessments-panel")).not.toBeInTheDocument();
  });

  it("carries the count on the action that opens them, open or shut", async () => {
    const user = userEvent.setup();

    renderWith([
      topic({
        subtopics: [
          subtopic({
            id: 101,
            title: "OSI Model",
            materials: [material({ id: 1 }), material({ id: 2 })],
          }),
          subtopic({ id: 102, title: "TCP/IP", order: 1, materials: [] }),
        ],
      }),
    ]);

    // Shut, this is the only word on whether a section holds anything.
    expect(materialsButton("OSI Model")).toHaveTextContent("2");
    expect(materialsButton("OSI Model")).toHaveAccessibleName(/\(2\)/);
    expect(materialsButton("TCP/IP")).toHaveAccessibleName(/\(0\)/);

    await user.click(materialsButton("OSI Model"));

    expect(materialsButton("OSI Model")).toHaveTextContent("2");
  });

  it("says which way the section is about to go", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    const toggle = materialsButton("OSI Model");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAccessibleName(/^show learning materials/i);

    await user.click(toggle);

    const open = materialsButton("OSI Model");
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(open).toHaveAccessibleName(/^hide learning materials/i);
  });

  it("still moves, edits and deletes a section while its materials are open", async () => {
    const user = userEvent.setup();
    vi.mocked(service.reorderSubtopics).mockResolvedValue([]);
    vi.mocked(service.deleteTopic).mockResolvedValue(undefined);

    renderWith([withSections]);

    await user.click(materialsButton("TCP/IP"));

    // The row's own controls are not swallowed by the panel below it.
    await user.click(screen.getByRole("button", { name: /move TCP\/IP up/i }));

    await waitFor(() => {
      expect(service.reorderSubtopics).toHaveBeenCalledWith(1, [102, 101]);
    });

    await user.click(screen.getByRole("button", { name: /edit OSI Model/i }));

    expect(
      screen.getByRole("form", { name: /edit subtopic/i }),
    ).toBeInTheDocument();
  });

  it("takes the panel down with the section it belonged to", async () => {
    const user = userEvent.setup();
    vi.mocked(service.deleteTopic).mockResolvedValue(undefined);

    renderWith([withSections]);

    await user.click(materialsButton("OSI Model"));
    await user.click(screen.getByRole("button", { name: /delete OSI Model/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(service.deleteTopic).toHaveBeenCalledWith(101);
    });

    // Left open, the id would be handed to whatever row the server returns
    // under it next.
    expect(screen.queryByTestId("materials-panel")).not.toBeInTheDocument();
  });

  it("leaves the root topic's own materials where they were", async () => {
    const user = userEvent.setup();

    renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /expand Networking Fundamentals/i }),
    );

    // Topic 1's own list, from the card — the path that existed before
    // sections did, unchanged by them.
    expect(screen.getByTestId("materials-panel")).toHaveTextContent(
      "Materials for 1",
    );
  });

  it("opens a newly added section onto its materials, as the dialog promises", async () => {
    const user = userEvent.setup();
    vi.mocked(service.createSubtopic).mockResolvedValue(
      topic({ id: 103, parentId: 1, title: "Static routes" }),
    );

    const { rerender } = renderWith([withSections]);

    await user.click(
      screen.getByRole("button", { name: /add subtopic to Networking/i }),
    );

    const form = screen.getByRole("form", { name: /add subtopic/i });
    await user.type(within(form).getByLabelText(/title/i), "Static routes");
    await user.click(
      within(form).getByRole("button", { name: /add subtopic/i }),
    );

    await waitFor(() => expect(service.createSubtopic).toHaveBeenCalled());

    // The page reloads the roadmap after a write, and the new section arrives
    // with it — standing open, ready for the first material.
    rerender(
      <RoadmapTopicsPanel
        roadmapId={4}
        roadmapTitle="Networking Essentials"
        topics={[
          topic({
            id: 1,
            title: "Networking Fundamentals",
            subtopics: [
              osi,
              tcp,
              subtopic({ id: 103, title: "Static routes", order: 2 }),
            ],
          }),
        ]}
        onChanged={onChanged}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("materials-panel")).toHaveTextContent(
        "Materials for 103",
      ),
    );
  });
});
