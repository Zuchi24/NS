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
