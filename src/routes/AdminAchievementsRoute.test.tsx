// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, matchRoutes } from "react-router";

import { ADMIN_NAV_ITEMS } from "@/components/common/AdminSidebar";
import type { User } from "@/features/auth/types";

/**
 * Reaching the admin achievement catalogue — the navigation, not the page.
 *
 * AchievementAdminPage.test.tsx already says what the page does once it is on
 * screen. What was missing, and what this file adds, is everything that has to
 * be true *before* it renders: that the sidebar's link, the route table and the
 * lazy import agree with one another, and that the guard above them lets an
 * admin through and nobody else.
 *
 * That agreement is not something the compiler checks. The sidebar navigates to
 * a string; the route table declares a string; the two are edited in different
 * files, and when they disagree the result is not a build failure but React
 * Router's own developer error screen — "Unexpected Application Error! / 404
 * Not Found" — in front of whoever clicked. So the assertions below are written
 * against that screen specifically: each one insists it is absent, because its
 * absence is the whole of what "the link works" means here.
 *
 * The routes are exercised through the real table from AppRoutes, mounted in a
 * memory router. Nothing about the path is restated locally — a test that
 * declared its own copy of "/admin/achievements" would keep passing after
 * somebody renamed the real one.
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

const student: User = {
  ...admin,
  id: 2,
  name: "Bea Cruz",
  firstName: "Bea",
  lastName: "Cruz",
  studentId: "2021-00042",
  email: "bea@netsim.edu",
  role: "student",
  section: { id: 3, name: "BSIT 3-A", yearLevel: "3rd Year" },
};

/**
 * The signed-in user, swapped per test.
 *
 * Hoisted because vi.mock is, and mutable because the guard's three answers —
 * admin, student, nobody — are the point of half the tests here.
 */
const session = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: session.user,
    isAuthenticated: session.user !== null,
    isAdmin: session.user?.role === "admin",
    // Never loading: the guards render a spinner while the session is being
    // restored, and every test here is about what they do once it has been.
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/features/achievements/adminAchievementService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/achievements/adminAchievementService")
  >();

  return { ...actual, fetchAdminAchievements: vi.fn() };
});

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/adminService")>();

  return { ...actual, fetchCohorts: vi.fn() };
});

// Imported after the mocks so the route table's lazy imports pick them up.
const { routes } = await import("./AppRoutes");
const achievementService = await import("@/features/achievements/adminAchievementService");
const adminService = await import("@/features/admin/adminService");

/** The catalogue's own heading, and the one thing only it renders. */
const CATALOGUE = { name: "New achievement" } as const;

/**
 * React Router's unstyled fallback, which is what a broken link actually looks
 * like to a user. Queried rather than asserted absent by proxy: a page that
 * simply failed to render would satisfy "the catalogue is missing" too, and
 * these tests need to tell those two apart.
 */
function routerErrorScreen() {
  return (
    screen.queryByText(/Unexpected Application Error/i) ??
    screen.queryByText(/404 Not Found/i)
  );
}

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

beforeEach(() => {
  session.user = admin;
  vi.mocked(achievementService.fetchAdminAchievements).mockResolvedValue([]);
  vi.mocked(adminService.fetchCohorts).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("reaching the admin achievement catalogue", () => {
  it("matches /admin/achievements against the route table", () => {
    // The narrowest statement of the bug this file exists for. matchRoutes is
    // what React Router itself calls before rendering anything, and a null here
    // is precisely the "404 Not Found" screen — so this fails the moment the
    // route is dropped, renamed or nested somewhere it no longer resolves.
    const matched = matchRoutes(routes, "/admin/achievements");

    expect(matched).not.toBeNull();
    expect(matched!.map((match) => match.route.path)).toEqual([
      undefined, // the admin-only guard, which is pathless
      "/admin",
      "achievements",
    ]);
  });

  it("opens the catalogue on a cold load straight into its URL", async () => {
    // A deep link and a browser refresh are the same event to the app: the
    // router is constructed with the URL already set, and every layout, guard
    // and lazy chunk on the way down has to resolve from nothing. This is the
    // path that has no client-side navigation to lean on.
    mountAt("/admin/achievements");

    expect(await screen.findByRole("button", CATALOGUE)).toBeInTheDocument();
    expect(routerErrorScreen()).toBeNull();
  });

  it("opens the catalogue from the sidebar's Achievements link", async () => {
    // Starting somewhere else in the admin chrome, so this is a real in-app
    // navigation with the layout already mounted — the click a person actually
    // makes, rather than a URL typed into the bar. /admin/profile is the
    // starting point because it is the one admin page that fetches nothing.
    const router = mountAt("/admin/profile");

    await screen.findByRole("button", { name: "Achievements" });
    await userEvent.click(screen.getByRole("button", { name: "Achievements" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/admin/achievements"),
    );
    expect(await screen.findByRole("button", CATALOGUE)).toBeInTheDocument();
    expect(routerErrorScreen()).toBeNull();
  });

  it("keeps the admin chrome around the catalogue", async () => {
    // The route is nested under the layout rather than beside it, so the
    // sidebar and the header stay put. A route registered at the top level
    // would still render the page — and would quietly lose both.
    mountAt("/admin/achievements");

    await screen.findByRole("button", CATALOGUE);

    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Achievements" }),
    ).toBeInTheDocument();
  });

  it("sends every destination the sidebar offers to a real route", async () => {
    // The general case of the same mistake. A path added to the sidebar but not
    // to the table — or renamed in one place only — is invisible until somebody
    // clicks it, and this is the assertion that makes it visible here instead.
    const destinations = [
      ...ADMIN_NAV_ITEMS.map((item) => item.path),
      // Rendered outside the list, so named explicitly.
      "/admin/students",
      "/admin/profile",
    ];

    const unmatched = destinations.filter((path) => matchRoutes(routes, path) === null);

    expect(unmatched).toEqual([]);
    expect(destinations).toContain("/admin/achievements");
  });
});

describe("who the catalogue is for", () => {
  it("lets an admin in", async () => {
    mountAt("/admin/achievements");

    expect(await screen.findByRole("button", CATALOGUE)).toBeInTheDocument();
    expect(achievementService.fetchAdminAchievements).toHaveBeenCalled();
  });

  it("turns a student away without ever loading the catalogue", async () => {
    // The gate is the route guard, not the page: a student is redirected before
    // the achievements chunk is asked for, so the assertion is that the admin
    // service was never called at all rather than that the page looked empty.
    session.user = student;

    const router = mountAt("/admin/achievements");

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));

    expect(screen.queryByRole("button", CATALOGUE)).not.toBeInTheDocument();
    expect(achievementService.fetchAdminAchievements).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in", async () => {
    session.user = null;

    const router = mountAt("/admin/achievements");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));

    expect(screen.queryByRole("button", CATALOGUE)).not.toBeInTheDocument();
    expect(achievementService.fetchAdminAchievements).not.toHaveBeenCalled();
  });
});
