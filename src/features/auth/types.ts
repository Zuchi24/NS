export type Role = "student" | "admin";

export interface Section {
  id: number;
  name: string;
  yearLevel: string;
}

export interface User {
  id: number;
  /** Full name as the server assembles it, for greetings and headers. */
  name: string;
  firstName: string;
  lastName: string;
  /** A suffix such as "Jr." or "III", or null for none. */
  extendedName?: string | null;
  studentId: string | null;
  email: string;
  /** Whether the server has accepted the account's email address. */
  emailVerified?: boolean;
  role: Role;
  /**
   * When the account was opened. The only date the platform holds about a
   * person — there is no birth date, and none is invented for the profile.
   */
  joinedAt: string | null;
  /**
   * Where the account's own picture is fetched from, or null for none. An API
   * address, not an image anyone can load: it answers only with a bearer
   * token, so it is read through useAvatar rather than put in an `<img>`.
   * Optional because a user cached before pictures existed has no such field.
   */
  avatarUrl?: string | null;
  /** Null for admins, and for students not yet placed in a section. */
  section: Section | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  /**
   * Keep the session after the browser closes. Off by default: a shared lab
   * machine should forget you when the tab does.
   */
  remember?: boolean;
}

/**
 * What signing up returns: the new account, signed in, and what became of the
 * verification code the server sends it — its timings when it went out, or
 * that it could not be sent, so the verification page can offer another.
 */
export interface SignUpResult {
  user: User;
  codeSent: { expiresIn: number; resendAvailableIn: number } | null;
  sendFailed: boolean;
}

export interface SignUpDetails {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  nameExtension?: string;
  studentId: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  /**
   * The section the student is enrolled in. Required: every instructor view is
   * organised by section, so an account without one is an account no
   * instructor can find. Chosen from `fetchSections()`, never typed.
   */
  sectionId: number;
}

/** One section a student can enrol in. */
export interface SectionOption {
  id: number;
  name: string;
}

/** A year level and the sections open within it. */
export interface YearLevelOptions {
  id: number;
  code: string;
  name: string;
  sections: SectionOption[];
}
