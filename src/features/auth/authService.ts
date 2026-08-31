import { ApiError, api, authToken } from "@/services/api";
import { storage } from "@/services/storage";
import type {
  LoginCredentials,
  Role,
  SignUpDetails,
  User,
  YearLevelOptions,
} from "./types";

/**
 * Authentication against the Laravel API.
 *
 * The token is what actually keeps the session; the cached user is only there
 * so the app can render immediately on reload instead of flashing a spinner
 * while /me answers.
 */

const USER_KEY = "netsim-user";

/** The shape UserResource returns, snake_case and untouched. */
interface ApiUser {
  id: number;
  student_id: string | null;
  first_name: string;
  last_name: string;
  extended_name: string | null;
  full_name: string;
  email: string;
  role: Role;
  created_at: string | null;
  section_id: number | null;
  section?: { id: number; name: string; year_level: string };
}

interface AuthResponse {
  user: ApiUser;
  token: string;
}

function toUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.full_name,
    firstName: user.first_name,
    lastName: user.last_name,
    studentId: user.student_id,
    email: user.email,
    role: user.role,
    joinedAt: user.created_at ?? null,
    section: user.section
      ? {
          id: user.section.id,
          name: user.section.name,
          yearLevel: user.section.year_level,
        }
      : null,
  };
}

/** Names the token so a student can tell their devices apart and revoke one. */
function deviceName(): string {
  return `NetSim Web (${navigator.platform || "browser"})`.slice(0, 255);
}

function persist(user: ApiUser, token?: string, remember = true): User {
  if (token) {
    authToken.set(token, remember);
  }

  const mapped = toUser(user);
  // The cached user is only a render optimisation, so it lives exactly as long
  // as the token does — an unremembered session must not leave a name behind.
  storage.set(USER_KEY, mapped, authToken.scope());

  return mapped;
}

export async function login({
  email,
  password,
  remember = false,
}: LoginCredentials): Promise<User> {
  const response = await api.post<AuthResponse>("/login", {
    email,
    password,
    device_name: deviceName(),
  });

  return persist(response.user, response.token, remember);
}

export async function signup(details: SignUpDetails): Promise<User> {
  const response = await api.post<AuthResponse>("/register", {
    first_name: details.firstName,
    last_name: details.lastName,
    extended_name: details.nameExtension || null,
    student_id: details.studentId || null,
    email: details.email,
    password: details.password,
    password_confirmation: details.passwordConfirmation,
    section_id: details.sectionId,
  });

  return persist(response.user, response.token);
}

/**
 * The year levels and sections a student can enrol into.
 *
 * Read before anyone has an account, so this endpoint takes no token. It
 * returns only active sections, which is what makes the sign-up field a choice
 * from the timetable rather than free text.
 */
export async function fetchSections(): Promise<YearLevelOptions[]> {
  const { data } = await api.get<{ data: YearLevelOptions[] }>("/sections");

  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/logout");
  } catch {
    // The token is already gone, or the server is unreachable. Either way the
    // session ends here — a failed logout must never strand someone signed in.
  } finally {
    authToken.clear();
    storage.remove(USER_KEY);
  }
}

/**
 * Re-establishes the session on page load. Returns null when signed out.
 *
 * A rejected token means signed out. An unreachable server does not: the cached
 * user stands so a reload during a backend restart does not throw someone out.
 */
export async function restoreSession(): Promise<User | null> {
  if (!authToken.get()) {
    return null;
  }

  try {
    const response = await api.get<{ data: ApiUser }>("/me");
    return persist(response.data);
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      storage.remove(USER_KEY);
      return null;
    }

    return storage.get<User>(USER_KEY);
  }
}
