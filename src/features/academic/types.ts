/**
 * The academic structure: the school's academic years, the year levels every
 * year shares, and each year's sections.
 *
 * A student's placement belongs to an academic year rather than to their
 * account, which is what lets last year's class stay last year's when the
 * student moves on.
 */

/** Planned → current → closed, in that order only. */
export type AcademicYearStatus = "planned" | "current" | "closed";

export interface AcademicYear {
  id: number;
  name: string;
  /** Calendar dates, `YYYY-MM-DD`. */
  startsAt: string;
  endsAt: string;
  status: AcademicYearStatus;
  statusLabel: string;
  isCurrent: boolean;
  sectionsCount: number;
  enrollmentsCount: number;
}

export interface AcademicYearDraft {
  name: string;
  startsAt: string;
  endsAt: string;
}

/** A year level as the structure pages manage it — shared by every year. */
export interface ManagedYearLevel {
  id: number;
  code: string;
  name: string;
  /** Its place in the programme; "the next year level" is the next one up. */
  levelOrder: number;
  /** Sections using it, across every academic year. */
  sectionsCount: number;
}

export interface YearLevelDraft {
  code: string;
  name: string;
  levelOrder: number;
}

/** One section of one academic year. */
export interface ManagedSection {
  id: number;
  name: string;
  /** A seat guideline; nothing turns a student away from a full section. */
  capacity: number | null;
  isActive: boolean;
  yearLevel: { id: number; name: string };
  academicYear: { id: number; name: string; status: AcademicYearStatus };
  /** Students placed in it. A section with any is closed, never deleted. */
  enrollmentsCount: number;
}

export interface SectionDraft {
  academicYearId: number;
  yearLevelId: number;
  name: string;
  capacity: number | null;
}

/* ------------------------------------------------------------------------ */
/* Moving students into a year                                              */
/* ------------------------------------------------------------------------ */

/** A section as the promotion preview describes it. */
export interface PromotionSection {
  section: { id: number; name: string };
  yearLevel: { id: number; name: string; levelOrder: number };
}

/**
 * Why the preview proposed what it did — or nothing.
 *
 * `promoted`: the same section name one year level up.
 * `no_next_year_level`: the last year level; graduating or not continuing.
 * `no_matching_section`: the new year has no such section; choose one.
 * `already_placed`: placed in the new year already; left as they are.
 */
export type PromotionReason =
  | "promoted"
  | "no_next_year_level"
  | "no_matching_section"
  | "already_placed";

export interface PromotionRow {
  student: { id: number; studentId: string | null; fullName: string };
  from: PromotionSection;
  proposed: PromotionSection | null;
  reason: PromotionReason;
}

export interface PromotionPreview {
  from: { id: number; name: string };
  to: { id: number; name: string };
  rows: PromotionRow[];
  /** Every section of the year being moved into, to choose from. */
  sections: (PromotionSection & { isActive: boolean })[];
}

/** One student's placement in the year being moved into; null is none. */
export interface PromotionPlacement {
  studentId: number;
  sectionId: number | null;
}

/** What a commit did — or, for a dry run, would do. */
export interface PromotionOutcome {
  dryRun: boolean;
  created: { studentId: number; sectionId: number }[];
  skipped: { studentId: number; sectionId: number }[];
  notPlaced: { studentId: number }[];
}
