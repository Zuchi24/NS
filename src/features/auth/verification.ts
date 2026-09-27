import type { User } from "./types";

/** The page an account confirms its email address on. */
export const VERIFY_EMAIL_PATH = "/verify-email";

/**
 * Whether the app sends an unverified account to confirm its address before
 * anything else.
 *
 * On, as the API is: an unverified student's token opens only the
 * verification routes there. This is the only switch — the route guard and
 * the post-sign-in landing both ask `mustVerifyEmail`, and nothing else
 * decides.
 */
export const EMAIL_VERIFICATION_ENFORCED = true;

/**
 * Whether this user has to confirm their address before using the app.
 *
 * The API's rule, mirrored: a student whose address is not verified. Staff
 * never are asked. Only a definite `false` from the server counts — a user
 * whose state is not known, such as a session restored from the cache while
 * the server was out of reach, is not trapped on the verification page on a
 * guess; the server still refuses them anything else if they must verify.
 */
export function mustVerifyEmail(user: User | null): boolean {
  return (
    EMAIL_VERIFICATION_ENFORCED &&
    user !== null &&
    user.role === "student" &&
    user.emailVerified === false
  );
}
