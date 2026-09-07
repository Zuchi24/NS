// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { YearView } from "./YearView";
import type { YearLevelCohort } from "@/features/admin/types";

/**
 * The sections of one year level, and the one decision an instructor can take
 * about them.
 *
 * The service is stubbed, so these say what the page asks for and what it does
 * with the answer. Two of them carry the weight: a closed section is still
 * shown — hiding it would put a class out of reach of the person responsible
 * for it, and there would then be no way to reopen it — and closing one is
 * offered without a confirmation, because it is reversible and costs the
 * students in it nothing.
 */

vi.mock("react-router", () => ({
  useParams: () => ({ year: "2" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/admin/adminService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin/adminService")>();

  return {
    ...actual,
    fetchCohorts: vi.fn(),
    activateSection: vi.fn(),
    deactivateSection: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/admin/adminService");
const { toast } = await import("sonner");

function cohort(isActive: boolean): YearLevelCohort[] {
  return [
    {
      id: 2,
      code: "G12",
      name: "Grade 12",
      studentsCount: 3,
      sections: [
        {
          id: 7,
          name: "Section B",
          capacity: 40,
          studentsCount: 3,
          isActive,
        },
      ],
    },
  ];
}

beforeEach(() => {
  vi.mocked(service.fetchCohorts).mockReset();
  vi.mocked(service.activateSection).mockReset();
  vi.mocked(service.deactivateSection).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(cleanup);

it("offers to close a section that is open", async () => {
  vi.mocked(service.fetchCohorts).mockResolvedValue(cohort(true));

  render(<YearView />);

  expect(await screen.findByText("Section B")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Close section" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Closed to new sign-ups")).not.toBeInTheDocument();
});

it("still shows a closed section, and offers to reopen it", async () => {
  vi.mocked(service.fetchCohorts).mockResolvedValue(cohort(false));

  render(<YearView />);

  // The roster stays reachable and the decision stays reversible; both need the
  // section to still be on the page.
  expect(await screen.findByText("Section B")).toBeInTheDocument();
  expect(screen.getByText("Closed to new sign-ups")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reopen section" }),
  ).toBeInTheDocument();
});

it("closes a section and says so", async () => {
  vi.mocked(service.fetchCohorts).mockResolvedValue(cohort(true));
  vi.mocked(service.deactivateSection).mockResolvedValue({
    id: 7,
    name: "Section B",
    capacity: 40,
    isActive: false,
  });

  render(<YearView />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Close section" }),
  );

  await waitFor(() =>
    expect(service.deactivateSection).toHaveBeenCalledWith(7),
  );
  expect(toast.success).toHaveBeenCalledWith(
    "Section B is closed to new sign-ups.",
  );
});

it("reopens a closed section", async () => {
  vi.mocked(service.fetchCohorts).mockResolvedValue(cohort(false));
  vi.mocked(service.activateSection).mockResolvedValue({
    id: 7,
    name: "Section B",
    capacity: 40,
    isActive: true,
  });

  render(<YearView />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Reopen section" }),
  );

  await waitFor(() => expect(service.activateSection).toHaveBeenCalledWith(7));
  expect(toast.success).toHaveBeenCalledWith("Section B is open for sign-ups.");
});

it("says what went wrong and leaves the section alone", async () => {
  vi.mocked(service.fetchCohorts).mockResolvedValue(cohort(true));
  vi.mocked(service.deactivateSection).mockRejectedValue(
    new Error("You do not have permission to do that."),
  );

  render(<YearView />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Close section" }),
  );

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "You do not have permission to do that.",
    ),
  );
  // Still offering to close it: nothing changed, so the page must not say it
  // did.
  expect(
    screen.getByRole("button", { name: "Close section" }),
  ).toBeInTheDocument();
});
