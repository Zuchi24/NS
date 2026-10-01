import { useEffect, useState } from "react";

import { fetchAvatar } from "./profileService";

/**
 * The signed-in user's picture, as an address an `<img>` can show.
 *
 * The server's address for it answers only with a bearer token, which an image
 * request cannot carry, so the bytes are fetched through the API client and
 * handed to the image as an object URL. A new `avatarUrl` — which every upload
 * produces — fetches again; the object URL it replaces is revoked, and so is the
 * last one when the component goes.
 *
 * Null while there is no picture, while it is on its way, and when it could not
 * be fetched: in every one of those the caller shows its fallback.
 */
export function useAvatar(avatarUrl: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);

    if (!avatarUrl) return;

    // An answer for an address that has since changed, or for a component
    // that has gone, is dropped — and its object URL never outlives it.
    let current = true;
    let created: string | null = null;

    fetchAvatar(avatarUrl)
      .then((blob) => {
        if (!current) return;

        created = URL.createObjectURL(blob);
        setSrc(created);
      })
      .catch(() => {
        if (current) setSrc(null);
      });

    return () => {
      current = false;

      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [avatarUrl]);

  return src;
}
