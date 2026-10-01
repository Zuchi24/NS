import { api } from "@/services/api";

/**
 * The signed-in user's own profile: their name and their picture.
 *
 * Every call is about the token's account — no path here names a user. None of
 * them hands back a user either: after a change, the page asks AuthContext to
 * refreshUser(), so the account on screen is read the one way it always is and
 * nothing here becomes a second source of it.
 */

/** The three fields a student may change about themselves. */
export interface ProfileNames {
  firstName: string;
  lastName: string;
  /** Empty clears it. */
  extendedName: string;
}

/** The kinds of picture the server takes, matched before anything is sent. */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** The largest picture the server takes, in bytes: 2 MB. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * What is wrong with `file` as a picture, or null if nothing is.
 *
 * Only to answer at once rather than after an upload. The server checks the
 * name and the bytes itself and has the final say.
 */
export function avatarProblem(file: File): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPEG, PNG or WebP image.";
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return "That picture is larger than 2 MB. Choose a smaller one.";
  }

  return null;
}

/** Sends exactly the three name fields, in the names the server reads. */
export async function updateProfile(names: ProfileNames): Promise<void> {
  // PUT, which the route takes alongside PATCH: all three fields are always
  // sent, so this is a replacement of the name either way.
  await api.put("/profile", {
    first_name: names.firstName,
    last_name: names.lastName,
    extended_name: names.extendedName.trim() === "" ? null : names.extendedName,
  });
}

export async function uploadAvatar(file: File): Promise<void> {
  const form = new FormData();
  form.append("avatar", file);

  await api.upload("/profile/avatar", form);
}

export async function deleteAvatar(): Promise<void> {
  await api.delete("/profile/avatar");
}

/** The picture's bytes, fetched with the bearer token like any other request. */
export function fetchAvatar(avatarUrl: string): Promise<Blob> {
  return api.download(pathOf(avatarUrl));
}

/**
 * The API path out of the absolute URL the server built. The api client adds
 * its own base, so the origin and `/api` prefix are trimmed rather than sent
 * twice — as materialService does for download links.
 */
function pathOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "");
}
