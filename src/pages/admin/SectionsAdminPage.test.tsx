// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SectionsAdminPage } from "./SectionsAdminPage";
import type { AcademicYear, ManagedSection, ManagedYearLevel } from "@/features/academic/types";

/**
 * One academic year's sections: the page shows the year asked for (or the
 * current one), offers delete only for a section nobody is placed in, and
 * offers nothing but reading for a closed year.
 */

const { params, setParams, navigate } = vi.hoisted(() => ({
  params: { value: new URLSearchParams() },
  setParams: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [params.value, setParams],
}));

vi.mock("@/features/academic/academicService", () => ({
  fetchAcademicYears: vi.fn(),
  fetchYearLevels: vi.fn(),
  fetchYearSections: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
}));

vi.mock("@/features/admin/adminService", () => ({
  activateSection: vi.fn(),
  deactivateSection: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/academic/academicService");

const years: AcademicYear[] = [
  {
    id: 2, name: "2026–2027", startsAt: "2026-06-28", endsAt: "2027-06-30",
    status: "current", statusLabel: "Current", isCurrent: true, sectionsCount: 2, enrollmentsCount: 5,
  },
  {
    id: 1, name: "2025–2026", startsAt: "2025-06-01", endsAt: "2026-05-31",
    status: "closed", statusLabel: "Closed", isCurrent: false, sectionsCount: 1, enrollmentsCount: 4,
  },
];

const levels: ManagedYearLevel[] = [
  { id: 1, code: "1ST", name: "1st Year", levelOrder: 1, sectionsCount: 3 },
];

const section = (overrides: Partial<ManagedSection>): ManagedSection => ({
  id: 10,
  name: "Section A",
  capacity: 40,
  isActive: true,
  yearLevel: { id: 1, name: "1st Year" },
  academicYear: { id: 2, name: "2026–2027", status: "current" },
  enrollmentsCount: 5,
  ...overrides,
});

beforeEach(() => {
  params.value = new URLSearchParams();
  vi.mocked(service.fetchAcademicYears).mockReset().mockResolvedValue(years);
  vi.mocked(service.fetchYearLevels).mockReset().mockResolvedValue(levels);
  vi.mocked(service.fetchYearSections).mockReset().mockImplementation(async (id: number) =>
    id === 2
      ? [section({}), section({ id: 11, name: "Section B", enrollmentsCount: 0 })]
      : [section({ id: 3, academicYear: { id: 1, name: "2025–2026", status: "closed" } })],
  );
  vi.mocked(service.deleteSection).mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

it("shows the current year's sections unless another is asked for", async () => {
  render(<SectionsAdminPage />);

  await screen.findByText("Section B");

  expect(service.fetchYearSections).toHaveBeenCalledWith(2);
  expect((screen.getByRole("combobox", { name: "Academic year" }) as HTMLSelectElement).value).toBe("2");
});

it("offers to delete only a section nobody is placed in", async () => {
  render(<SectionsAdminPage />);

  await screen.findByText("Section B");

  expect(screen.queryByRole("button", { name: "Delete 1st Year Section A" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Delete 1st Year Section B" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() => expect(service.deleteSection).toHaveBeenCalledWith(11));
});

it("only reads a closed year", async () => {
  params.value = new URLSearchParams("year=1");

  render(<SectionsAdminPage />);

  await screen.findByText(/A closed year is kept as it was/);

  expect(service.fetchYearSections).toHaveBeenCalledWith(1);
  expect(screen.getByRole("button", { name: /Roster/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /New section/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Close$|^Reopen$/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
});
