// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PromotionPage } from "./PromotionPage";
import { ApiError } from "@/services/api";
import type { AcademicYear, PromotionOutcome, PromotionPreview } from "@/features/academic/types";

/**
 * Moving students into a year: preview, review, check, commit — and never
 * the commit before a check of exactly what is on screen.
 */

const { navigate, params } = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { value: { id: "3" } as Record<string, string> },
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => params.value,
}));

vi.mock("@/features/academic/academicService", () => ({
  fetchAcademicYears: vi.fn(),
  fetchPromotionPreview: vi.fn(),
  commitPromotion: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const service = await import("@/features/academic/academicService");
const { toast } = await import("sonner");

const year = (overrides: Partial<AcademicYear>): AcademicYear => ({
  id: 2,
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
  year({ id: 3, name: "2027–2028", status: "planned", statusLabel: "Planned", isCurrent: false }),
  year({}),
  year({ id: 1, name: "2025–2026", status: "closed", statusLabel: "Closed", isCurrent: false }),
];

const level = (n: number) => ({ id: n, name: `${n}${["st", "nd", "rd", "th"][n - 1]} Year`, levelOrder: n });
const at = (sectionId: number, name: string, levelOrder: number) => ({
  section: { id: sectionId, name },
  yearLevel: level(levelOrder),
});

const preview: PromotionPreview = {
  from: { id: 2, name: "2026–2027" },
  to: { id: 3, name: "2027–2028" },
  rows: [
    { student: { id: 10, studentId: "S-10", fullName: "Ana Reyes" }, from: at(1, "Section A", 1), proposed: at(31, "Section A", 2), reason: "promoted" },
    { student: { id: 11, studentId: "S-11", fullName: "Ben Cruz" }, from: at(22, "Section A", 4), proposed: null, reason: "no_next_year_level" },
    { student: { id: 12, studentId: "S-12", fullName: "Cara Lim" }, from: at(16, "Section B", 3), proposed: null, reason: "no_matching_section" },
    { student: { id: 13, studentId: "S-13", fullName: "Dan Uy" }, from: at(8, "Section A", 2), proposed: at(33, "Section A", 3), reason: "already_placed" },
  ],
  sections: [
    { ...at(30, "Section A", 1), isActive: true },
    { ...at(31, "Section A", 2), isActive: true },
    { ...at(33, "Section A", 3), isActive: true },
    { ...at(34, "Section A", 4), isActive: true },
  ],
};

const outcome = (dryRun: boolean): PromotionOutcome => ({
  dryRun,
  created: [
    { studentId: 10, sectionId: 31 },
    { studentId: 12, sectionId: 33 },
  ],
  skipped: [],
  notPlaced: [{ studentId: 11 }],
});

beforeEach(() => {
  params.value = { id: "3" };
  vi.mocked(service.fetchAcademicYears).mockReset().mockResolvedValue(years);
  vi.mocked(service.fetchPromotionPreview).mockReset().mockResolvedValue(preview);
  vi.mocked(service.commitPromotion).mockReset().mockImplementation(async (_to, _p, dryRun) => outcome(dryRun));
  vi.mocked(toast.success).mockReset();
});

afterEach(cleanup);

/** Loads the preview and decides the one student the server could not. */
async function reviewed() {
  render(<PromotionPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview" }));
  await screen.findByText("Ana Reyes");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Placement for Cara Lim" }), "33");
}

it("moves students from the current year by default, and previews nothing until asked", async () => {
  render(<PromotionPage />);

  const source = (await screen.findByRole("combobox", { name: "Move students from" })) as HTMLSelectElement;

  expect(source.value).toBe("2");
  expect(screen.getByText("Move students into 2027–2028")).toBeTruthy();
  expect(service.fetchPromotionPreview).not.toHaveBeenCalled();
});

it("asks the server for the preview and shows every student's proposal", async () => {
  render(<PromotionPage />);

  await userEvent.click(await screen.findByRole("button", { name: "Preview" }));

  await waitFor(() => expect(service.fetchPromotionPreview).toHaveBeenCalledWith(3, 2));
  expect(await screen.findByText("Ana Reyes")).toBeTruthy();
  expect((screen.getByRole("combobox", { name: "Placement for Ana Reyes" }) as HTMLSelectElement).value).toBe("31");
  expect((screen.getByRole("combobox", { name: "Placement for Ben Cruz" }) as HTMLSelectElement).value).toBe("none");
  expect((screen.getByRole("combobox", { name: "Placement for Cara Lim" }) as HTMLSelectElement).value).toBe("");
  // Already placed next year: shown, not offered.
  expect(screen.queryByRole("combobox", { name: "Placement for Dan Uy" })).toBeNull();
  expect(screen.getByText("Already placed in this year; left as they are.")).toBeTruthy();

  // Four students: one proposed a section, one with no higher year level,
  // one the server could not propose for, one already placed.
  const summary = within(screen.getByLabelText("Summary"));
  const figure = (label: string) => summary.getByText(label).nextElementSibling?.textContent;

  expect(figure("Students")).toBe("4");
  expect(figure("To place")).toBe("1");
  expect(figure("Not placed")).toBe("1");
  expect(figure("Need a decision")).toBe("1");
  expect(figure("Already placed")).toBe("1");
});

it("will not check anything while a student still needs a decision", async () => {
  render(<PromotionPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview" }));
  await screen.findByText("Ana Reyes");

  expect(screen.getByText("1 student needs a decision first.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Check (dry run)" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Commit" }) as HTMLButtonElement).disabled).toBe(true);
});

it("checks exactly the reviewed list as a dry run and shows what it would do", async () => {
  await reviewed();

  await userEvent.click(screen.getByRole("button", { name: "Check (dry run)" }));

  await waitFor(() =>
    expect(service.commitPromotion).toHaveBeenCalledWith(
      3,
      [
        { studentId: 10, sectionId: 31 },
        { studentId: 11, sectionId: null },
        { studentId: 12, sectionId: 33 },
      ],
      true,
    ),
  );
  const dryRun = await screen.findByRole("status", { name: "Dry run" });
  expect(dryRun.textContent).toContain("would place 2");
  expect(dryRun.textContent).toContain("Ana Reyes → 2nd Year · Section A");
});

it("commits only after a check, and only once confirmed", async () => {
  await reviewed();

  expect((screen.getByRole("button", { name: "Commit" }) as HTMLButtonElement).disabled).toBe(true);

  await userEvent.click(screen.getByRole("button", { name: "Check (dry run)" }));
  await screen.findByRole("status", { name: "Dry run" });
  await userEvent.click(screen.getByRole("button", { name: "Commit" }));

  const confirm = screen.getByRole("alertdialog");
  expect(service.commitPromotion).toHaveBeenCalledTimes(1);

  await userEvent.click(within(confirm).getByRole("button", { name: "Commit" }));

  await waitFor(() => expect(service.commitPromotion).toHaveBeenLastCalledWith(3, expect.any(Array), false));
  expect(toast.success).toHaveBeenCalledWith("2 students placed in 2027–2028.");
  expect((await screen.findByText(/Placed 2 in 2027–2028/)).textContent).toContain("1 not placed");
  // And redrawn from what the server now says.
  expect(service.fetchPromotionPreview).toHaveBeenCalledTimes(2);
});

it("asks for a new check when a choice changes after one", async () => {
  await reviewed();
  await userEvent.click(screen.getByRole("button", { name: "Check (dry run)" }));
  await screen.findByRole("status", { name: "Dry run" });

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Placement for Ana Reyes" }), "none");

  expect(screen.getByText(/Check again before committing/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Commit" }) as HTMLButtonElement).disabled).toBe(true);
});

it("shows the server's validation errors and commits nothing", async () => {
  vi.mocked(service.commitPromotion).mockRejectedValue(
    new ApiError("The given data was invalid.", 422, {
      "placements.2.section_id": ["That section is not one of this academic year's."],
    }),
  );
  await reviewed();

  await userEvent.click(screen.getByRole("button", { name: "Check (dry run)" }));

  expect((await screen.findByRole("alert")).textContent).toContain("That section is not one of this academic year's.");
  expect((screen.getByRole("button", { name: "Commit" }) as HTMLButtonElement).disabled).toBe(true);
});

it("says so when the commit itself fails, and claims nothing was placed", async () => {
  await reviewed();
  await userEvent.click(screen.getByRole("button", { name: "Check (dry run)" }));
  await screen.findByRole("status", { name: "Dry run" });
  vi.mocked(service.commitPromotion).mockRejectedValue(new ApiError("2027–2028 is closed. It is kept as it was.", 409));

  await userEvent.click(screen.getByRole("button", { name: "Commit" }));
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Commit" }));

  expect((await screen.findByRole("alert")).textContent).toContain("2027–2028 is closed.");
  expect(toast.success).not.toHaveBeenCalled();
  expect(screen.queryByText(/Placed \d+ in/)).toBeNull();
});

it("sends one request however quickly it is clicked", async () => {
  let release: (value: PromotionOutcome) => void = () => {};
  vi.mocked(service.commitPromotion).mockImplementation(
    () => new Promise<PromotionOutcome>((resolve) => { release = resolve; }),
  );
  await reviewed();

  const check = screen.getByRole("button", { name: "Check (dry run)" });
  await userEvent.click(check);
  await userEvent.click(check);
  await userEvent.click(check);

  expect(service.commitPromotion).toHaveBeenCalledTimes(1);
  release(outcome(true));
  await screen.findByRole("status", { name: "Dry run" });
});

it("refuses to move anyone into a closed year", async () => {
  params.value = { id: "1" };

  render(<PromotionPage />);

  expect(await screen.findByText("2025–2026 is closed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
});
