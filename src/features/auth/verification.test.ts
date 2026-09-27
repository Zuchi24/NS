// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { EMAIL_VERIFICATION_ENFORCED, VERIFY_EMAIL_PATH, mustVerifyEmail } from "./verification";
import { landingPath, postSignInTarget } from "./landing";
import type { User } from "./types";

/**
 * The one switch for sending unverified accounts to confirm their address,
 * now on — with the API's rule mirrored: an unverified student verifies
 * first; a verified one, and staff, go where they always did.
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

const verified: User = { ...unverified, emailVerified: true };

describe("now that verification is enforced", () => {
  it("is on", () => {
    expect(EMAIL_VERIFICATION_ENFORCED).toBe(true);
  });

  it("asks an unverified student, and only them, to verify", () => {
    expect(mustVerifyEmail(unverified)).toBe(true);
    expect(mustVerifyEmail(verified)).toBe(false);
    expect(mustVerifyEmail(null)).toBe(false);
  });

  it("never asks staff, verified or not", () => {
    expect(mustVerifyEmail({ ...unverified, role: "admin" })).toBe(false);
    expect(mustVerifyEmail({ ...verified, role: "admin" })).toBe(false);
  });

  it("does not trap an account whose state is not known", () => {
    expect(mustVerifyEmail({ ...unverified, emailVerified: undefined })).toBe(false);
  });

  it("sends an unverified student to verify first, remembering where they were going", () => {
    expect(postSignInTarget(unverified)).toEqual({ path: VERIFY_EMAIL_PATH, state: { from: "/dashboard" } });
    expect(postSignInTarget(unverified, "/roadmap")).toEqual({
      path: VERIFY_EMAIL_PATH,
      state: { from: "/roadmap" },
    });
  });

  it("only remembers a destination the account's role may open", () => {
    expect(postSignInTarget(unverified, "/admin/students")).toEqual({
      path: VERIFY_EMAIL_PATH,
      state: { from: "/dashboard" },
    });
  });

  it("lands everyone else where they always did", () => {
    for (const user of [verified, { ...unverified, role: "admin" as const }, { ...verified, role: "admin" as const }]) {
      for (const from of [undefined, null, "/roadmap", "/admin/students", "nowhere"]) {
        expect(postSignInTarget(user, from)).toEqual({ path: landingPath(user, from) });
      }
    }
  });

  it("names the page it sends them to", () => {
    expect(VERIFY_EMAIL_PATH).toBe("/verify-email");
  });
});
