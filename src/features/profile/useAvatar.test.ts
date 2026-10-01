// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

/**
 * Turning the server's private picture address into one an image can show.
 *
 * The address answers only with a bearer token, so the hook fetches the bytes
 * through the API client and hands back an object URL — and it is the hook's
 * job that no object URL outlives the picture it was made for, and that an
 * older answer never replaces a newer one.
 */

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();

  return { ...actual, api: { download: vi.fn() } };
});

const { api } = await import("@/services/api");
const { useAvatar } = await import("./useAvatar");

const FIRST = "http://localhost:8000/api/profile/avatar?v=aaaaaaaaaaaa";
const SECOND = "http://localhost:8000/api/profile/avatar?v=bbbbbbbbbbbb";

let made = 0;
const createObjectURL = vi.fn(() => `blob:${++made}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  made = 0;
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.mocked(api.download).mockImplementation(async () => new Blob(["img"], { type: "image/png" }));
});

afterEach(cleanup);

/** A download that answers only when told to. */
function deferred() {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Blob>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });

  return { promise, resolve: () => resolve(new Blob(["img"])), reject };
}

describe("useAvatar", () => {
  it("is null with no picture, and fetches nothing", () => {
    const { result } = renderHook(() => useAvatar(null));

    expect(result.current).toBeNull();
    expect(api.download).not.toHaveBeenCalled();
  });

  it("fetches through the API client, on the API's own path, and answers with an object URL", async () => {
    const { result } = renderHook(() => useAvatar(FIRST));

    await waitFor(() => expect(result.current).toBe("blob:1"));
    expect(api.download).toHaveBeenCalledWith("/profile/avatar?v=aaaaaaaaaaaa");
  });

  it("fetches again for a new address and revokes the URL it replaces", async () => {
    const { result, rerender } = renderHook(({ url }) => useAvatar(url), { initialProps: { url: FIRST } });
    await waitFor(() => expect(result.current).toBe("blob:1"));

    rerender({ url: SECOND });

    await waitFor(() => expect(result.current).toBe("blob:2"));
    expect(api.download).toHaveBeenLastCalledWith("/profile/avatar?v=bbbbbbbbbbbb");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:2");
  });

  it("revokes its URL when the picture is removed", async () => {
    const { result, rerender } = renderHook(({ url }) => useAvatar(url), {
      initialProps: { url: FIRST as string | null },
    });
    await waitFor(() => expect(result.current).toBe("blob:1"));

    rerender({ url: null });

    expect(result.current).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("revokes its URL when the component goes", async () => {
    const { result, unmount } = renderHook(() => useAvatar(FIRST));
    await waitFor(() => expect(result.current).toBe("blob:1"));

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("drops an older answer that arrives after a newer one, and never makes a URL for it", async () => {
    const slow = deferred();
    const fast = deferred();
    vi.mocked(api.download).mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const { result, rerender } = renderHook(({ url }) => useAvatar(url), { initialProps: { url: FIRST } });
    rerender({ url: SECOND });

    fast.resolve();
    await waitFor(() => expect(result.current).toBe("blob:1"));

    slow.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBe("blob:1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("is null when the picture cannot be fetched", async () => {
    vi.mocked(api.download).mockRejectedValue(new Error("404"));

    const { result } = renderHook(() => useAvatar(FIRST));

    await waitFor(() => expect(api.download).toHaveBeenCalled());
    await Promise.resolve();

    expect(result.current).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
