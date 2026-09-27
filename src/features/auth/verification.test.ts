// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { EMAIL_VERIFICATION_ENFORCED, VERIFY_EMAIL_PATH, mustVerifyEmail } from "./verification";
import { landingPath, postSignInTarget } from "./landing";
import type { User } from "./types";

/**
 * The one switch for sending unverified accounts to confirm their address,
 * while it is still off: nobody is sent anywhere new, and signing in and
 * signing up land exactly where they did before.
 */

const unverified: User = {
  id: 7,
  name: "Ana Reyes",
  firstName: "Ana",
  lastName: "Reyes",
  studentId: null,
  email: "ana@example.com",
  emailVerified: false,
  role: "student",
  joinedAt: null,
  section: null,
};

describe("while verification is not yet enforced", () => {
  it("is off", () => {
    expect(EMAIL_VERIFICATION_ENFORCED).toBe(false);
  });

  it("asks nobody to verify, not even an unverified account", () => {
    expect(mustVerifyEmail(unverified)).toBe(false);
    expect(mustVerifyEmail({ ...unverified, emailVerified: true })).toBe(false);
    expect(mustVerifyEmail({ ...unverified, emailVerified: undefined })).toBe(false);
    expect(mustVerifyEmail(null)).toBe(false);
  });

  it("lands an unverified account where it always did", () => {
    expect(postSignInTarget(unverified)).toEqual({ path: "/dashboard" });
    expect(postSignInTarget(unverified, "/roadmap")).toEqual({ path: "/roadmap" });
    expect(postSignInTarget({ ...unverified, role: "admin" })).toEqual({ path: "/admin/dashboard" });
  });

  it("agrees with the landing page for everyone", () => {
    for (const from of [undefined, null, "/roadmap", "/admin/students", "nowhere"]) {
      expect(postSignInTarget(unverified, from).path).toBe(landingPath(unverified, from));
    }
  });

  it("names the page it will send them to", () => {
    expect(VERIFY_EMAIL_PATH).toBe("/verify-email");
  });
});
