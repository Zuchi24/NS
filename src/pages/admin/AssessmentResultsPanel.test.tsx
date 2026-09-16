// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";

import { AssessmentResultsPanel } from "./AssessmentResultsPanel";
import type { AssessmentResult } from "@/features/assessments/adminAssessmentService";

/**
 * Who has taken an assessment, as their instructor reads it.
 *
 * The service is stubbed, so these say what the panel asks for and what it
 * draws with the answer. What carries weight here is what is on the row — a
 * name, a score, a percentage and a time — and what is not: the panel is given
 * no answers to show, and it invents no average or ranking from the ones it
 * has.
 */

vi.mock("@/features/assessments/adminAssessmentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/assessments/adminAssessmentService")
  >();

  return { ...actual, fetchAssessmentResults: vi.fn() };
});

const service = await import("@/features/assessments/adminAssessmentService");

function result(over: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: 500,
    student: { id: 7, studentId: "2024-00123", fullName: "Juan Dela Cruz" },
    earnedPoints: 8,
    totalPoints: 10,
    percent: 80,
    submittedAt: "2026-09-17T08:30:00.000000Z",
    ...over,
  };
}

async function show(results: AssessmentResult[]) {
  vi.mocked(service.fetchAssessmentResults).mockResolvedValue(results);

  const rendered = render(<AssessmentResultsPanel assessmentId={11} />);

  await waitFor(() =>
    expect(screen.queryByText(/loading results/i)).not.toBeInTheDocument(),
  );

  return rendered;
}

/** The row for one student, found by their name. */
function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("reading an assessment's results", () => {
  it("asks for the results of the assessment it was given", async () => {
    await show([]);

    expect(service.fetchAssessmentResults).toHaveBeenCalledWith(11);
    expect(service.fetchAssessmentResults).toHaveBeenCalledTimes(1);
  });

  it("names each student who submitted, with their score and when", async () => {
    await show([result()]);

    const row = within(rowFor("Juan Dela Cruz"));

    expect(row.getByText("8 / 10")).toBeInTheDocument();
    expect(row.getByText("80%")).toBeInTheDocument();
    // The school's id under the name, because two students can share one.
    expect(row.getByText("2024-00123")).toBeInTheDocument();
    // Formatted for the reader rather than shown as the ISO string it arrived
    // as; the date itself is what matters, not this locale's punctuation.
    expect(row.queryByText("2026-09-17T08:30:00.000000Z")).toBeNull();
    expect(row.getByText(/2026/)).toBeInTheDocument();
  });

  it("keeps the percentage the server sent rather than working one out", async () => {
    await show([result({ earnedPoints: 2, totalPoints: 3, percent: 66.67 })]);

    // Two thirds as the server rounded it. Recomputing it here is how an
    // instructor and a student end up reading different scores.
    expect(screen.getByText("66.67%")).toBeInTheDocument();
  });

  it("draws every student who took it, in the order the server sent them", async () => {
    await show([
      result({ id: 3, student: { id: 3, studentId: "C", fullName: "Third Cruz" } }),
      result({ id: 2, student: { id: 2, studentId: "B", fullName: "Second Cruz" } }),
      result({ id: 1, student: { id: 1, studentId: "A", fullName: "First Cruz" } }),
    ]);

    const names = screen
      .getAllByRole("row")
      // The header row has no student in it.
      .slice(1)
      .map((row) => within(row).getAllByRole("cell").length > 0
        ? (row.querySelector("th")?.textContent ?? "")
        : "");

    expect(names[0]).toContain("Third Cruz");
    expect(names[2]).toContain("First Cruz");
    expect(screen.getByText("3 students submitted, most recent first.")).toBeInTheDocument();
  });

  it("says so plainly when nobody has taken it yet", async () => {
    await show([]);

    expect(
      screen.getByText("No students have submitted this assessment yet."),
    ).toBeInTheDocument();
    // An empty list is an answer, not a failure: nothing here offers a retry.
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("shows the server's own words when it refuses, and offers to ask again", async () => {
    vi.mocked(service.fetchAssessmentResults).mockRejectedValue(
      new Error("This action is unauthorized."),
    );

    render(<AssessmentResultsPanel assessmentId={11} />);

    expect(
      await screen.findByText("This action is unauthorized."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("says it is loading before the server has answered", async () => {
    vi.mocked(service.fetchAssessmentResults).mockReturnValue(new Promise(() => {}));

    render(<AssessmentResultsPanel assessmentId={11} />);

    expect(screen.getByText(/loading results/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("carries no answers, and makes no claim about the class", async () => {
    await show([
      result({ id: 1, earnedPoints: 10, totalPoints: 10, percent: 100 }),
      result({
        id: 2,
        student: { id: 8, studentId: "2024-00124", fullName: "Maria Santos" },
        earnedPoints: 4,
        totalPoints: 10,
        percent: 40,
      }),
    ]);

    // Nothing about which choices were picked — the server does not send them,
    // and this panel is not where that would be decided.
    expect(screen.queryByText(/correct|answer|choice/i)).toBeNull();

    // No average, no rank, no pass mark: a roster is a record of the class,
    // not a verdict on it.
    expect(screen.queryByText(/average|mean|rank|highest|lowest|top/i)).toBeNull();
    expect(screen.queryByText("70%")).toBeNull();
  });

  it("is a region a screen reader can find and a table it can read", async () => {
    await show([result()]);

    expect(screen.getByRole("region", { name: "Results" })).toBeInTheDocument();

    // Column headers, and the student's name as the row's own header, so a cell
    // is announced with both what it is and whose it is.
    expect(screen.getByRole("columnheader", { name: "Student" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Percentage" })).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /Juan Dela Cruz/ }),
    ).toBeInTheDocument();
  });

  it("shows a dash rather than an empty cell when the time is missing", async () => {
    await show([result({ submittedAt: null })]);

    expect(within(rowFor("Juan Dela Cruz")).getByText("—")).toBeInTheDocument();
  });
});
