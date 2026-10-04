// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Analytics } from "./Analytics";
import type { ChallengePerformance } from "@/features/admin/types";

/**
 * The four summary cards above the challenge list.
 *
 * The one worth testing is "Students attempting", because its value and its
 * caption are worked out in different places: the caption says "on the busiest"
 * and the value used to be whatever the first challenge in the catalogue
 * happened to report. The two agreed for as long as the catalogue's first
 * challenge was also its most attempted, which is the usual case and exactly
 * why nobody noticed.
 *
 * So the fixture below deliberately puts the busiest challenge last. Ordered by
 * the catalogue it is third; ordered by take-up it is first, and that is the
 * number the card claims to be showing.
 */

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/admin/adminService")
  >();

  return { ...actual, fetchAnalytics: vi.fn() };
});

const service = await import("@/features/admin/adminService");

/** A challenge row, with only the fields a given test cares about set. */
function challenge(
  overrides: Partial<ChallengePerformance> & { id: number },
): ChallengePerformance {
  return {
    title: `Challenge ${overrides.id}`,
    kind: "topology",
    submissions: 0,
    passedSubmissions: 0,
    passRate: 0,
    studentsAttempted: 0,
    studentsPassed: 0,
    studentPassRate: 0,
    averageMinutes: null,
    ...overrides,
  };
}

/** The value rendered on one of the summary cards, found by its label. */
function cardValue(label: string): string {
  const heading = screen.getByText(label);
  const card = heading.closest("div")?.parentElement;

  return card?.querySelector("p.text-3xl")?.textContent ?? "";
}

beforeEach(() => {
  vi.mocked(service.fetchAnalytics).mockReset();
});

afterEach(cleanup);

it("counts the busiest challenge, not the first one in the catalogue", async () => {
  vi.mocked(service.fetchAnalytics).mockResolvedValue({
    totalStudents: 40,
    challenges: [
      // First in the catalogue, and the one the card used to report.
      challenge({ id: 1, title: "Assemble a working PC", studentsAttempted: 4 }),
      challenge({ id: 2, title: "Terminate a cable", studentsAttempted: 9 }),
      // Last in the catalogue, busiest by some way.
      challenge({ id: 3, title: "Wire the computer lab", studentsAttempted: 31 }),
    ],
  });

  render(<Analytics />);

  await screen.findByText("Challenge performance");

  expect(cardValue("Students attempting")).toBe("31");
});

it("says nothing has been attempted rather than picking a number", async () => {
  vi.mocked(service.fetchAnalytics).mockResolvedValue({ totalStudents: 0, challenges: [] });

  render(<Analytics />);

  // An empty catalogue has no busiest challenge. Zero is the honest answer and,
  // more to the point, reducing over nothing must not throw.
  await screen.findByText("No challenges yet");

  expect(cardValue("Students attempting")).toBe("0");
});

it("holds when every challenge is equally busy", async () => {
  vi.mocked(service.fetchAnalytics).mockResolvedValue({
    totalStudents: 40,
    challenges: [
      challenge({ id: 1, studentsAttempted: 7 }),
      challenge({ id: 2, studentsAttempted: 7 }),
    ],
  });

  render(<Analytics />);

  await screen.findByText("Challenge performance");

  // The degenerate case the old code got right by accident, kept right.
  expect(cardValue("Students attempting")).toBe("7");
});

it("shows students passed out of every registered student, not those who attempted", async () => {
  vi.mocked(service.fetchAnalytics).mockResolvedValue({
    totalStudents: 25,
    challenges: [
      challenge({ id: 1, title: "Terminate a cable", studentsAttempted: 3, studentsPassed: 2 }),
    ],
  });

  render(<Analytics />);

  await screen.findByText("Challenge performance");

  expect(screen.getByText(/2 \/ 25 students\s+passed/)).toBeTruthy();
});

it("says a pass rate is of submissions that passed, not of students who submitted", async () => {
  // Half the cohort has passed, and every submission made so far passed: the
  // two students who have not passed have not submitted at all. "2/2 submitted"
  // read as two of two students submitting, beside a row that says 2 of 4.
  vi.mocked(service.fetchAnalytics).mockResolvedValue({
    totalStudents: 4,
    challenges: [
      challenge({
        id: 1,
        title: "Assemble a working PC",
        submissions: 2,
        passedSubmissions: 2,
        passRate: 100,
        studentsAttempted: 2,
        studentsPassed: 2,
        studentPassRate: 100,
      }),
    ],
  });

  const { container } = render(<Analytics />);

  await screen.findByText("Challenge performance");

  expect(screen.getByText(/2 \/ 4 students\s+passed/)).toBeTruthy();
  expect(screen.getByText("100% of submissions passed")).toBeTruthy();
  expect(screen.getByText(/2\/2\s+submissions passed/)).toBeTruthy();
  expect(container.textContent).not.toMatch(/2\/2\s+submitted/);
});
