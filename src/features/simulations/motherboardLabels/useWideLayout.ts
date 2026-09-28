import { useEffect, useState } from "react";

/** How wide the page must be for labels to fit around the board rather than in a list below it. */
export const WIDE_LAYOUT_QUERY = "(min-width: 1024px)";

function matches(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_LAYOUT_QUERY).matches
    : false;
}

/**
 * Whether there is room for labels around the board. Follows the window as it
 * is resized; where nothing can be measured, the list layout, which fits
 * anywhere.
 */
export function useWideLayout(): boolean {
  const [wide, setWide] = useState(matches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(WIDE_LAYOUT_QUERY);
    const update = () => setWide(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return wide;
}
