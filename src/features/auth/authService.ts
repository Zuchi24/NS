import { storage } from "@/services/storage";
import type { LoginCredentials, Role, SignUpDetails, User } from "./types";

const AUTH_KEY = "netsim-auth";

/**
 * The session is currently faked in the browser. When the backend lands, only
 * the bodies below change: swap the timeouts for `api.post(...)` calls and keep
 * persisting whatever the server returns. Nothing outside this file needs to
 * know the difference.
 */

const FAKE_LATENCY_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Derives a display name from an email local-part, e.g. "juan.cruz" -> "Juan Cruz". */
function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function login({
  email,
  password,
  role,
}: LoginCredentials): Promise<User> {
  await delay(FAKE_LATENCY_MS);

  if (!email || !password) {
    throw new Error("Please fill in all fields");
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: nameFromEmail(email),
    email,
    role,
  };

  storage.set(AUTH_KEY, user);
  return user;
}

export async function signup(details: SignUpDetails): Promise<User> {
  await delay(FAKE_LATENCY_MS);

  const user: User = {
    id: details.studentId || crypto.randomUUID(),
    name: [details.firstName, details.lastName].filter(Boolean).join(" "),
    email: details.email,
    role: "student",
  };

  storage.set(AUTH_KEY, user);
  return user;
}

export function logout(): void {
  storage.remove(AUTH_KEY);
}

/** Reads the persisted session. Returns null when signed out or when the stored shape is stale. */
export function getCurrentUser(): User | null {
  const user = storage.get<User>(AUTH_KEY);
  if (!user || typeof user.email !== "string") return null;

  const roles: Role[] = ["student", "admin"];
  if (!roles.includes(user.role)) return null;

  return user;
}
