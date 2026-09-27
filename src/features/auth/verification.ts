import type { User } from "./types";

/** The page an account confirms its email address on. */
export const VERIFY_EMAIL_PATH = "/verify-email";

/**
 * Whether the app sends an unverified account to confirm its address before
 * anything else.
 *
 * Off until the API enforces the same rule: while it is off an unverified
 * account uses the app as before, and /verify-email is simply a page it can
 * open. This is the only switch — the route guard and the post-sign-in
 * landing both ask `mustVerifyEmail`, and nothing else decides.
 */
export const EMAIL_VERIFICATION_ENFORCED = false;

/**
 * Whether this user has to confirm their address before using the app.
 *
 * Only a definite `false` from the server counts. A user whose state is not
 * known — a session restored from the cache while the server was out of
 * reach — is not trapped on the verification page on a guess.
 */
export function mustVerifyEmail(user: User | null): boolean {
  return EMAIL_VERIFICATION_ENFORCED && user !== null && user.emailVerified === false;
}
