// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, authToken } from "./api";

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

  it("says the server cannot be reached when the request never went out", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = (await api.get("/roadmaps").catch((e: unknown) => e)) as ApiError;

    expect(error.isOffline).toBe(true);
    expect(error.message).toMatch(/cannot reach the server/i);
  });
});
