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
import { ApiError } from "@/services/api";

/**
 * The one thing this page writes: which section a student is in.
 *
 * The service is stubbed, so these say what the page offers and what it asks
 * for. The one that matters most is that a closed section is never offered as
 * somewhere to move to — the server refuses it anyway, but an instructor should
 * not be given the choice and then told no.
 */

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router", () => ({
  useParams: () => ({ year: "2", sectionId: "6", studentId: "3" }),
  useNavigate: () => navigate,
}));

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin/adminService")>();

  return {
    ...actual,
    fetchStudent: vi.fn(),
    fetchCohorts: vi.fn(),
    moveStudentToSection: vi.fn(),
    resetStudentPassword: vi.fn(),
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
    section: { id: 6, name: "Section A", yearLevel: "Grade 12", yearLevelId: 2 },
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
  vi.mocked(service.resetStudentPassword).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  navigate.mockReset();
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
      section: {
        id: 7,
        name: "Section B",
        yearLevel: "Grade 12",
        yearLevelId: 2,
      },
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

/*
|--------------------------------------------------------------------------
| Resetting the student's password
|--------------------------------------------------------------------------
*/

async function openReset() {
  render(<StudentDetail />);
  await userEvent.click(await screen.findByRole("button", { name: "Reset password" }));

  return screen.getByRole("form", { name: "Reset password for Ana Reyes" });
}

it("offers the reset folded away, asking for nothing until it is opened", async () => {
  render(<StudentDetail />);

  expect(await screen.findByRole("button", { name: "Reset password" })).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  expect(service.resetStudentPassword).not.toHaveBeenCalled();
});

it("sets the student's new password and says so", async () => {
  vi.mocked(service.resetStudentPassword).mockResolvedValue(
    "Ana Reyes's password was reset. They have been signed out and can sign in with the new password.",
  );
  const form = await openReset();

  // No current password is asked for: the student is not the one asking.
  expect(within(form).queryByLabelText(/current password/i)).not.toBeInTheDocument();

  await userEvent.type(within(form).getByLabelText("New password"), "fresh-pass-123");
  await userEvent.type(within(form).getByLabelText("Confirm new password"), "fresh-pass-123");
  await userEvent.click(within(form).getByRole("button", { name: "Set new password" }));

  await waitFor(() =>
    expect(service.resetStudentPassword).toHaveBeenCalledWith(3, "fresh-pass-123", "fresh-pass-123"),
  );
  expect(toast.success).toHaveBeenCalledWith(
    "Ana Reyes's password was reset. They have been signed out and can sign in with the new password.",
  );
  expect(screen.queryByRole("form", { name: /Reset password for/ })).not.toBeInTheDocument();
});

it.each([
  ["", "", "Enter a new password."],
  ["short", "short", "Use at least 8 characters."],
  ["fresh-pass-123", "fresh-pass-999", "The two passwords do not match."],
])("refuses %j / %j before asking the server", async (password, confirmation, message) => {
  const form = await openReset();

  if (password) await userEvent.type(within(form).getByLabelText("New password"), password);
  if (confirmation) {
    await userEvent.type(within(form).getByLabelText("Confirm new password"), confirmation);
  }
  await userEvent.click(within(form).getByRole("button", { name: "Set new password" }));

  expect(within(form).getByText(message)).toBeInTheDocument();
  expect(service.resetStudentPassword).not.toHaveBeenCalled();
});

it("shows the server's refusal of the password against the field", async () => {
  vi.mocked(service.resetStudentPassword).mockRejectedValue(
    new ApiError("The given data was invalid.", 422, {
      password: ["The password field must be at least 8 characters."],
    }),
  );
  const form = await openReset();

  await userEvent.type(within(form).getByLabelText("New password"), "fresh-pass-123");
  await userEvent.type(within(form).getByLabelText("Confirm new password"), "fresh-pass-123");
  await userEvent.click(within(form).getByRole("button", { name: "Set new password" }));

  expect(
    await within(form).findByText("The password field must be at least 8 characters."),
  ).toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

it("shows any other refusal in the server's words, and keeps the form", async () => {
  vi.mocked(service.resetStudentPassword).mockRejectedValue(
    new ApiError("This area is for instructors.", 403),
  );
  const form = await openReset();

  await userEvent.type(within(form).getByLabelText("New password"), "fresh-pass-123");
  await userEvent.type(within(form).getByLabelText("Confirm new password"), "fresh-pass-123");
  await userEvent.click(within(form).getByRole("button", { name: "Set new password" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This area is for instructors."));
  expect(screen.getByRole("form", { name: "Reset password for Ana Reyes" })).toBeInTheDocument();
});

it("sends one reset however quickly it is clicked", async () => {
  let finish!: (message: string) => void;
  vi.mocked(service.resetStudentPassword).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const form = await openReset();

  await userEvent.type(within(form).getByLabelText("New password"), "fresh-pass-123");
  await userEvent.type(within(form).getByLabelText("Confirm new password"), "fresh-pass-123");
  await userEvent.click(within(form).getByRole("button", { name: "Set new password" }));

  const pending = within(form).getByRole("button", { name: "Resetting…" });
  expect(pending).toBeDisabled();
  await userEvent.click(pending);

  expect(service.resetStudentPassword).toHaveBeenCalledTimes(1);
  finish("done");
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("done"));
});

it("follows a moved student to their new section's address", async () => {
  // Moved out of Grade 12 / Section A into Grade 11 / Section D.
  vi.mocked(service.moveStudentToSection).mockResolvedValue({
    ...detail,
    student: {
      ...detail.student,
      section: { id: 9, name: "Section D", yearLevel: "Grade 11", yearLevelId: 1 },
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
    expect(navigate).toHaveBeenCalledWith("/admin/students/1/9/3", {
      replace: true,
    }),
  );
});

it("goes back to the roster the student is on, not the one in the address", async () => {
  // Opened at /admin/students/2/6/3, but placed in Grade 11 / Section D.
  vi.mocked(service.fetchStudent).mockResolvedValue({
    ...detail,
    student: {
      ...detail.student,
      section: { id: 9, name: "Section D", yearLevel: "Grade 11", yearLevelId: 1 },
    },
  });

  render(<StudentDetail />);

  await userEvent.click(await screen.findByRole("button", { name: "Back" }));

  expect(navigate).toHaveBeenCalledWith("/admin/students/1/9");
});
