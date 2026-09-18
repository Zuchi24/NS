// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, matchRoutes } from "react-router";

import { warmLazyRoutes } from "@/test/lazyRoutes";
import type { User } from "@/features/auth/types";

/**
 * Reaching a student's assessment page through the real route table.
 *
 * AssessmentPage.test.tsx says what the page does once it is on screen. This
 * says who gets there: a student does, through a lazily loaded route; an admin
 * is turned away before the page's chunk is asked for, so the student
 * assessment API is never called on their behalf; and a signed-out visitor is
 * sent to sign in.
 *
 * The first find after a cold load is given longer than the default: the page
 * is a lazy chunk, and under a full parallel run it can take over a second.
 */

const student: User = {
  id: 2,
  name: "Bea Cruz",
  firstName: "Bea",
  lastName: "Cruz",
  studentId: "2021-00042",
  email: "bea@netsim.edu",
  role: "student",
  joinedAt: "2025-01-06T00:00:00Z",
  section: { id: 3, name: "BSIT 3-A", yearLevel: "3rd Year" },
};

const admin: User = {
  ...student,
  id: 1,
  name: "Ada Reyes",
  firstName: "Ada",
  lastName: "Reyes",
  studentId: null,
  email: "ada@netsim.edu",
  role: "admin",
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

vi.mock("@/features/assessments/studentAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/studentAssessmentService")
  >();

  return { ...actual, fetchStudentAssessment: vi.fn(), fetchOwnAttemptReview: vi.fn() };
});

// Imported after the mocks so the route table's lazy imports pick them up.
const { routes } = await import("./AppRoutes");
const service = await import("@/features/assessments/studentAssessmentService");

const SLOW = { timeout: 5000 };

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

// The page this file mounts, loaded before anything is timed — see
// warmLazyRoutes. Until it is, even the guard tests below are waiting on it:
// the router resolves the chunk before it renders the branch the guard is in.
beforeAll(async () => {
  expect(await warmLazyRoutes(routes, ["/assessments/11"])).toBeGreaterThan(0);
}, 30_000);

beforeEach(() => {
  session.user = student;
  vi.mocked(service.fetchStudentAssessment).mockResolvedValue({
    id: 11,
    topicId: 4,
    type: "pre_test",
    title: "Networking Fundamentals",
    description: null,
    questions: [],
  });
  // The page asks this of every assessment it opens, ahead of the assessment
  // itself: nothing taken here, so the form is what the student lands on.
  vi.mocked(service.fetchOwnAttemptReview).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the student assessment route", () => {
  it("resolves /assessments/:assessmentId behind the student-only guard", () => {
    const matched = matchRoutes(routes, "/assessments/11");

    expect(matched).not.toBeNull();
    expect(matched!.map((match) => match.route.path)).toEqual([
      undefined, // the student-only guard, which is pathless
      "/assessments/:assessmentId",
    ]);

    const page = matched![matched!.length - 1];
    expect(page.params).toEqual({ assessmentId: "11" });
    expect(typeof page.route.lazy).toBe("function");
    expect(page.route.Component).toBeUndefined();
  });

  it("opens the page for a student on a cold load", async () => {
    mountAt("/assessments/11");

    expect(
      await screen.findByRole("heading", { name: "Networking Fundamentals" }, SLOW),
    ).toBeInTheDocument();
    expect(service.fetchStudentAssessment).toHaveBeenCalledWith(11);
  });

  it("turns an admin away without asking for the assessment", async () => {
    session.user = admin;

    const router = mountAt("/assessments/11");

    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));

    expect(service.fetchStudentAssessment).not.toHaveBeenCalled();
    expect(service.fetchOwnAttemptReview).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in", async () => {
    session.user = null;

    const router = mountAt("/assessments/11");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));

    expect(service.fetchStudentAssessment).not.toHaveBeenCalled();
  });
});
