// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, matchRoutes } from "react-router";

import { ADMIN_ARCHIVE_ITEMS } from "@/components/common/AdminSidebar";
import { warmLazyRoutes } from "@/test/lazyRoutes";
import type { User } from "@/features/auth/types";
import type { Assessment } from "@/features/assessments/adminAssessmentService";

/**
 * The archive, reached the way an admin reaches it: through the real route
 * table, the admin layout, its guard and its sidebar.
 *
 * The page's own behaviour is AssessmentArchivePage.test's. This is about the
 * way in — the sidebar group, the addresses and their redirects, the title, who
 * is let through — and the way back out of the builder.
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

const student: User = { ...admin, id: 2, role: "student", studentId: "2021-00042" };

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
  const actual = await importOriginal<typeof import("@/features/content/contentService")>();

  return { ...actual, fetchRoadmaps: vi.fn() };
});

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return {
    ...actual,
    fetchArchivedAssessments: vi.fn(),
    fetchAssessment: vi.fn(),
    fetchAssessmentResults: vi.fn(),
  };
});

const { routes } = await import("./AppRoutes");
const adminService = await import("@/features/admin/adminService");
const content = await import("@/features/content/contentService");
const assessments = await import("@/features/assessments/adminAssessmentService");

const archivedVersion: Assessment = {
  id: 13,
  topicId: 16,
  type: "post_test",
  version: 2,
  title: "Routing wrap-up",
  description: null,
  isPublished: false,
  archivedAt: "2026-09-20T10:00:00Z",
  createdAt: null,
  updatedAt: null,
  attemptsCount: 0,
  questionsCount: null,
  questions: [],
};

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

function routerErrorScreen() {
  return (
    screen.queryByText(/Unexpected Application Error/i) ??
    screen.queryByText(/404 Not Found/i)
  );
}

/** The sidebar's Archive group, once open. */
function archiveGroup() {
  const toggle = screen.getByRole("button", { name: "Archive" });

  return within(toggle.parentElement as HTMLElement);
}

beforeAll(async () => {
  expect(
    await warmLazyRoutes(routes, [
      "/admin/archive/tests/pre-test",
      "/admin/archive",
      "/admin/profile",
      "/admin/roadmap/assessments/13",
    ]),
  ).toBeGreaterThan(0);
}, 30_000);

beforeEach(() => {
  session.user = admin;
  vi.mocked(adminService.fetchCohorts).mockResolvedValue([]);
  vi.mocked(content.fetchRoadmaps).mockResolvedValue([]);
  vi.mocked(assessments.fetchArchivedAssessments).mockResolvedValue({
    items: [],
    page: 1,
    lastPage: 1,
    perPage: 15,
    total: 0,
  });
  vi.mocked(assessments.fetchAssessment).mockResolvedValue(archivedVersion);
  vi.mocked(assessments.fetchAssessmentResults).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/*
|--------------------------------------------------------------------------
| The addresses
|--------------------------------------------------------------------------
*/

describe("the archive's addresses", () => {
  it.each([
    ["/admin/archive/tests/pre-test", "Archived pre-tests", "pre_test"],
    ["/admin/archive/tests/post-test", "Archived post-tests", "post_test"],
  ])("opens %s on a cold load", async (path, heading, type) => {
    mountAt(path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(vi.mocked(assessments.fetchArchivedAssessments).mock.calls[0][0].type).toBe(type);
    expect(routerErrorScreen()).toBeNull();
  });

  it.each(["/admin/archive", "/admin/archive/tests"])(
    "sends %s on to the pre-tests, replacing itself in history",
    async (path) => {
      const router = mountAt(path);

      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/admin/archive/tests/pre-test"),
      );
      expect(await screen.findByRole("heading", { name: "Archived pre-tests" })).toBeInTheDocument();
      expect(router.state.historyAction).toBe("REPLACE");
    },
  );

  it("says there is no such archive for a type it does not know", async () => {
    mountAt("/admin/archive/tests/quiz");

    expect(await screen.findByText("No such archive")).toBeInTheDocument();
    expect(assessments.fetchArchivedAssessments).not.toHaveBeenCalled();
    // Still inside the admin chrome, with the way back to a real archive.
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("sends every archive destination the sidebar offers to a real route", () => {
    const unmatched = ADMIN_ARCHIVE_ITEMS.map((item) => item.path).filter(
      (path) => matchRoutes(routes, path) === null,
    );

    expect(unmatched).toEqual([]);
    expect(ADMIN_ARCHIVE_ITEMS.map((item) => item.path)).toEqual([
      "/admin/archive/tests/pre-test",
      "/admin/archive/tests/post-test",
    ]);
  });
});

describe("who the archive is for", () => {
  it("turns a student away without reading the archive", async () => {
    session.user = student;

    const router = mountAt("/admin/archive/tests/pre-test");

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(assessments.fetchArchivedAssessments).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in", async () => {
    session.user = null;

    const router = mountAt("/admin/archive/tests/pre-test");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(assessments.fetchArchivedAssessments).not.toHaveBeenCalled();
  });
});

/*
|--------------------------------------------------------------------------
| The title
|--------------------------------------------------------------------------
*/

describe("the page title", () => {
  it.each([
    ["/admin/archive/tests/pre-test", "Archive · Pre-Tests"],
    ["/admin/archive/tests/post-test", "Archive · Post-Tests"],
    ["/admin/archive/tests/quiz", "Archive · Pre-Tests"],
  ])("names %s as %s", async (path, title) => {
    mountAt(path);

    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
  });

  it("leaves the roadmap's title as it was", async () => {
    mountAt("/admin/roadmap/assessments/13");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Roadmap Content" }),
    ).toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| The sidebar
|--------------------------------------------------------------------------
*/

describe("the sidebar's Archive group", () => {
  it("sits after Achievements, folded, away from the archive", async () => {
    mountAt("/admin/profile");

    const achievements = await screen.findByRole("button", { name: "Achievements" });
    const archive = screen.getByRole("button", { name: "Archive" });

    expect(achievements.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archive).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Pre-Test" })).not.toBeInTheDocument();
  });

  it("opens by itself, marked active, inside the archive", async () => {
    mountAt("/admin/archive/tests/post-test");

    await screen.findByRole("heading", { name: "Archived post-tests" });

    const archive = screen.getByRole("button", { name: "Archive" });
    expect(archive).toHaveAttribute("aria-expanded", "true");
    expect(archive.className).toContain("text-accent-foreground");
    expect(archiveGroup().getByText("Test")).toBeInTheDocument();
    expect(archiveGroup().getByRole("button", { name: "Post-Test" })).toHaveAttribute("aria-current", "page");
    expect(archiveGroup().getByRole("button", { name: "Pre-Test" })).not.toHaveAttribute("aria-current");
  });

  it("opens onto the pre-tests, and moves between the two", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/profile");

    await user.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/admin/archive/tests/pre-test"),
    );
    expect(await screen.findByRole("heading", { name: "Archived pre-tests" })).toBeInTheDocument();

    await user.click(archiveGroup().getByRole("button", { name: "Post-Test" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/admin/archive/tests/post-test"),
    );
    expect(await screen.findByRole("heading", { name: "Archived post-tests" })).toBeInTheDocument();
  });
});

/*
|--------------------------------------------------------------------------
| Back out of the builder
|--------------------------------------------------------------------------
*/

describe("the builder opened from the archive", () => {
  it.each([
    ["pre-test", "/admin/archive/tests/pre-test"],
    ["post-test", "/admin/archive/tests/post-test"],
  ])("goes back to the %s archive", async (slug, destination) => {
    const user = userEvent.setup();
    const router = mountAt(`/admin/roadmap/assessments/13?from=archive&type=${slug}`);

    await user.click(await screen.findByRole("button", { name: "Back to archive" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(destination));
  });

  it("opens the sidebar's Archive group on the way back into the archive", async () => {
    const user = userEvent.setup();
    mountAt("/admin/roadmap/assessments/13?from=archive&type=post-test");

    const back = await screen.findByRole("button", { name: "Back to archive" });
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("aria-expanded", "false");

    await user.click(back);

    await screen.findByRole("heading", { name: "Archived post-tests" });
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("aria-expanded", "true");
    expect(archiveGroup().getByRole("button", { name: "Post-Test" })).toHaveAttribute("aria-current", "page");
  });

  it("goes back to the roadmap when opened from the roadmap", async () => {
    const user = userEvent.setup();
    const router = mountAt("/admin/roadmap/assessments/13?roadmap=3&topic=16");

    await user.click(await screen.findByRole("button", { name: "Back to roadmap" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/roadmap"));
    expect(router.state.location.search).toBe("?roadmap=3&topic=16");
  });

  it("falls back to the roadmap on an archive context it cannot use", async () => {
    mountAt("/admin/roadmap/assessments/13?from=archive&type=quiz");

    expect(await screen.findByRole("button", { name: "Back to roadmap" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to archive" })).not.toBeInTheDocument();
  });

  it("keeps an archived version read-only however it was reached", async () => {
    mountAt("/admin/roadmap/assessments/13?from=archive&type=post-test");

    expect(await screen.findByText(/archived, so it is read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish assessment" })).not.toBeInTheDocument();
  });
});
