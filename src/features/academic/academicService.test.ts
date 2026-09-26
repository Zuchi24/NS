import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import("@/services/api");
const service = await import("./academicService");

/**
 * What the structure pages send and how they read the answer. The rules are
 * the server's; these pin the wire format, and that nothing the server would
 * take as an instruction — a status, a code, a year — is ever sent where it
 * must not be.
 */

const apiYear = {
  id: 2,
  name: "2027–2028",
  starts_at: "2027-07-01",
  ends_at: "2028-06-30",
  status: "planned",
  status_label: "Planned",
  is_current: false,
  sections_count: 3,
  enrollments_count: 40,
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
  vi.mocked(api.delete).mockReset();
});

describe("academic years", () => {
  it("reads the list", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [apiYear] });

    const [year] = await service.fetchAcademicYears();

    expect(api.get).toHaveBeenCalledWith("/admin/academic-years");
    expect(year).toEqual({
      id: 2,
      name: "2027–2028",
      startsAt: "2027-07-01",
      endsAt: "2028-06-30",
      status: "planned",
      statusLabel: "Planned",
      isCurrent: false,
      sectionsCount: 3,
      enrollmentsCount: 40,
    });
  });

  it("creates one with a name and dates, and never a status", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiYear });

    await service.createAcademicYear({
      name: "2027–2028",
      startsAt: "2027-07-01",
      endsAt: "2028-06-30",
    });

    expect(api.post).toHaveBeenCalledWith("/admin/academic-years", {
      name: "2027–2028",
      starts_at: "2027-07-01",
      ends_at: "2028-06-30",
    });
  });

  it("activates through its own route", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...apiYear, status: "current" } });

    const year = await service.activateAcademicYear(2);

    expect(api.post).toHaveBeenCalledWith("/admin/academic-years/2/activate");
    expect(year.status).toBe("current");
  });

  it("lets the server's refusal through", async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error("2026–2027 is current."));

    await expect(service.deleteAcademicYear(1)).rejects.toThrow("2026–2027 is current.");
  });
});

describe("year levels", () => {
  it("never sends a code when editing", async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { id: 1, code: "1ST", name: "First Year", level_order: 1, sections_count: 7 },
    });

    await service.updateYearLevel(1, { name: "First Year", levelOrder: 1 });

    expect(api.put).toHaveBeenCalledWith("/admin/year-levels/1", {
      name: "First Year",
      level_order: 1,
    });
  });
});

describe("sections", () => {
  it("reads one year's sections", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 30,
          name: "Section A",
          capacity: 40,
          is_active: true,
          year_level: { id: 1, name: "1st Year" },
          academic_year: { id: 2, name: "2027–2028", status: "planned" },
          enrollments_count: 0,
        },
      ],
    });

    const [section] = await service.fetchYearSections(2);

    expect(api.get).toHaveBeenCalledWith("/admin/academic-years/2/sections");
    expect(section).toEqual({
      id: 30,
      name: "Section A",
      capacity: 40,
      isActive: true,
      yearLevel: { id: 1, name: "1st Year" },
      academicYear: { id: 2, name: "2027–2028", status: "planned" },
      enrollmentsCount: 0,
    });
  });

  it("sends only a name and seat guideline when editing, never a year or year level", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { id: 30, name: "BSIT 1A", capacity: 35, is_active: true } });

    await service.updateSection(30, { name: "BSIT 1A", capacity: 35 });

    expect(api.put).toHaveBeenCalledWith("/admin/sections/30", { name: "BSIT 1A", capacity: 35 });
  });
});

describe("moving students into a year", () => {
  it("asks for a preview from one year into another", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        from: { id: 2, name: "2026–2027" },
        to: { id: 3, name: "2027–2028" },
        rows: [
          {
            student: { id: 10, student_id: "S-10", full_name: "Ana Reyes" },
            from: { section: { id: 1, name: "Section A" }, year_level: { id: 1, name: "1st Year", level_order: 1 } },
            proposed: { section: { id: 31, name: "Section A" }, year_level: { id: 2, name: "2nd Year", level_order: 2 } },
            reason: "promoted",
          },
        ],
        sections: [
          { section: { id: 31, name: "Section A" }, year_level: { id: 2, name: "2nd Year", level_order: 2 }, is_active: true },
        ],
      },
    });

    const preview = await service.fetchPromotionPreview(3, 2);

    expect(api.get).toHaveBeenCalledWith("/admin/academic-years/3/promotions/preview?from_academic_year_id=2");
    expect(preview.rows[0]).toEqual({
      student: { id: 10, studentId: "S-10", fullName: "Ana Reyes" },
      from: { section: { id: 1, name: "Section A" }, yearLevel: { id: 1, name: "1st Year", levelOrder: 1 } },
      proposed: { section: { id: 31, name: "Section A" }, yearLevel: { id: 2, name: "2nd Year", levelOrder: 2 } },
      reason: "promoted",
    });
    expect(preview.sections[0].isActive).toBe(true);
  });

  it("sends the reviewed list, with null for not placed, and reads the outcome", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        dry_run: true,
        academic_year: { id: 3, name: "2027–2028" },
        created: [{ student_id: 10, section_id: 31 }],
        skipped: [],
        not_placed: [{ student_id: 11 }],
      },
    });

    const outcome = await service.commitPromotion(
      3,
      [
        { studentId: 10, sectionId: 31 },
        { studentId: 11, sectionId: null },
      ],
      true,
    );

    expect(api.post).toHaveBeenCalledWith("/admin/academic-years/3/promotions", {
      dry_run: true,
      placements: [
        { student_id: 10, section_id: 31 },
        { student_id: 11, section_id: null },
      ],
    });
    expect(outcome).toEqual({
      dryRun: true,
      created: [{ studentId: 10, sectionId: 31 }],
      skipped: [],
      notPlaced: [{ studentId: 11 }],
    });
  });
});
