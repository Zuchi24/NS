import { AUTH_TOKEN_KEY, ApiError, api, authToken } from "@/services/api";
import { storage } from "@/services/storage";
import type {
  LoginCredentials,
  Role,
  SignUpDetails,
  SignUpResult,
  User,
  YearLevelOptions,
} from "./types";

/**
 * Authentication against the Laravel API.
 *
 * The token is what actually keeps the session; the cached user is only there
 * so the app can render immediately on reload instead of flashing a spinner
 * while /me answers.
 */

const USER_KEY = "netsim-user";

/**
 * One NetSim account per browser profile, however many tabs are open.
 *
 * "Keep me signed in" decides how long the token is held — for good, or until
 * the tab closes — not how many accounts a profile may have. So this marker is
 * written to the shared store on every explicit sign-in and sign-out, whichever
 * store the token itself goes to, and every other tab listens for it changing.
 * A tab-private sign-in would otherwise change nothing a neighbouring tab could
 * see.
 *
 * It says only that the profile's session changed: `<user id>:<nonce>`. It is
 * not a credential and nothing is authenticated by it. Who is signed in is
 * still the token and what /me says of it.
 */
export const SESSION_KEY = "netsim-session";

/** What this tab last saw of the profile's session, to tell a real change from an echo. */
let known: { marker: string | null; credential: string | null } = {
  marker: null,
  credential: null,
};

function readMarker(): string | null {
  return storage.get<string>(SESSION_KEY);
}

function noteSynced(): void {
  known = { marker: readMarker(), credential: authToken.get() };
}

/** A new session generation: the nonce is what tells two sign-ins by one user apart. */
function announceSession(userId: number): void {
  const nonce =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  storage.set(SESSION_KEY, `${userId}:${nonce}`, "local");
  noteSynced();
}

/** Whether a storage event is about the browser-wide session, rather than anything else. */
export function concernsSession(key: string | null): boolean {
  return key === null || key === SESSION_KEY || key === AUTH_TOKEN_KEY;
}

/**
 * The cached user is kept with the id of the token it was cached for — the part
 * before the `|` in a Sanctum token, which is a row number and not the secret.
 * A user cached for one token is not evidence of who another token belongs to.
 */
interface CachedUser {
  tokenId: string;
  user: User;
}

function tokenId(token: string | null): string | null {
  const bar = token?.indexOf("|") ?? -1;

  return token !== null && bar > 0 ? token.slice(0, bar) : null;
}

function cachedUser(): User | null {
  const cached = storage.get<Partial<CachedUser>>(USER_KEY);
  const current = tokenId(authToken.get());

  return cached?.user && current !== null && cached.tokenId === current ? cached.user : null;
}

/** The shape UserResource returns, snake_case and untouched. */
interface ApiUser {
  id: number;
  student_id: string | null;
  first_name: string;
  last_name: string;
  extended_name: string | null;
  full_name: string;
  email: string;
  email_verified?: boolean;
  role: Role;
  created_at: string | null;
  section_id: number | null;
  section?: { id: number; name: string; year_level: string };
}

interface AuthResponse {
  user: ApiUser;
  token: string;
  /** Whether the account must confirm its email address before anything else. */
  verification_required?: boolean;
}

/** Sign-up's answer also says whether the first verification code went out. */
interface SignUpResponse extends AuthResponse {
  verification?: { sent: boolean; expires_in?: number; resend_available_in?: number };
}

function toUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.full_name,
    firstName: user.first_name,
    lastName: user.last_name,
    studentId: user.student_id,
    email: user.email,
    emailVerified: user.email_verified,
    role: user.role,
    joinedAt: user.created_at ?? null,
    section: user.section
      ? {
          id: user.section.id,
          name: user.section.name,
          yearLevel: user.section.year_level,
        }
      : null,
  };
}

/** Names the token so a student can tell their devices apart and revoke one. */
function deviceName(): string {
  return `NetSim Web (${navigator.platform || "browser"})`.slice(0, 255);
}

function persist(user: ApiUser, token?: string, remember = true): User {
  if (token) {
    authToken.set(token, remember);
  }

  const mapped = toUser(user);
  const id = tokenId(authToken.get());

  // The cached user is only a render optimisation, so it lives exactly as long
  // as the token does — an unremembered session must not leave a name behind.
  if (id !== null) {
    storage.set(USER_KEY, { tokenId: id, user: mapped } satisfies CachedUser, authToken.scope());
  }

  // Last, so a tab woken by the marker finds the new token already in place.
  // Only a sign-in starts a session: verifying an address carries on the one
  // there is.
  if (token) {
    announceSession(mapped.id);
  }

  return mapped;
}

export async function login({
  email,
  password,
  remember = false,
}: LoginCredentials): Promise<User> {
  const response = await api.post<AuthResponse>("/login", {
    email,
    password,
    device_name: deviceName(),
  });

  return persist(response.user, response.token, remember);
}

export async function signup(details: SignUpDetails): Promise<SignUpResult> {
  const response = await api.post<SignUpResponse>("/register", {
    first_name: details.firstName,
    last_name: details.lastName,
    extended_name: details.nameExtension || null,
    student_id: details.studentId || null,
    email: details.email,
    password: details.password,
    password_confirmation: details.passwordConfirmation,
    section_id: details.sectionId,
  });

  const verification = response.verification;
  const sent =
    verification?.sent === true &&
    typeof verification.expires_in === "number" &&
    typeof verification.resend_available_in === "number";

  return {
    user: persist(response.user, response.token),
    codeSent: sent
      ? { expiresIn: verification.expires_in!, resendAvailableIn: verification.resend_available_in! }
      : null,
    sendFailed: verification?.sent === false,
  };
}

/**
 * The year levels and sections a student can enrol into.
 *
 * Read before anyone has an account, so this endpoint takes no token. It
 * returns only active sections, which is what makes the sign-up field a choice
 * from the timetable rather than free text.
 */
export async function fetchSections(): Promise<YearLevelOptions[]> {
  const { data } = await api.get<{ data: YearLevelOptions[] }>("/sections");

  return data;
}

/**
 * What a successful request for a verification code answers: a code went out,
 * with the server's timings, or there was nothing to send.
 *
 * Only the successes. Every refusal arrives as an ApiError instead — a 429
 * carrying `retryAfter` for the cooldown and the hourly limit, a 503 when the
 * mail could not be sent — and the page reads those from the error.
 */
export type VerificationCodeResponse =
  | { sent: true; expires_in: number; resend_available_in: number }
  | { already_verified: true };

/** Asks for a code to be emailed to the signed-in account. */
export async function requestEmailVerificationCode(): Promise<VerificationCodeResponse> {
  return api.post<VerificationCodeResponse>("/email/verification-code");
}

/**
 * Checks a code for the signed-in account and returns it, now verified.
 *
 * The same session carries on: no token comes back and none is replaced. A
 * refused code is an ApiError (422) whose body says whether only a new code
 * will help (`resend_required`).
 */
export async function verifyEmailCode(code: string): Promise<User> {
  const response = await api.post<{ verified: true; user: ApiUser }>("/email/verify", { code });
  return persist(response.user);
}

export interface PasswordChange {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Changes the signed-in user's own password. Whose it is comes from the token.
 *
 * On success the server revokes every token the account holds — this one
 * included — so the caller has to sign in again with the new password; the
 * returned message says so. A wrong current password is a 422 on
 * `current_password`, read with ApiError.fieldError().
 */
export async function changePassword(change: PasswordChange): Promise<string> {
  const { message } = await api.put<{ message: string }>("/password", {
    current_password: change.currentPassword,
    password: change.password,
    password_confirmation: change.passwordConfirmation,
  });

  return message;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/logout");
  } catch {
    // The token is already gone, or the server is unreachable. Either way the
    // session ends here — a failed logout must never strand someone signed in.
  } finally {
    authToken.clear();
    storage.remove(USER_KEY);
    // Ends the profile's session for every tab, not just this one.
    storage.remove(SESSION_KEY);
    noteSynced();
  }
}

/** Forgets the cached user, for a session that ended without a sign-out. */
export function forgetUser(): void {
  storage.remove(USER_KEY);
}

/**
 * Re-establishes the session on page load. Returns null when signed out.
 *
 * A rejected token means signed out. An unreachable server does not: the cached
 * user stands so a reload during a backend restart does not throw someone out.
 */
export async function restoreSession(): Promise<User | null> {
  noteSynced();

  const asked = authToken.get();

  if (!asked) {
    return null;
  }

  try {
    const response = await api.get<{ data: ApiUser }>("/me");

    // Another tab signed in as someone else while /me was out. What came back
    // is about the token that was sent, not the one now in place, so it must
    // not be cached against it; the tab that changed it is already being
    // reconciled and will ask again.
    if (authToken.get() !== asked) {
      return null;
    }

    return persist(response.data);
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      storage.remove(USER_KEY);
      return null;
    }

    return cachedUser();
  }
}

/**
 * What this tab has to do about a change to the browser-wide session.
 *
 *  - `null`: nothing. The same token is still in place, which is also what an
 *    echo of this tab's own sign-in looks like.
 *  - `"signed-out"`: no session is left.
 *  - `"restore"`: a different token is in place; ask /me who it is.
 *
 * A token private to this tab is given up when another tab starts or ends the
 * session, since the browser keeps one account. The shared token is never
 * touched here: it is the session the other tab just chose.
 */
export type SessionPlan = "signed-out" | "restore" | null;

export function planSessionSync(): SessionPlan {
  const marker = readMarker();

  if (marker !== known.marker && storage.hasIn(AUTH_TOKEN_KEY, "session")) {
    storage.removeFrom(AUTH_TOKEN_KEY, "session");
    storage.removeFrom(USER_KEY, "session");
  }

  const credential = authToken.get();
  const changed = credential !== known.credential;

  known = { marker, credential };

  if (!changed) {
    return null;
  }

  if (credential === null) {
    storage.remove(USER_KEY);
    return "signed-out";
  }

  return "restore";
}
