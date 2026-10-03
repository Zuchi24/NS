// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { Dashboard } from "./Dashboard";
import type { StudentProgress } from "@/features/content/studentProgress";
import type { ChallengeActivity } from "@/features/content/types";

/**
 * The student's dashboard: three numbers — the last of them how far through the
 * catalogue they are — three shortcuts, and what they have been working on.
 *
 * What these hold to is what the compact layout must not have cost. Every
 * challenge the student has touched is listed — not the newest few — inside a
 * box of its own that scrolls and can be reached from the keyboard, so a long
 * history makes the list longer and not the page. The shortcuts come before
 * that list in the page, which is the order a phone stacks them in. And the
 * loading, error and empty states each still say something.
 */

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { name: "Ana Reyes" } }),
}));

vi.mock("@/features/content/studentProgress", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/studentProgress")
  >();

  return { ...actual, fetchStudentProgress: vi.fn() };
});

const service = await import("@/features/content/studentProgress");

function activity(id: number, over: Partial<ChallengeActivity> = {}): ChallengeActivity {
  return {
    id,
    challengeId: id,
    title: `Challenge ${id}`,
    status: "in_progress",
    statusLabel: "In progress",
    at: null,
    completedAt: null,
    ...over,
  };
}

function progress(over: Partial<StudentProgress> = {}): StudentProgress {
  return {
    challengesPassed: 3,
    challengesTotal: 12,
    challengesInProgress: 2,
    topicsTotal: 5,
    activity: [activity(1), activity(2, { status: "complete", statusLabel: "Completed" })],
    ...over,
  };
}

function show() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("the student dashboard", () => {
  it("greets the student and shows a loading state while progress is on its way", () => {
    vi.mocked(service.fetchStudentProgress).mockReturnValue(new Promise(() => {}));

    show();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, Ana Reyes!");
    expect(screen.getByText("Loading your progress…")).toBeInTheDocument();
  });

  it("shows the error and loads again on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(service.fetchStudentProgress)
      .mockRejectedValueOnce(new Error("Could not reach the server."))
      .mockResolvedValue(progress());

    show();

    expect(await screen.findByText("Could not reach the server.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Challenge 1")).toBeInTheDocument();
    expect(service.fetchStudentProgress).toHaveBeenCalledTimes(2);
  });

  it("shows the three numbers, learning progress last", async () => {
    vi.mocked(service.fetchStudentProgress).mockResolvedValue(progress());

    show();

    expect(await screen.findByText("Learning Progress")).toBeInTheDocument();
    expect(screen.queryByText("Overall Progress")).not.toBeInTheDocument();
    // Shown once, in the summary row, rather than again further down.
    expect(screen.getAllByText("3/12")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("In Progress").nextElementSibling).toHaveTextContent("2");
  });

  it("lists every activity, not the newest few, in a box that scrolls from the keyboard", async () => {
    const many = Array.from({ length: 9 }, (_, index) => activity(index + 1));
    vi.mocked(service.fetchStudentProgress).mockResolvedValue(progress({ activity: many }));

    show();

    const list = await screen.findByRole("region", { name: "Recent activities list" });

    for (let id = 1; id <= 9; id++) {
      expect(within(list).getByText(`Challenge ${id}`)).toBeInTheDocument();
    }

    // Bounded, so the page does not grow with the history; focusable, so a
    // keyboard can scroll what does not fit.
    expect(list).toHaveClass("overflow-y-auto");
    expect(list.className).toMatch(/\bmax-h-/);
    expect(list).toHaveAttribute("tabindex", "0");
  });

  it("says so when there is no activity yet", async () => {
    vi.mocked(service.fetchStudentProgress).mockResolvedValue(progress({ activity: [] }));

    show();

    expect(await screen.findByText("Nothing yet")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent activities list" })).not.toBeInTheDocument();
  });

  it("links to the workspace, challenges and roadmap, ahead of the activity list", async () => {
    vi.mocked(service.fetchStudentProgress).mockResolvedValue(progress());

    show();

    const links = within(await screen.findByRole("navigation", { name: "Quick links" }))
      .getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/workspace",
      "/challenges",
      "/roadmap",
    ]);

    // Earlier in the page, which is the order a narrow screen stacks them in.
    const list = screen.getByRole("region", { name: "Recent activities list" });
    expect(links[0].compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
