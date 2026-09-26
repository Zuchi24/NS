// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Dashboard } from "./Dashboard";
import type { Overview } from "@/features/admin/types";
import type { AcademicYear } from "@/features/academic/types";

/**
 * The dashboard reports the current academic year, and another when one is
 * chosen — asking the server for that year rather than working it out here.
 */

vi.mock("./CompletionChart", () => ({ CompletionChart: () => null }));

vi.mock("@/features/admin/adminService", () => ({ fetchOverview: vi.fn() }));
vi.mock("@/features/academic/academicService", () => ({ fetchAcademicYears: vi.fn() }));

const admin = await import("@/features/admin/adminService");
const academic = await import("@/features/academic/academicService");

const overview = (year: Overview["academicYear"], students: number): Overview => ({
  academicYear: year,
  students,
  unassignedStudents: 0,
  topics: 4,
  challenges: 10,
  sections: 28,
  yearLevels: 4,
  activeStudents: 1,
  activeWithinDays: 7,
  challengeCompletion: { count: 5, possible: 20, percent: 25 },
  submissions: { total: 6, passed: 5, passRate: 83 },
  byYearLevel: [],
});

const years: AcademicYear[] = [
  {
    id: 2, name: "2026–2027", startsAt: "2026-06-28", endsAt: "2027-06-30",
    status: "current", statusLabel: "Current", isCurrent: true, sectionsCount: 28, enrollmentsCount: 83,
  },
  {
    id: 1, name: "2025–2026", startsAt: "2025-06-01", endsAt: "2026-05-31",
    status: "closed", statusLabel: "Closed", isCurrent: false, sectionsCount: 7, enrollmentsCount: 40,
  },
];

beforeEach(() => {
  vi.mocked(academic.fetchAcademicYears).mockReset().mockResolvedValue(years);
  vi.mocked(admin.fetchOverview).mockReset().mockImplementation(async (id?: number) =>
    id === 1
      ? overview({ id: 1, name: "2025–2026", status: "closed" }, 40)
      : overview({ id: 2, name: "2026–2027", status: "current" }, 87),
  );
});

afterEach(cleanup);

it("reports the current year until another is chosen", async () => {
  render(<Dashboard />);

  expect(await screen.findByText("87")).toBeTruthy();
  expect(admin.fetchOverview).toHaveBeenCalledWith(undefined);
  expect(((await screen.findByLabelText("Academic year")) as HTMLSelectElement).value).toBe("2");
});

it("asks the server for a past year and says what its figures count", async () => {
  render(<Dashboard />);

  await userEvent.selectOptions(await screen.findByLabelText("Academic year"), "1");

  await waitFor(() => expect(admin.fetchOverview).toHaveBeenLastCalledWith(1));
  expect(await screen.findByText("40")).toBeTruthy();
  expect(screen.getByText(/2025–2026's cohort, grouped by where each/)).toBeTruthy();
});
