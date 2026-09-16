// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, matchRoutes } from "react-router";

import type { Assessment } from "@/features/assessments/adminAssessmentService";
import type { User } from "@/features/auth/types";
import type { Roadmap, Topic } from "@/features/content/types";

/**
 * Leaving the roadmap for the assessment builder, and coming back.
 *
 * AssessmentBuilderPage.test.tsx and TopicAssessmentsPanel.test.tsx each say
 * what their own half does with a stubbed router. What neither can say is that
 * the halves agree through the real route table: that the address the panel
 * builds is one the table resolves, that the builder hands the roadmap and
 * topic back, and that the roadmap page reopens on them. That is this file —
 * mounted in a memory router, as AdminAchievementsRoute.test.tsx does.
 *
 * The first find after each navigation is given longer than the default: every
 * one of these loads a lazy admin chunk from nothing, and under a full parallel
 * run that can take more than a second.
 */

const admin: User = {
  id: 1,
  name: "Ada Reyes",
  firstName: "Ada",
  lastName: "Reyes",
  studentId: null,
  email: "ada@netsim.edu",
  role: "admin",
  joinedAt: "2025-01-06T00:00:00Z",
  section: null,
};

const session = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: session.user,
    isAuthenticated: session.user !== null,
    isAdmin: session.user?.role === "admin",
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/adminService")>();

  return { ...actual, fetchCohorts: vi.fn() };
});

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return { ...actual, fetchRoadmaps: vi.fn() };
});

vi.mock("@/features/content/materialService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/materialService")
  >();

  return { ...actual, fetchTopicMaterials: vi.fn() };
});

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchAssessment: vi.fn(),
    fetchTopicAssessments: vi.fn(),
    deleteAssessment: vi.fn(),
  };
});

// Imported after the mocks so the route table's lazy imports pick them up.
const { routes } = await import("./AppRoutes");
const adminService = await import("@/features/admin/adminService");
const content = await import("@/features/content/contentService");
const materials = await import("@/features/content/materialService");
const assessments = await import("@/features/assessments/adminAssessmentService");

const SLOW = { timeout: 5000 };

function topic(over: Partial<Topic>): Topic {
  return {
    id: 4,
    roadmapId: 1,
    title: "Cabling",
    description: null,
    videoUrl: null,
    parentId: null,
    order: 0,
    ...over,
  };
}

const roadmaps: Roadmap[] = [
  {
    id: 1,
    title: "Hardware",
    description: "Machines and cables.",
    order: 0,
    isPublished: true,
    topics: [topic({ id: 4, roadmapId: 1, title: "Cabling" })],
  },
  {
    id: 2,
    title: "Networking",
    description: "Getting packets places.",
    order: 1,
    isPublished: true,
    topics: [topic({ id: 5, roadmapId: 2, title: "Routing" })],
  },
];

const routingPreTest: Assessment = {
  id: 11,
  topicId: 5,
  type: "pre_test",
  title: "Routing pre-test",
  description: null,
  isPublished: false,
  attemptsCount: 0,
  questionsCount: null,
  questions: [],
};

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

beforeEach(() => {
  session.user = admin;
  vi.mocked(adminService.fetchCohorts).mockResolvedValue([]);
  vi.mocked(content.fetchRoadmaps).mockResolvedValue(roadmaps);
  vi.mocked(materials.fetchTopicMaterials).mockResolvedValue([]);
  vi.mocked(assessments.fetchAssessment).mockResolvedValue(routingPreTest);
  vi.mocked(assessments.fetchTopicAssessments).mockResolvedValue([
    { ...routingPreTest, questionsCount: 0, questions: null },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the assessment builder's place in the admin routes", () => {
  it("resolves the builder address inside the admin layout", () => {
    const matched = matchRoutes(routes, "/admin/roadmap/assessments/11");

    expect(matched).not.toBeNull();
    expect(matched!.map((match) => match.route.path)).toEqual([
      undefined, // the admin-only guard, which is pathless
      "/admin",
      "roadmap/assessments/:assessmentId",
    ]);
    expect(matched![matched!.length - 1].params).toEqual({ assessmentId: "11" });
  });

  it("still resolves the roadmap page itself, query or not", () => {
    for (const path of ["/admin/roadmap", "/admin/roadmap?roadmap=2&topic=5"]) {
      const matched = matchRoutes(routes, path)!;

      expect(matched[matched.length - 1].route.path).toBe("roadmap");
    }
  });

  it("opens the builder on a cold load straight into its address", async () => {
    mountAt("/admin/roadmap/assessments/11");

    expect(
      await screen.findByText("Routing pre-test", {}, SLOW),
    ).toBeInTheDocument();
    expect(assessments.fetchAssessment).toHaveBeenCalledWith(11);
  });
});

describe("coming back from the builder", () => {
  it("returns to the roadmap and topic the builder was opened from", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/roadmap/assessments/11?roadmap=2&topic=5");

    await user.click(
      await screen.findByRole("button", { name: "Back to roadmap" }, SLOW),
    );

    // The router commits the new location only once the roadmap page's lazy
    // chunk has loaded, which under a full parallel run can outlast waitFor's
    // default second — so this wait gets the same allowance as the finds.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/roadmap");
      expect(router.state.location.search).toBe("?roadmap=2&topic=5");
    }, SLOW);

    expect(await screen.findByLabelText(/authoring/i, {}, SLOW)).toHaveValue("2");
    expect(
      screen.getByRole("button", { name: "Collapse Routing" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("returns to the plain roadmap page when there was nothing to remember", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/roadmap/assessments/11");

    await user.click(
      await screen.findByRole("button", { name: "Back to roadmap" }, SLOW),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/roadmap");
      expect(router.state.location.search).toBe("");
    });

    // The ordinary page: first roadmap, every card folded.
    expect(await screen.findByLabelText(/authoring/i, {}, SLOW)).toHaveValue("1");
    expect(
      screen.getByRole("button", { name: "Expand Cabling" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("goes roadmap → topic → builder → back, and lands where it started", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/roadmap");

    const picker = await screen.findByLabelText(/authoring/i, {}, SLOW);
    await user.selectOptions(picker, "2");

    await waitFor(() => expect(router.state.location.search).toBe("?roadmap=2"));

    await user.click(screen.getByRole("button", { name: "Expand Routing" }));
    await user.click(
      await screen.findByRole("button", { name: "Open builder" }, SLOW),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/roadmap/assessments/11");
      expect(router.state.location.search).toBe("?roadmap=2&topic=5");
    });

    await user.click(
      await screen.findByRole("button", { name: "Back to roadmap" }, SLOW),
    );

    expect(await screen.findByLabelText(/authoring/i, {}, SLOW)).toHaveValue("2");
    expect(
      screen.getByRole("button", { name: "Collapse Routing" }),
    ).toHaveAttribute("aria-expanded", "true");
  }, 30_000);

  it("deletes from the builder and lands on the topic, its slot empty again", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/roadmap/assessments/11?roadmap=2&topic=5");

    vi.mocked(assessments.deleteAssessment).mockResolvedValue(undefined);

    await user.click(await screen.findByRole("button", { name: "Delete" }, SLOW));

    // What the topic's listing says once the delete has gone through.
    vi.mocked(assessments.fetchTopicAssessments).mockResolvedValue([]);

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete assessment",
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/roadmap");
      expect(router.state.location.search).toBe("?roadmap=2&topic=5");
    });

    expect(assessments.deleteAssessment).toHaveBeenCalledWith(11);
    expect(
      await screen.findByRole("button", { name: "Create pre-test" }, SLOW),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/authoring/i)).toHaveValue("2");
    expect(screen.queryByText("Routing pre-test")).not.toBeInTheDocument();
  }, 30_000);
});
