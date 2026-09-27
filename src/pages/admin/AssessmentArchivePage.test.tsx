// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router";

import { AssessmentArchivePage } from "./AssessmentArchivePage";
import { ApiError } from "@/services/api";
import { shortDate } from "@/services/time";
import type {
  ArchivedAssessment,
  ArchivedAssessmentPage,
} from "@/features/assessments/adminAssessmentService";
import type { Roadmap } from "@/features/content/types";

/**
 * The archive page: archived assessment versions of one type.
 *
 * The services are stubbed; routing is real (a memory router), so the filters
 * and the page are read from and written to an actual address — which is what
 * keeps them across Back and a refresh.
 */

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchArchivedAssessments: vi.fn(),
    restoreAssessment: vi.fn(),
    deleteAssessment: vi.fn(),
    publishAssessment: vi.fn(),
  };
});

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/content/contentService")>();

  return { ...actual, fetchRoadmaps: vi.fn() };
});

// Stubbed: it fetches on its own, and what matters here is which id it is given.
vi.mock("./AssessmentResultsPanel", () => ({
  AssessmentResultsPanel: ({ assessmentId }: { assessmentId: number }) => (
    <div data-testid="results-panel">Results for {assessmentId}</div>
  ),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/assessments/adminAssessmentService");
const content = await import("@/features/content/contentService");
const { toast } = await import("sonner");

/*
|--------------------------------------------------------------------------
| The world
|--------------------------------------------------------------------------
*/

function archived(over: Partial<ArchivedAssessment> = {}): ArchivedAssessment {
  return {
    id: 13,
    type: "pre_test",
    version: 2,
    title: "Before you start",
    archivedAt: "2026-09-20T10:00:00.000000Z",
    createdAt: "2026-09-01T10:00:00.000000Z",
    updatedAt: "2026-09-20T10:00:00.000000Z",
    attemptsCount: 0,
    questionsCount: 4,
    topic: { id: 16, title: "Routing" },
    roadmap: { id: 4, title: "Networking Essentials" },
    purge: { eligible: false, eligibleAt: "2026-10-20T10:00:00.000000Z" },
    ...over,
  };
}

function pageOf(
  items: ArchivedAssessment[],
  over: Partial<ArchivedAssessmentPage> = {},
): ArchivedAssessmentPage {
  return { items, page: 1, lastPage: 1, perPage: 15, total: items.length, ...over };
}

const roadmaps: Roadmap[] = [
  {
    id: 4,
    title: "Networking Essentials",
    description: "",
    order: 0,
    isPublished: true,
    topics: [
      { id: 16, roadmapId: 4, title: "Routing", description: null, videoUrl: null, order: 0, parentId: null },
      { id: 30, roadmapId: 4, title: "A section", description: null, videoUrl: null, order: 0, parentId: 16 },
    ],
  },
  {
    id: 5,
    title: "Wireless",
    description: "",
    order: 1,
    isPublished: false,
    topics: [
      { id: 19, roadmapId: 5, title: "Wi-Fi basics", description: null, videoUrl: null, order: 0, parentId: null },
    ],
  },
];

/** Where the app is, so a test can see the address a click wrote. */
function Where() {
  const location = useLocation();

  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/admin/archive/tests/:type",
        element: (
          <>
            <AssessmentArchivePage />
            <Where />
          </>
        ),
      },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: [path] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

/** The archive of pre-tests, rendered and loaded. */
async function show(items: ArchivedAssessment[] = [archived()], over: Partial<ArchivedAssessmentPage> = {}) {
  vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(pageOf(items, over));

  renderAt("/admin/archive/tests/pre-test");

  await screen.findByRole("heading", { name: "Archived pre-tests" });
  if (items.length > 0) await screen.findByRole("list", { name: "Archived pre-tests" });
}

/** One version's row, by the label it is named with ("Pre-test V2"). */
function row(label: string) {
  const name = screen.getByText(label);

  return within(name.closest("li") as HTMLElement);
}

function lastQuery() {
  const calls = vi.mocked(service.fetchArchivedAssessments).mock.calls;

  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(content.fetchRoadmaps).mockResolvedValue(roadmaps);
});

afterEach(cleanup);

/*
|--------------------------------------------------------------------------
| Which archive
|--------------------------------------------------------------------------
*/

describe("which archive it shows", () => {
  it("shows the archived pre-tests for the pre-test address", async () => {
    await show();

    expect(screen.getByRole("heading", { name: "Archived pre-tests" })).toBeInTheDocument();
    expect(lastQuery()).toEqual({ type: "pre_test", topicId: undefined, taken: undefined, page: 1 });
  });

  it("shows the archived post-tests for the post-test address", async () => {
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(
      pageOf([archived({ type: "post_test" })]),
    );

    renderAt("/admin/archive/tests/post-test");

    expect(await screen.findByRole("heading", { name: "Archived post-tests" })).toBeInTheDocument();
    expect(lastQuery()?.type).toBe("post_test");
    expect(await screen.findByText("Post-test V2")).toBeInTheDocument();
  });

  it("says there is no such archive for any other type, and asks for nothing", async () => {
    renderAt("/admin/archive/tests/quiz");

    expect(await screen.findByText("No such archive")).toBeInTheDocument();
    expect(service.fetchArchivedAssessments).not.toHaveBeenCalled();
  });

  it("explains what archived means, without promising a deletion", async () => {
    await show();

    const text = document.body.textContent ?? "";

    expect(text).toMatch(/read-only/);
    expect(text).toMatch(/student result on them is\s+kept/);
    expect(text).toMatch(/eligible for the scheduled\s+purge 30 days/);
    expect(text).not.toMatch(/will be deleted/i);
  });
});

/*
|--------------------------------------------------------------------------
| Loading, empty and failed
|--------------------------------------------------------------------------
*/

describe("loading and its outcomes", () => {
  it("shows a loading state while the archive is on its way", async () => {
    vi.mocked(service.fetchArchivedAssessments).mockReturnValue(new Promise(() => {}));

    renderAt("/admin/archive/tests/pre-test");

    expect(await screen.findByText("Loading the archive…")).toBeInTheDocument();
  });

  it("says when nothing is archived", async () => {
    await show([]);

    expect(screen.getByText("No archived pre-tests yet.")).toBeInTheDocument();
  });

  it("says when nothing matches the filters, rather than that nothing is archived", async () => {
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(pageOf([]));

    renderAt("/admin/archive/tests/pre-test?taken=yes");

    expect(await screen.findByText("No archived pre-tests match these filters.")).toBeInTheDocument();
  });

  it("shows the server's message when the archive fails, and retries", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments)
      .mockRejectedValueOnce(new Error("The server had a problem with that."))
      .mockResolvedValue(pageOf([archived()]));

    renderAt("/admin/archive/tests/pre-test");

    expect(await screen.findByText("The server had a problem with that.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Pre-test V2")).toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| Filters and pages
|--------------------------------------------------------------------------
*/

describe("filtering", () => {
  it("offers each roadmap's topics as Roadmap › Topic, and never a section", async () => {
    await show();

    const topic = screen.getByLabelText("Topic");

    await waitFor(() =>
      expect(within(topic).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "All topics",
        "Networking Essentials › Routing",
        "Wireless › Wi-Fi basics",
      ]),
    );
  });

  it("narrows to one topic, and back to page 1", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(
      pageOf([archived()], { page: 2, lastPage: 3, total: 31 }),
    );

    const router = renderAt("/admin/archive/tests/pre-test?page=2");
    await screen.findByText("Pre-test V2");
    await screen.findByRole("option", { name: "Wireless › Wi-Fi basics" });

    await user.selectOptions(screen.getByLabelText("Topic"), "19");

    await waitFor(() => expect(lastQuery()).toEqual({ type: "pre_test", topicId: 19, taken: undefined, page: 1 }));
    expect(router.state.location.search).toBe("?topic=19");
  });

  it.each([
    ["Taken", "yes", true],
    ["Never taken", "no", false],
  ] as const)("filters %s, and back to page 1", async (label, value, taken) => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(
      pageOf([archived()], { page: 2, lastPage: 2, total: 16 }),
    );

    const router = renderAt("/admin/archive/tests/pre-test?page=2");
    await screen.findByText("Pre-test V2");

    await user.selectOptions(screen.getByLabelText("Taken"), label);

    await waitFor(() => expect(lastQuery()).toEqual({ type: "pre_test", topicId: undefined, taken, page: 1 }));
    expect(router.state.location.search).toBe(`?taken=${value}`);
  });

  it("clears the taken filter with All", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(pageOf([archived()]));

    renderAt("/admin/archive/tests/pre-test?taken=no");
    await screen.findByText("Pre-test V2");
    expect(lastQuery()?.taken).toBe(false);

    await user.selectOptions(screen.getByLabelText("Taken"), "All");

    await waitFor(() => expect(lastQuery()?.taken).toBeUndefined());
  });

  it("keeps the topic filter inside a narrow screen, however long a topic's name", async () => {
    await show();

    const picker = screen.getByLabelText("Topic");

    // Layout is not measured in jsdom. A native select is as wide as its
    // longest option, which once pushed this one past a phone-width screen.
    expect(picker).toHaveClass("max-w-full");
    expect(picker.parentElement).toHaveClass("min-w-0", "max-w-full");
  });
});

describe("paging", () => {
  it("moves between pages, keeping the filters", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockImplementation(async (query) =>
      pageOf([archived({ id: 100 + (query.page ?? 1) })], { page: query.page ?? 1, lastPage: 2, total: 16 }),
    );

    const router = renderAt("/admin/archive/tests/pre-test?topic=16&taken=no");
    await screen.findByText("Page 1 of 2 · 16 archived");

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByText("Page 2 of 2 · 16 archived");
    expect(lastQuery()).toEqual({ type: "pre_test", topicId: 16, taken: false, page: 2 });
    expect(router.state.location.search).toBe("?topic=16&taken=no&page=2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => expect(lastQuery()?.page).toBe(1));
    expect(router.state.location.search).toBe("?topic=16&taken=no");
  });

  it("offers no pages when everything fits on one", async () => {
    await show();

    expect(screen.queryByRole("navigation", { name: "Archive pages" })).not.toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| The rows
|--------------------------------------------------------------------------
*/

describe("each archived version", () => {
  it("is its own row, by version, with its topic", async () => {
    await show([
      archived({ id: 13, version: 2, archivedAt: "2026-09-20T10:00:00Z" }),
      archived({ id: 12, version: 1, attemptsCount: 3, purge: { eligible: false, eligibleAt: null } }),
    ]);

    expect(row("Pre-test V2").getByText("Networking Essentials › Routing")).toBeInTheDocument();
    expect(row("Pre-test V1").getByText("3 attempts")).toBeInTheDocument();
    expect(row("Pre-test V2").getByText("0 attempts")).toBeInTheDocument();
    expect(row("Pre-test V2").getByText("4 questions")).toBeInTheDocument();
    expect(row("Pre-test V2").getByText(`Archived ${shortDate("2026-09-20T10:00:00Z")}`)).toBeInTheDocument();
  });

  it("opens the exact version, read-only, in the builder with the way back", async () => {
    const user = userEvent.setup();
    await show([archived({ id: 13, version: 2 }), archived({ id: 12, version: 1 })]);

    await user.click(row("Pre-test V1").getByRole("button", { name: "View" }));

    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/roadmap/assessments/12?from=archive&type=pre-test",
    );
  });

  it("shows the results of that version, and not another version's", async () => {
    const user = userEvent.setup();
    await show([archived({ id: 13, version: 2 }), archived({ id: 12, version: 1 })]);

    await user.click(row("Pre-test V1").getByRole("button", { name: "Results" }));

    expect(screen.getAllByTestId("results-panel")).toHaveLength(1);
    expect(row("Pre-test V1").getByTestId("results-panel")).toHaveTextContent("Results for 12");

    await user.click(row("Pre-test V1").getByRole("button", { name: "Hide results" }));

    expect(screen.queryByTestId("results-panel")).not.toBeInTheDocument();
  });
});

describe("purge status", () => {
  it("keeps a taken version, and offers no delete for it", async () => {
    await show([archived({ attemptsCount: 2, purge: { eligible: false, eligibleAt: null } })]);

    expect(row("Pre-test V2").getByText("Kept — has student results")).toBeInTheDocument();
    expect(row("Pre-test V2").queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("says when an untaken version becomes eligible", async () => {
    await show([archived({ purge: { eligible: false, eligibleAt: "2026-10-20T10:00:00Z" } })]);

    expect(row("Pre-test V2").getByText("Not yet eligible")).toBeInTheDocument();
    expect(row("Pre-test V2").getByText(`Eligible on ${shortDate("2026-10-20T10:00:00Z")}`, { exact: false })).toBeInTheDocument();
    expect(row("Pre-test V2").getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("says when an untaken version is eligible", async () => {
    await show([archived({ purge: { eligible: true, eligibleAt: "2026-08-20T10:00:00Z" } })]);

    expect(row("Pre-test V2").getByText("Eligible for deletion")).toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| Restore
|--------------------------------------------------------------------------
*/

describe("restoring", () => {
  it("restores the exact version, unpublished, and reads the archive again", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments)
      .mockResolvedValueOnce(pageOf([archived({ id: 13, version: 2 }), archived({ id: 12, version: 1 })]))
      .mockResolvedValue(pageOf([archived({ id: 12, version: 1 })]));
    vi.mocked(service.restoreAssessment).mockResolvedValue({} as never);

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Restore" }));

    expect(service.restoreAssessment).toHaveBeenCalledWith(13);
    await waitFor(() => expect(screen.queryByText("Pre-test V2")).not.toBeInTheDocument());
    expect(screen.getByText("Pre-test V1")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "V2 of “Routing” restored as an unpublished draft. Publish it from the Roadmap.",
    );
    // Restore is not publish.
    expect(service.publishAssessment).not.toHaveBeenCalled();
  });

  it("sends one restore however quickly it is clicked", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(
      pageOf([archived({ id: 13, version: 2 }), archived({ id: 12, version: 1 })]),
    );
    vi.mocked(service.restoreAssessment).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({} as never);
      }),
    );

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Restore" }));

    const pending = row("Pre-test V2").getByRole("button", { name: "Restoring…" });
    expect(pending).toBeDisabled();
    expect(row("Pre-test V1").getByRole("button", { name: "Restore" })).toBeDisabled();
    expect(row("Pre-test V1").getByRole("button", { name: "Delete" })).toBeDisabled();

    await user.click(pending);
    await user.click(row("Pre-test V1").getByRole("button", { name: "Restore" }));

    expect(service.restoreAssessment).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

/*
|--------------------------------------------------------------------------
| Delete
|--------------------------------------------------------------------------
*/

describe("deleting", () => {
  it("asks first, naming the version, and deletes nothing when cancelled", async () => {
    const user = userEvent.setup();
    await show();

    await user.click(row("Pre-test V2").getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete Pre-test V2 of “Routing”?" });
    expect(dialog).toHaveTextContent("No student has taken this version.");
    expect(dialog).toHaveTextContent("cannot be undone");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(service.deleteAssessment).not.toHaveBeenCalled();
  });

  it("deletes only if still archived, and the row goes", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments)
      .mockResolvedValueOnce(pageOf([archived({ id: 13, version: 2 })]))
      .mockResolvedValue(pageOf([]));
    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(service.deleteAssessment).toHaveBeenCalledWith(13, { expected: "archived" });
    await waitFor(() => expect(screen.queryByText("Pre-test V2")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Deleted V2 of “Routing”.");
  });

  it("refreshes, without retrying, when another administrator changed it first", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments)
      .mockResolvedValueOnce(pageOf([archived({ id: 13, version: 2 })]))
      .mockResolvedValue(pageOf([]));
    vi.mocked(service.deleteAssessment).mockRejectedValue(
      new ApiError('Version 2 of "Before you start" is no longer archived, so it was not deleted.', 409),
    );

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This assessment was changed by another administrator. The Archive list has been refreshed.",
      ),
    );
    await waitFor(() => expect(service.fetchArchivedAssessments).toHaveBeenCalledTimes(2));
    expect(service.deleteAssessment).toHaveBeenCalledTimes(1);
  });

  it("refreshes the same way when a restore meets a version already gone", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments)
      .mockResolvedValueOnce(pageOf([archived({ id: 13, version: 2 })]))
      .mockResolvedValue(pageOf([]));
    vi.mocked(service.restoreAssessment).mockRejectedValue(new ApiError("Not found.", 404));

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This assessment was changed by another administrator. The Archive list has been refreshed.",
      ),
    );
    await waitFor(() => expect(screen.queryByText("Pre-test V2")).not.toBeInTheDocument());
    expect(service.restoreAssessment).toHaveBeenCalledTimes(1);
  });

  it("shows any other failure in the server's words, and keeps the row", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockResolvedValue(pageOf([archived()]));
    vi.mocked(service.deleteAssessment).mockRejectedValue(new ApiError("The server had a problem.", 500));

    renderAt("/admin/archive/tests/pre-test");
    await screen.findByText("Pre-test V2");

    await user.click(row("Pre-test V2").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The server had a problem."));
    expect(screen.getByText("Pre-test V2")).toBeInTheDocument();
    expect(service.fetchArchivedAssessments).toHaveBeenCalledTimes(1);
  });

  it("steps back a page when the last row on it goes", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchArchivedAssessments).mockImplementation(async (query) =>
      (query.page ?? 1) === 2 && vi.mocked(service.deleteAssessment).mock.calls.length > 0
        ? pageOf([], { page: 2, lastPage: 1, total: 15 })
        : pageOf([archived({ id: 200 + (query.page ?? 1) })], { page: query.page ?? 1, lastPage: 2, total: 16 }),
    );
    vi.mocked(service.deleteAssessment).mockResolvedValue(undefined);

    const router = renderAt("/admin/archive/tests/pre-test?page=2");
    await screen.findByText("Page 2 of 2 · 16 archived");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
    await waitFor(() => expect(lastQuery()?.page).toBe(1));
  });
});
