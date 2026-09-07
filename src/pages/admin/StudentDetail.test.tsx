// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StudentDetail } from "./StudentDetail";
import type { StudentDetail as Detail } from "@/features/admin/types";
import type { YearLevelCohort } from "@/features/admin/types";

/**
 * The one thing this page writes: which section a student is in.
 *
 * The service is stubbed, so these say what the page offers and what it asks
 * for. The one that matters most is that a closed section is never offered as
 * somewhere to move to — the server refuses it anyway, but an instructor should
 * not be given the choice and then told no.
 */

vi.mock("react-router", () => ({
  useParams: () => ({ year: "2", sectionId: "6", studentId: "3" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin/adminService")>();

  return {
    ...actual,
    fetchStudent: vi.fn(),
    fetchCohorts: vi.fn(),
    moveStudentToSection: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/admin/adminService");
const { toast } = await import("sonner");

const detail: Detail = {
  student: {
    id: 3,
    studentId: "2024-0003",
    firstName: "Ana",
    lastName: "Reyes",
    fullName: "Ana Reyes",
    email: "ana@example.test",
    section: { id: 6, name: "Section A", yearLevel: "Grade 12" },
    summary: {
      challengesPassed: 1,
      challengesTotal: 2,
      submissions: 2,
      completionPercent: 50,
      lastActiveAt: "2026-09-01T00:00:00Z",
      standing: "progressing",
      standingLabel: "Progressing",
    },
  },
  challenges: [],
};

const cohorts: YearLevelCohort[] = [
  {
    id: 2,
    code: "G12",
    name: "Grade 12",
    studentsCount: 5,
    sections: [
      { id: 6, name: "Section A", capacity: 40, studentsCount: 3, isActive: true },
      { id: 7, name: "Section B", capacity: 40, studentsCount: 2, isActive: true },
      {
        id: 8,
        name: "Section C",
        capacity: 40,
        studentsCount: 0,
        isActive: false,
      },
    ],
  },
];

beforeEach(() => {
  vi.mocked(service.fetchStudent).mockReset().mockResolvedValue(detail);
  vi.mocked(service.fetchCohorts).mockReset().mockResolvedValue(cohorts);
  vi.mocked(service.moveStudentToSection).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(cleanup);

it("does not fetch the timetable until the move is asked for", async () => {
  render(<StudentDetail />);

  expect(
    await screen.findByRole("button", { name: "Move to another section" }),
  ).toBeInTheDocument();
  // Most visits here are to read progress; the sections are not part of that.
  expect(service.fetchCohorts).not.toHaveBeenCalled();
});

it("offers only the sections that are open", async () => {
  render(<StudentDetail />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Move to another section" }),
  );

  const select = await screen.findByRole("combobox", { name: "Section" });
  const options = within(select).getAllByRole("option");

  expect(options.map((option) => option.textContent)).toEqual([
    "Choose a section…",
    "Grade 12 - Section A",
    "Grade 12 - Section B",
  ]);
});

it("moves the student and says so", async () => {
  vi.mocked(service.moveStudentToSection).mockResolvedValue({
    ...detail,
    student: {
      ...detail.student,
      section: { id: 7, name: "Section B", yearLevel: "Grade 12" },
    },
  });

  render(<StudentDetail />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Move to another section" }),
  );
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "Section" }),
    "7",
  );
  await userEvent.click(screen.getByRole("button", { name: "Move" }));

  await waitFor(() =>
    expect(service.moveStudentToSection).toHaveBeenCalledWith(3, 7),
  );
  expect(toast.success).toHaveBeenCalledWith("Moved Ana Reyes.");
});

it("will not move anybody until a section is chosen", async () => {
  render(<StudentDetail />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Move to another section" }),
  );

  expect(await screen.findByRole("button", { name: "Move" })).toBeDisabled();
  expect(service.moveStudentToSection).not.toHaveBeenCalled();
});

it("shows the server's refusal in its own words", async () => {
  vi.mocked(service.moveStudentToSection).mockRejectedValue(
    new Error("That section is not open for enrolment."),
  );

  render(<StudentDetail />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Move to another section" }),
  );
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "Section" }),
    "7",
  );
  await userEvent.click(screen.getByRole("button", { name: "Move" }));

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "That section is not open for enrolment.",
    ),
  );
  // The form stays open with the choice still in it, so the instructor can
  // pick again rather than start over.
  expect(screen.getByRole("button", { name: "Move" })).toBeInTheDocument();
});
