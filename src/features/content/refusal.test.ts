import { describe, expect, it } from "vitest";

import { refusalReason } from "./refusal";

/**
 * Which words a refusal is shown with.
 *
 * The server's reason whenever it gave one, and the page's own plain fallback
 * only when it did not — never a reason invented in between.
 */

describe("refusalReason", () => {
  it("passes the server's reason through as it was written", () => {
    expect(
      refusalReason(
        'Take the pre-test for "Networking Fundamentals" before starting its subtopics.',
        "fallback",
      ),
    ).toBe('Take the pre-test for "Networking Fundamentals" before starting its subtopics.');
  });

  it("uses the fallback when the server gave no reason of its own", () => {
    expect(refusalReason("This action is unauthorized.", "fallback")).toBe("fallback");
    expect(refusalReason("   ", "fallback")).toBe("fallback");
    expect(refusalReason("", "fallback")).toBe("fallback");
    expect(refusalReason(null, "fallback")).toBe("fallback");
    expect(refusalReason(undefined, "fallback")).toBe("fallback");
  });
});
