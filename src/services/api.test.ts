// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, UNAUTHENTICATED_EVENT, VERIFICATION_REQUIRED_EVENT, api, authToken } from "./api";

/**
 * What a caller is told when a request fails.
 *
 * The API's own message is the one worth showing — it is written for the
 * person reading it and names the field it is about. These are mostly about
 * the other case: a failure that never reached the API, whose body is an HTML
 * error page or nothing at all. That used to surface as "Request failed (413)",
 * a status code read aloud, which is exactly when a reader is least able to
 * guess what happened.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  authToken.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A response the way fetch hands one over. */
function respond(status: number, body: string, ok = false) {
  return {
    ok,
    status,
    json: async () => JSON.parse(body),
  } as Response;
}

describe("failed requests", () => {
  it("uses Laravel's own message and field errors", async () => {
    fetchMock.mockResolvedValueOnce(
      respond(
        422,
        JSON.stringify({
          message: "That kind of file is not accepted.",
          errors: { file: ["That kind of file is not accepted."] },
        }),
      ),
    );

    const error = await api.upload("/admin/topics/1/materials", new FormData())
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(
      "That kind of file is not accepted.",
    );
    // The field it was about, so the form can put it under that box.
    expect((error as ApiError).fieldError("file")).toContain("not accepted");
  });

  it("says what a 413 means when the body is not the API's JSON", async () => {
    // What a web server in front of PHP returns when it refuses the upload
    // itself: an HTML page, or nothing. There is no message to quote.
    fetchMock.mockResolvedValueOnce(respond(413, "<html>413 Request Entity Too Large</html>"));

    const error = (await api
      .upload("/admin/topics/1/materials", new FormData())
      .catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(413);
    expect(error.message).toMatch(/too large/i);
    expect(error.message).not.toMatch(/request failed/i);
  });

  it("does not read a status code aloud for an unparseable failure", async () => {
    fetchMock.mockResolvedValueOnce(respond(500, "gateway blew up"));

    const error = (await api.get("/roadmaps").catch((e: unknown) => e)) as ApiError;

    expect(error.message).toMatch(/server had a problem/i);
  });

  it("prefers the API's message over its own even on a 413", async () => {
    // Laravel answers this one itself, naming the size it accepts. That is
    // better than anything the client could invent, so it wins.
    fetchMock.mockResolvedValueOnce(
      respond(
        413,
        JSON.stringify({
          message: "That upload is larger than 20 MB, which is the most this server accepts.",
          errors: { file: ["That upload is larger than 20 MB."] },
        }),
      ),
    );

    const error = (await api
      .upload("/admin/topics/1/materials", new FormData())
      .catch((e: unknown) => e)) as ApiError;

    expect(error.message).toContain("larger than 20 MB");
    expect(error.fieldError("file")).toContain("larger than 20 MB");
  });

  it("ignores an empty message rather than showing a blank error", async () => {
    fetchMock.mockResolvedValueOnce(respond(403, JSON.stringify({ message: "  " })));

    const error = (await api.get("/roadmaps").catch((e: unknown) => e)) as ApiError;

    expect(error.message).toMatch(/permission/i);
  });

  it("drops a rejected token so the app falls back to signed out", async () => {
    authToken.set("stale-token");

    fetchMock.mockResolvedValueOnce(
      respond(401, JSON.stringify({ message: "Unauthenticated." })),
    );

    await api.get("/me").catch(() => null);

    expect(authToken.get()).toBeNull();
  });

  it("says so on the window when it drops a rejected token, so the screen can follow", async () => {
    authToken.set("stale-token");
    const heard = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, heard);

    fetchMock.mockResolvedValueOnce(respond(401, JSON.stringify({ message: "Unauthenticated." })));
    await api.get("/me").catch(() => null);

    window.removeEventListener(UNAUTHENTICATED_EVENT, heard);

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the refused request carried no token, or a refusal is not a 401", async () => {
    const heard = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, heard);

    // No token to drop: a refused sign-in attempt is not a sign-out.
    fetchMock.mockResolvedValueOnce(respond(401, JSON.stringify({ message: "Unauthenticated." })));
    await api.get("/login").catch(() => null);

    // A token, but a refusal to do something rather than the end of the session.
    authToken.set("good-token");
    fetchMock.mockResolvedValueOnce(respond(403, JSON.stringify({ message: "Not yours." })));
    await api.get("/admin/overview").catch(() => null);

    window.removeEventListener(UNAUTHENTICATED_EVENT, heard);

    expect(heard).not.toHaveBeenCalled();
    expect(authToken.get()).toBe("good-token");
  });

  it("leaves a newer token alone when the refusal was for the one it replaced", async () => {
    authToken.set("old-token");

    fetchMock.mockImplementationOnce(async () => {
      // Another tab signs in while this request is out.
      authToken.set("new-token");
      return respond(401, JSON.stringify({ message: "Unauthenticated." }));
    });

    await api.get("/me").catch(() => null);

    expect(authToken.get()).toBe("new-token");
  });

  it("says the server cannot be reached when the request never went out", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = (await api.get("/roadmaps").catch((e: unknown) => e)) as ApiError;

    expect(error.isOffline).toBe(true);
    expect(error.message).toMatch(/cannot reach the server/i);
  });
});

describe("how long the server asked to wait", () => {
  /** A response with headers, the way a limited request comes back. */
  function limited(body: unknown, headers: Record<string, string> = {}) {
    return {
      ok: false,
      status: 429,
      headers: new Headers(headers),
      json: async () => body,
    } as Response;
  }

  it("reads the API's own retry_after", async () => {
    fetchMock.mockResolvedValueOnce(
      limited({ message: "Please wait before requesting another code.", retry_after: 42 }, { "Retry-After": "42" }),
    );

    const error = (await api.post("/email/verification-code").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(42);
    expect(error.message).toBe("Please wait before requesting another code.");
  });

  it("falls back to the Retry-After header a route limiter sends alone", async () => {
    fetchMock.mockResolvedValueOnce(limited({ message: "Too Many Attempts." }, { "Retry-After": "17" }));

    const error = (await api.post("/email/verify", { code: "123456" }).catch((e: unknown) => e)) as ApiError;

    expect(error.retryAfter).toBe(17);
  });

  it("says nothing when the server said nothing", async () => {
    fetchMock.mockResolvedValueOnce(limited({ message: "Too Many Attempts." }));

    const error = (await api.post("/email/verify").catch((e: unknown) => e)) as ApiError;

    expect(error.retryAfter).toBeNull();
  });

  it("keeps the rest of the error body for fields beyond the message", async () => {
    fetchMock.mockResolvedValueOnce(
      respond(
        422,
        JSON.stringify({
          message: "That code is incorrect or has expired.",
          errors: { code: ["That code is incorrect or has expired."] },
          resend_required: true,
        }),
      ),
    );

    const error = (await api.post("/email/verify", { code: "123456" }).catch((e: unknown) => e)) as ApiError;

    expect(error.body.resend_required).toBe(true);
    expect(error.fieldError("code")).toBe("That code is incorrect or has expired.");
    expect(error.retryAfter).toBeNull();
  });

  it("leaves errors made by hand as they were", () => {
    const error = new ApiError("Nope", 400, { field: ["Bad"] });

    expect(error.retryAfter).toBeNull();
    expect(error.body).toEqual({});
    expect(error.fieldError("field")).toBe("Bad");
  });
});

describe("a request refused for want of a verified address", () => {
  it("is recognised by the API's flag, and announced once", async () => {
    const heard = vi.fn();
    window.addEventListener(VERIFICATION_REQUIRED_EVENT, heard);
    fetchMock.mockResolvedValueOnce(
      respond(403, JSON.stringify({ message: "Email verification required.", verification_required: true })),
    );

    const error = (await api.get("/roadmaps").catch((e: unknown) => e)) as ApiError;

    expect(error.isVerificationRequired).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(VERIFICATION_REQUIRED_EVENT, heard);
  });

  it("is not any other 403, whatever it says", async () => {
    const heard = vi.fn();
    window.addEventListener(VERIFICATION_REQUIRED_EVENT, heard);
    fetchMock.mockResolvedValueOnce(
      respond(403, JSON.stringify({ message: "Email verification required." })),
    );

    const error = (await api.get("/admin/overview").catch((e: unknown) => e)) as ApiError;

    expect(error.isVerificationRequired).toBe(false);
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener(VERIFICATION_REQUIRED_EVENT, heard);
  });
});
