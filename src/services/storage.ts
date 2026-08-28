/**
 * Thin typed wrapper around localStorage.
 *
 * Every access is guarded: private-mode browsers and storage-disabled
 * environments throw on access rather than returning null, and a value written
 * by an older build may no longer parse.
 */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — non-fatal.
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Non-fatal.
    }
  },
};
