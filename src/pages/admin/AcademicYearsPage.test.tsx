// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AcademicYearsPage } from "./AcademicYearsPage";
import type { AcademicYear } from "@/features/academic/types";

/**
 * The academic years page offers only what the lifecycle allows: a planned
 * year can be made current or (if nothing uses it) deleted, the current year
 * can be edited, and a closed year only read. Making a year current says what
 * it costs before it is done.
 */

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@/features/academic/academicService", () => ({
  fetchAcademicYears: vi.fn(),
  createAcademicYear: vi.fn(),
  updateAcademicYear: vi.fn(),
  activateAcademicYear: vi.fn(),
  deleteAcademicYear: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/academic/academicService");
const { toast } = await import("sonner");

const year = (overrides: Partial<AcademicYear>): AcademicYear => ({
  id: 1,
  name: "2026–2027",
  startsAt: "2026-06-28",
  endsAt: "2027-06-30",
  status: "current",
  statusLabel: "Current",
  isCurrent: true,
  sectionsCount: 28,
  enrollmentsCount: 83,
  ...overrides,
});

const years: AcademicYear[] = [
  year({
    id: 3,
    name: "2027–2028",
    startsAt: "2027-07-01",
    endsAt: "2028-06-30",
    status: "planned",
    statusLabel: "Planned",
    isCurrent: false,
    sectionsCount: 0,
    enrollmentsCount: 0,
  }),
  year({}),
  year({ id: 0, name: "2025–2026", status: "closed", statusLabel: "Closed", isCurrent: false }),
];

beforeEach(() => {
  vi.mocked(service.fetchAcademicYears).mockReset().mockResolvedValue(years);
  vi.mocked(service.activateAcademicYear).mockReset();
  vi.mocked(service.deleteAcademicYear).mockReset();
  vi.mocked(service.createAcademicYear).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(cleanup);

it("offers each year only what its status allows", async () => {
  render(<AcademicYearsPage />);

  await screen.findByText("2027–2028");

  // Planned, unused: make current, edit, delete.
  expect(screen.getAllByRole("button", { name: "Make current" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Delete 2027–2028" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit 2027–2028" })).toBeTruthy();
  // Current: edited, never deleted.
  expect(screen.getByRole("button", { name: "Edit 2026–2027" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Delete 2026–2027" })).toBeNull();
  // Closed: read only.
  expect(screen.queryByRole("button", { name: "Edit 2025–2026" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete 2025–2026" })).toBeNull();
});

it("says what making a year current costs, and does it only once confirmed", async () => {
  vi.mocked(service.activateAcademicYear).mockResolvedValue(years[0]);

  render(<AcademicYearsPage />);

  await userEvent.click(await screen.findByRole("button", { name: "Make current" }));

  const confirm = screen.getByRole("alertdialog", { name: "Make 2027–2028 the current year?" });
  expect(confirm.textContent).toContain("2026–2027 closes");
  expect(confirm.textContent).toContain("Their work, progress and achievements are not touched.");
  expect(service.activateAcademicYear).not.toHaveBeenCalled();

  await userEvent.click(within(confirm).getByRole("button", { name: "Make current" }));

  await waitFor(() => expect(service.activateAcademicYear).toHaveBeenCalledWith(3));
  expect(toast.success).toHaveBeenCalledWith("2027–2028 is now the current academic year.");
});

it("shows the server's refusal in its own words", async () => {
  vi.mocked(service.deleteAcademicYear).mockRejectedValue(
    new Error("2027–2028 still has sections or enrolments, so it cannot be deleted."),
  );

  render(<AcademicYearsPage />);

  await userEvent.click(await screen.findByRole("button", { name: "Delete 2027–2028" }));
  await userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
  );

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "2027–2028 still has sections or enrolments, so it cannot be deleted.",
    ),
  );
});

it("creates a planned year from a name and two dates", async () => {
  vi.mocked(service.createAcademicYear).mockResolvedValue(years[0]);

  render(<AcademicYearsPage />);

  await userEvent.click(await screen.findByRole("button", { name: /New academic year/ }));
  await userEvent.type(screen.getByLabelText("Name"), "2028–2029");
  await userEvent.type(screen.getByLabelText("Starts"), "2028-07-01");
  await userEvent.type(screen.getByLabelText("Ends"), "2029-06-30");
  await userEvent.click(screen.getByRole("button", { name: "Create planned year" }));

  await waitFor(() =>
    expect(service.createAcademicYear).toHaveBeenCalledWith({
      name: "2028–2029",
      startsAt: "2028-07-01",
      endsAt: "2029-06-30",
    }),
  );
});
