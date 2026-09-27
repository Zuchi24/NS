import type { Role, User } from "./types";
import { VERIFY_EMAIL_PATH, mustVerifyEmail } from "./verification";

/** Where each role lands when it has nowhere particular to go. */
const HOME: Record<Role, string> = {
  admin: "/admin/dashboard",
  student: "/dashboard",
};

/** The route trees only an admin can open. */
const ADMIN_PREFIXES = ["/admin", "/instructor-review"];

function isAdminPath(path: string): boolean {
  return ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Where to send someone who has just signed in.
 *
 * A route guard records where it interrupted a visitor so login can return
 * them there, but that breadcrumb outlives the session it was dropped in:
 * signing out of the student dashboard bounces through the guard, which writes
 * "/dashboard" into the login page's state, and the next person to sign in on
 * that page — an admin — would be sent to the student side. So a remembered
 * path is only honoured when it belongs to the role that ended up signing in.
 */
export function landingPath(user: User, from?: string | null): string {
  const home = HOME[user.role];

  if (!from || !from.startsWith("/")) {
    return home;
  }

  return isAdminPath(from) === (user.role === "admin") ? from : home;
}

/**
 * Where someone goes straight after signing in or signing up.
 *
 * Their landing page — unless their address has to be confirmed first, in
 * which case the verification page, remembering where they were headed so it
 * can send them on afterwards.
 */
export function postSignInTarget(
  user: User,
  from?: string | null,
): { path: string; state?: { from: string } } {
  const destination = landingPath(user, from);

  return mustVerifyEmail(user)
    ? { path: VERIFY_EMAIL_PATH, state: { from: destination } }
    : { path: destination };
}
