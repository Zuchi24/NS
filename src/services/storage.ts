/**
 * Thin typed wrapper around the browser's two key-value stores.
 *
 * Every access is guarded: private-mode browsers and storage-disabled
 * environments throw on access rather than returning null, and a value written
 * by an older build may no longer parse.
 *
 * A value lives in one of two scopes. "local" survives closing the browser;
 * "session" dies with the tab. That distinction is what "Remember Me" on the
 * login form actually means — see `authToken`.
 */

export type StorageScope = "local" | "session";

/** Null when the browser refuses the store outright, which is not an error. */
function backing(scope: StorageScope): Storage | null {
  try {
    return scope === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

const SCOPES: StorageScope[] = ["session", "local"];

export const storage = {
  /**
   * Reads from either scope, session first — the shorter-lived answer is the
   * more deliberate one, so it wins when both somehow hold a key.
   */
  get<T>(key: string): T | null {
    for (const scope of SCOPES) {
      try {
        const raw = backing(scope)?.getItem(key);
        if (raw != null) return JSON.parse(raw) as T;
      } catch {
        // Unreadable or unparseable: fall through to the other scope.
      }
    }

    return null;
  },

  /** Writes to one scope and clears the other, so a key is never in both. */
  set<T>(key: string, value: T, scope: StorageScope = "local"): void {
    const other: StorageScope = scope === "local" ? "session" : "local";

    try {
      backing(other)?.removeItem(key);
    } catch {
      // Non-fatal.
    }

    try {
      backing(scope)?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — non-fatal.
    }
  },

  /** Removes the key from both scopes. Signing out must not leave a copy. */
  remove(key: string): void {
    for (const scope of SCOPES) {
      try {
        backing(scope)?.removeItem(key);
      } catch {
        // Non-fatal.
      }
    }
  },

  /** Which scope currently holds the key, if either. */
  scopeOf(key: string): StorageScope | null {
    for (const scope of SCOPES) {
      try {
        if (backing(scope)?.getItem(key) != null) return scope;
      } catch {
        // Unreadable: treat as absent.
      }
    }

    return null;
  },
};
