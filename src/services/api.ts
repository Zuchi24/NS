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

/** The key the credential is stored under, for anything watching it change. */
export const AUTH_TOKEN_KEY = TOKEN_KEY;

/** Laravel's 422 body: one array of messages per rejected field. */
export type ValidationErrors = Record<string, string[]>;

/**
 * What to say when the response body was not the API's own JSON.
 *
 * A failure that came from the API carries its own message, and that is what
 * the caller should see. This is for the ones that never reached it: a web
 * server refusing an upload before PHP runs, a proxy timing out, an HTML error
 * page. "Request failed (413)" is a status code read aloud; these at least say
 * what kind of thing went wrong and what might be done about it.
 */
function statusMessage(status: number): string {
  switch (status) {
    case 413:
      return "The server refused that upload as too large. Try a smaller file, or add it as a link.";
    case 401:
      return "Your session has expired. Sign in again.";
    case 403:
      return "You do not have permission to do that.";
    case 404:
      return "That is not there any more.";
    case 419:
      return "Your session has expired. Sign in again.";
    case 429:
      return "That is too many requests at once. Wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server had a problem with that. Try again in a moment.";
    default:
      return `The server refused that request (${status}).`;
  }
}

/**
 * The error behind a failed response.
 *
 * Laravel's own message is preferred over anything invented here — it is
 * written for the person reading it and names the field it is about. The
 * fallback is only for a body that is not the API's JSON at all, which is
 * exactly when a bare status code is least use to anyone.
 */
function errorFrom(
  status: number,
  payload: { message?: string; errors?: ValidationErrors } | null,
  headers?: Headers,
): ApiError {
  const message =
    typeof payload?.message === "string" && payload.message.trim() !== ""
      ? payload.message
      : statusMessage(status);

  const error = new ApiError(message, status, payload?.errors ?? {}, {
    retryAfter: retryAfterFrom(payload, headers),
    body: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {},
  });

  // Whatever asked, the account has to confirm its address first. Said once,
  // here, so the session can re-read the account and the route guard send it
  // to verify — rather than every page learning to recognise this refusal.
  if (error.isVerificationRequired && typeof window !== "undefined") {
    window.dispatchEvent(new Event(VERIFICATION_REQUIRED_EVENT));
  }

  return error;
}

/** Raised on the window when the API refuses a request for want of a verified address. */
export const VERIFICATION_REQUIRED_EVENT = "netsim:verification-required";

/**
 * Raised on the window when the credential a request carried was refused, so
 * the session can drop the account it is still showing. Without it the token
 * goes but the screen keeps the name, and looks signed in until a reload.
 */
export const UNAUTHENTICATED_EVENT = "netsim:unauthenticated";

/**
 * A 401 for the credential that request carried: drop it, and say so.
 *
 * Only when that credential is still the live one. Another tab may have signed
 * in as someone else while this request was in flight, and its refusal says
 * nothing about the new session — clearing then would sign out the account
 * that had just been chosen. A request that carried no credential has nothing
 * to drop either, so a refused sign-in attempt is not a sign-out.
 */
function rejectCredential(sent: string | null): void {
  if (sent === null || authToken.get() !== sent) {
    return;
  }

  authToken.clear();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  }
}

/**
 * How long the server asked to be left alone, in whole seconds.
 *
 * The API's own `retry_after` when it sent one, otherwise the standard
 * Retry-After header — which is all Laravel's route limiters send. Only ever
 * the server's figure: a page shows it, and never decides it.
 */
function retryAfterFrom(payload: unknown, headers?: Headers): number | null {
  const fromBody = (payload as { retry_after?: unknown } | null)?.retry_after;

  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody >= 0) {
    return Math.ceil(fromBody);
  }

  const fromHeader = Number(headers?.get("Retry-After") ?? Number.NaN);

  return Number.isFinite(fromHeader) && fromHeader >= 0 ? Math.ceil(fromHeader) : null;
}

export class ApiError extends Error {
  /** Seconds the server asked to wait before trying again, when it said. */
  readonly retryAfter: number | null;

  /** The whole of the API's error body, for fields beyond message and errors. */
  readonly body: Record<string, unknown>;

  constructor(
    message: string,
    readonly status: number,
    readonly errors: ValidationErrors = {},
    details: { retryAfter?: number | null; body?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.retryAfter = details.retryAfter ?? null;
    this.body = details.body ?? {};
  }

  /** The server's first complaint about one field, if it had one. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }

  /** The token is missing, expired, or was revoked. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /**
   * Refused because the account has not confirmed its email address. Read
   * from the API's flag, never its wording.
   */
  get isVerificationRequired(): boolean {
    return this.status === 403 && this.body.verification_required === true;
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
      rejectCredential(token);
    }

    throw errorFrom(response.status, payload, response.headers);
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
      rejectCredential(token);
    }

    throw errorFrom(response.status, payload, response.headers);
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
      rejectCredential(token);
    }

    // The body of a failed download is JSON, not the file.
    const payload = await response.json().catch(() => null);

    throw errorFrom(response.status, payload, response.headers);
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
