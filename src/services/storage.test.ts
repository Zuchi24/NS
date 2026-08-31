import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storage } from "./storage";

/**
 * Where a signed-in session is kept, which is all "Remember Me" decides.
 *
 * The browser's own stores are stubbed in memory so this needs no DOM: the
 * behaviour under test is which store is written to, not what the browser does
 * with it afterwards.
 */

/** A Storage that behaves like the real one, including throwing on demand. */
function memoryStore(): Storage & { failing: boolean } {
  const entries = new Map<string, string>();

  const guard = <T>(run: () => T): T => {
    if (store.failing) throw new DOMException("denied", "SecurityError");
    return run();
  };

  const store = {
    failing: false,
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => guard(() => entries.get(key) ?? null),
    setItem: (key: string, value: string) =>
      guard(() => void entries.set(key, value)),
    removeItem: (key: string) => guard(() => void entries.delete(key)),
    clear: () => guard(() => entries.clear()),
  } as Storage & { failing: boolean };

  return store;
}

let local: ReturnType<typeof memoryStore>;
let session: ReturnType<typeof memoryStore>;

beforeEach(() => {
  local = memoryStore();
  session = memoryStore();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const KEY = "netsim-token";
const TOKEN = "1|abcdef";

describe("storage scopes", () => {
  it("keeps a remembered value past the tab, in local storage", () => {
    storage.set(KEY, TOKEN, "local");

    expect(local.getItem(KEY)).toBe(JSON.stringify(TOKEN));
    expect(session.getItem(KEY)).toBeNull();
    expect(storage.scopeOf(KEY)).toBe("local");
  });

  it("keeps an unremembered value only for the tab, in session storage", () => {
    storage.set(KEY, TOKEN, "session");

    expect(session.getItem(KEY)).toBe(JSON.stringify(TOKEN));
    expect(local.getItem(KEY)).toBeNull();
    expect(storage.scopeOf(KEY)).toBe("session");
  });

  it("defaults to remembering, which is what signing up expects", () => {
    storage.set(KEY, TOKEN);

    expect(storage.scopeOf(KEY)).toBe("local");
  });

  it("reads a value back from whichever scope holds it", () => {
    storage.set(KEY, TOKEN, "session");
    expect(storage.get<string>(KEY)).toBe(TOKEN);

    storage.set(KEY, TOKEN, "local");
    expect(storage.get<string>(KEY)).toBe(TOKEN);
  });

  it("never leaves the same key in both scopes", () => {
    // Signing in remembered, then signing in again without: the long-lived
    // copy has to go, or the session outlives the choice not to keep it.
    storage.set(KEY, TOKEN, "local");
    storage.set(KEY, "2|newer", "session");

    expect(local.getItem(KEY)).toBeNull();
    expect(session.getItem(KEY)).toBe(JSON.stringify("2|newer"));
    expect(storage.get<string>(KEY)).toBe("2|newer");
  });

  it("clears both scopes, so signing out leaves no copy behind", () => {
    storage.set(KEY, TOKEN, "local");
    // A stale value in the other store, however it got there.
    session.setItem(KEY, JSON.stringify("stale"));

    storage.remove(KEY);

    expect(local.getItem(KEY)).toBeNull();
    expect(session.getItem(KEY)).toBeNull();
    expect(storage.get(KEY)).toBeNull();
    expect(storage.scopeOf(KEY)).toBeNull();
  });

  it("prefers the session value when somehow both are present", () => {
    local.setItem(KEY, JSON.stringify("older"));
    session.setItem(KEY, JSON.stringify("newer"));

    expect(storage.get<string>(KEY)).toBe("newer");
    expect(storage.scopeOf(KEY)).toBe("session");
  });

  it("returns null for a key nobody has written", () => {
    expect(storage.get("netsim-nothing")).toBeNull();
    expect(storage.scopeOf("netsim-nothing")).toBeNull();
  });
});

describe("storage when the browser refuses", () => {
  it("does not throw when a store rejects every access", () => {
    local.failing = true;
    session.failing = true;

    expect(() => storage.set(KEY, TOKEN)).not.toThrow();
    expect(storage.get(KEY)).toBeNull();
    expect(storage.scopeOf(KEY)).toBeNull();
    expect(() => storage.remove(KEY)).not.toThrow();
  });

  it("still reads the working store when only one refuses", () => {
    storage.set(KEY, TOKEN, "local");
    session.failing = true;

    expect(storage.get<string>(KEY)).toBe(TOKEN);
  });

  it("survives a value an older build left unparseable", () => {
    local.setItem(KEY, "{not json");

    expect(storage.get(KEY)).toBeNull();
  });

  it("does not throw when there is no window at all", () => {
    vi.stubGlobal("window", undefined);

    expect(storage.get(KEY)).toBeNull();
    expect(() => storage.set(KEY, TOKEN)).not.toThrow();
    expect(() => storage.remove(KEY)).not.toThrow();
  });
});
