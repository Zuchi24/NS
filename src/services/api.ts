import { storage } from "./storage";
import type { StorageScope } from "./storage";

/**
 * The one place the app talks to the Laravel API.
 *
 * Every call goes out with the bearer token if there is one, and comes back as
 * either parsed JSON or an ApiError carrying the status and Laravel's own
 * validation messages. Callers never touch fetch directly.
 */

// 127.0.0.1 rather than localhost: the API's dev server binds IPv4 only, so the
// name costs a stalled IPv6 attempt — around 200ms — on every single request.
const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "netsim-token";

/** Laravel's 422 body: one array of messages per rejected field. */
export type ValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: ValidationErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The server's first complaint about one field, if it had one. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }

  /** The token is missing, expired, or was revoked. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** The request never reached the server. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

export const authToken = {
  get: (): string | null => storage.get<string>(TOKEN_KEY),

  /**
   * Keeps the token for good, or only until the tab closes.
   *
   * This is the whole of "Remember Me": remembered sessions go to
   * localStorage and survive a restart, the rest go to sessionStorage and do
   * not. Nothing is asked of the server either way — the token it issued is
   * the same, this only decides how long the browser holds on to it.
   */
  set: (value: string, remember = true): void =>
    storage.set(TOKEN_KEY, value, remember ? "local" : "session"),

  clear: (): void => storage.remove(TOKEN_KEY),

  /** Where the live token is kept, so anything cached alongside it can match. */
  scope: (): StorageScope => storage.scopeOf(TOKEN_KEY) ?? "local",
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = authToken.get();
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when the request never made it out — a dead server,
    // no network, or CORS refusing the call before it was sent.
    throw new ApiError(
      `Cannot reach the server at ${BASE_URL}. Is it running?`,
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // An error page from the web server rather than the API will not be JSON.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // A rejected token is worthless; drop it so the app falls back to signed
    // out instead of retrying with it on every subsequent call.
    if (response.status === 401) {
      authToken.clear();
    }

    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors ?? {},
    );
  }

  return payload as T;
}

/**
 * A request whose body is a file upload rather than JSON.
 *
 * FormData sets its own Content-Type — including the multipart boundary — so
 * this differs from `request` in exactly one way: it must not set that header
 * itself. Everything else, the token and the error handling, is shared.
 *
 * Laravel does not read a multipart body on PUT or PATCH, so an update sends
 * POST with `_method` in the payload, which is the same spoofing a browser
 * form does.
 */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = authToken.get();
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
  } catch {
    throw new ApiError(`Cannot reach the server at ${BASE_URL}. Is it running?`, 0);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      authToken.clear();
    }

    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors ?? {},
    );
  }

  return payload as T;
}

/**
 * Fetches a file the API only releases to an authenticated caller.
 *
 * Uploaded material is held on a private disk and served through a route that
 * checks the same policy as the topic it belongs to, so the bytes cannot be
 * reached by pointing a browser at a storage URL — there is no such URL. That
 * also means a plain link cannot fetch one: the token lives in a header, and
 * an `<a href>` does not send it. So the file is fetched here, with the header,
 * and handed back as a blob for the caller to save.
 */
async function download(path: string): Promise<Blob> {
  const token = authToken.get();
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(`Cannot reach the server at ${BASE_URL}. Is it running?`, 0);
  }

  if (!response.ok) {
    if (response.status === 401) {
      authToken.clear();
    }

    // The body of a failed download is JSON, not the file.
    const payload = await response.json().catch(() => null);

    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors ?? {},
    );
  }

  return response.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload,
  download,
};
