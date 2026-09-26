import { api } from "@/services/api";
import type {
  AcademicYear,
  AcademicYearDraft,
  AcademicYearStatus,
  ManagedSection,
  ManagedYearLevel,
  PromotionOutcome,
  PromotionPlacement,
  PromotionPreview,
  PromotionReason,
  PromotionSection,
  SectionDraft,
  YearLevelDraft,
} from "./types";

/**
 * Managing the academic structure.
 *
 * The rules live on the server and are not repeated here: a year is created
 * planned and becomes current only by activation, which closes the year before
 * it; a closed year and its sections are kept as they were; a section anyone
 * has been placed in is closed rather than deleted. What the pages do is not
 * offer what would be refused — and when a refusal comes back anyway, show the
 * server's own words.
 */

interface ApiAcademicYear {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: AcademicYearStatus;
  status_label: string;
  is_current: boolean;
  sections_count?: number;
  enrollments_count?: number;
}

interface ApiYearLevel {
  id: number;
  code: string;
  name: string;
  level_order: number;
  sections_count?: number;
}

interface ApiSection {
  id: number;
  name: string;
  capacity: number | null;
  is_active: boolean;
  year_level?: { id: number; name: string };
  academic_year?: { id: number; name: string; status: AcademicYearStatus };
  enrollments_count?: number;
}

function toAcademicYear(year: ApiAcademicYear): AcademicYear {
  return {
    id: year.id,
    name: year.name,
    startsAt: year.starts_at,
    endsAt: year.ends_at,
    status: year.status,
    statusLabel: year.status_label,
    isCurrent: year.is_current,
    sectionsCount: year.sections_count ?? 0,
    enrollmentsCount: year.enrollments_count ?? 0,
  };
}

function toYearLevel(level: ApiYearLevel): ManagedYearLevel {
  return {
    id: level.id,
    code: level.code,
    name: level.name,
    levelOrder: level.level_order,
    sectionsCount: level.sections_count ?? 0,
  };
}

function toSection(section: ApiSection): ManagedSection {
  return {
    id: section.id,
    name: section.name,
    capacity: section.capacity,
    isActive: section.is_active,
    yearLevel: section.year_level ?? { id: 0, name: "" },
    academicYear: section.academic_year ?? { id: 0, name: "", status: "planned" },
    enrollmentsCount: section.enrollments_count ?? 0,
  };
}

/* ------------------------------------------------------------------------ */
/* Academic years                                                           */
/* ------------------------------------------------------------------------ */

/** Every academic year, newest first. */
export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get<{ data: ApiAcademicYear[] }>("/admin/academic-years");

  return data.map(toAcademicYear);
}

/** Always created planned: the server takes no status. */
export async function createAcademicYear(draft: AcademicYearDraft): Promise<AcademicYear> {
  const { data } = await api.post<{ data: ApiAcademicYear }>("/admin/academic-years", {
    name: draft.name,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
  });

  return toAcademicYear(data);
}

/** A planned or current year's name and dates. A closed year is refused. */
export async function updateAcademicYear(
  id: number,
  draft: AcademicYearDraft,
): Promise<AcademicYear> {
  const { data } = await api.put<{ data: ApiAcademicYear }>(`/admin/academic-years/${id}`, {
    name: draft.name,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
  });

  return toAcademicYear(data);
}

/**
 * Makes a planned year current. The year that was current closes, and every
 * student's current placement becomes their placement in this year — or none.
 */
export async function activateAcademicYear(id: number): Promise<AcademicYear> {
  const { data } = await api.post<{ data: ApiAcademicYear }>(
    `/admin/academic-years/${id}/activate`,
  );

  return toAcademicYear(data);
}

/** Only a planned year with no sections or placements. */
export async function deleteAcademicYear(id: number): Promise<void> {
  await api.delete(`/admin/academic-years/${id}`);
}

/* ------------------------------------------------------------------------ */
/* Year levels                                                              */
/* ------------------------------------------------------------------------ */

export async function fetchYearLevels(): Promise<ManagedYearLevel[]> {
  const { data } = await api.get<{ data: ApiYearLevel[] }>("/admin/year-levels");

  return data.map(toYearLevel);
}

export async function createYearLevel(draft: YearLevelDraft): Promise<ManagedYearLevel> {
  const { data } = await api.post<{ data: ApiYearLevel }>("/admin/year-levels", {
    code: draft.code,
    name: draft.name,
    level_order: draft.levelOrder,
  });

  return toYearLevel(data);
}

/** Name and position. The code is the stable handle and is never sent. */
export async function updateYearLevel(
  id: number,
  changes: { name: string; levelOrder: number },
): Promise<ManagedYearLevel> {
  const { data } = await api.put<{ data: ApiYearLevel }>(`/admin/year-levels/${id}`, {
    name: changes.name,
    level_order: changes.levelOrder,
  });

  return toYearLevel(data);
}

/** Only a year level no section of any year uses. */
export async function deleteYearLevel(id: number): Promise<void> {
  await api.delete(`/admin/year-levels/${id}`);
}

/* ------------------------------------------------------------------------ */
/* Sections                                                                 */
/* ------------------------------------------------------------------------ */

/** One academic year's sections, by year level then name. */
export async function fetchYearSections(academicYearId: number): Promise<ManagedSection[]> {
  const { data } = await api.get<{ data: ApiSection[] }>(
    `/admin/academic-years/${academicYearId}/sections`,
  );

  return data.map(toSection);
}

export async function createSection(draft: SectionDraft): Promise<ManagedSection> {
  const { data } = await api.post<{ data: ApiSection }>("/admin/sections", {
    academic_year_id: draft.academicYearId,
    year_level_id: draft.yearLevelId,
    name: draft.name,
    capacity: draft.capacity,
  });

  return toSection(data);
}

/** Name and seat guideline only; a section's year and year level never change. */
export async function updateSection(
  id: number,
  changes: { name: string; capacity: number | null },
): Promise<ManagedSection> {
  const { data } = await api.put<{ data: ApiSection }>(`/admin/sections/${id}`, {
    name: changes.name,
    capacity: changes.capacity,
  });

  return toSection(data);
}

/** Only a section nobody has been placed in, in a year still open. */
export async function deleteSection(id: number): Promise<void> {
  await api.delete(`/admin/sections/${id}`);
}

/* ------------------------------------------------------------------------ */
/* Moving students into a year                                              */
/* ------------------------------------------------------------------------ */

interface ApiPromotionSection {
  section: { id: number; name: string };
  year_level: { id: number; name: string; level_order: number };
}

interface ApiPromotionPreview {
  from: { id: number; name: string };
  to: { id: number; name: string };
  rows: {
    student: { id: number; student_id: string | null; full_name: string };
    from: ApiPromotionSection;
    proposed: ApiPromotionSection | null;
    reason: PromotionReason;
  }[];
  sections: (ApiPromotionSection & { is_active: boolean })[];
}

function toPromotionSection(section: ApiPromotionSection): PromotionSection {
  return {
    section: section.section,
    yearLevel: {
      id: section.year_level.id,
      name: section.year_level.name,
      levelOrder: section.year_level.level_order,
    },
  };
}

/**
 * What moving `fromYearId`'s students into `toYearId` would look like. The
 * server proposes; nothing is written.
 */
export async function fetchPromotionPreview(
  toYearId: number,
  fromYearId: number,
): Promise<PromotionPreview> {
  const { data } = await api.get<{ data: ApiPromotionPreview }>(
    `/admin/academic-years/${toYearId}/promotions/preview?from_academic_year_id=${fromYearId}`,
  );

  return {
    from: data.from,
    to: data.to,
    rows: data.rows.map((row) => ({
      student: {
        id: row.student.id,
        studentId: row.student.student_id,
        fullName: row.student.full_name,
      },
      from: toPromotionSection(row.from),
      proposed: row.proposed ? toPromotionSection(row.proposed) : null,
      reason: row.reason,
    })),
    sections: data.sections.map((section) => ({
      ...toPromotionSection(section),
      isActive: section.is_active,
    })),
  };
}

/**
 * Places the reviewed list in `toYearId`, all of it or none of it — or, as a
 * dry run, says what that would do without writing anything. Students already
 * placed there are left as they are and reported as skipped.
 */
export async function commitPromotion(
  toYearId: number,
  placements: PromotionPlacement[],
  dryRun: boolean,
): Promise<PromotionOutcome> {
  const { data } = await api.post<{
    data: {
      dry_run: boolean;
      created: { student_id: number; section_id: number }[];
      skipped: { student_id: number; section_id: number }[];
      not_placed: { student_id: number }[];
    };
  }>(`/admin/academic-years/${toYearId}/promotions`, {
    dry_run: dryRun,
    placements: placements.map((placement) => ({
      student_id: placement.studentId,
      section_id: placement.sectionId,
    })),
  });

  return {
    dryRun: data.dry_run,
    created: data.created.map((row) => ({ studentId: row.student_id, sectionId: row.section_id })),
    skipped: data.skipped.map((row) => ({ studentId: row.student_id, sectionId: row.section_id })),
    notPlaced: data.not_placed.map((row) => ({ studentId: row.student_id })),
  };
}
