import type { Conductor, PairId } from "../model";

/**
 * How each conductor is drawn. Appearance only — no rule anywhere reads a
 * colour; the model works in conductor names.
 *
 * A striped conductor is its pair colour over a pale base, as real insulation
 * is. The tones match the legacy bench's so the two read as the same cable.
 */
export const CONDUCTOR_PAINT: Record<Conductor, { base: string; stripe: string | null }> = {
  "white-orange": { base: "#FFE9D2", stripe: "#EA7A0C" },
  orange: { base: "#EA7A0C", stripe: null },
  "white-green": { base: "#E2FBE2", stripe: "#14912E" },
  green: { base: "#14912E", stripe: null },
  "white-blue": { base: "#DCE9FF", stripe: "#1E5FD9" },
  blue: { base: "#1E5FD9", stripe: null },
  "white-brown": { base: "#F3E7D8", stripe: "#7C4A21" },
  brown: { base: "#7C4A21", stripe: null },
};

export const PAIR_PAINT: Record<PairId, string> = {
  orange: "#EA7A0C",
  green: "#14912E",
  blue: "#1E5FD9",
  brown: "#7C4A21",
};

/** A CSS background for a conductor swatch in the DOM. */
export function swatchBackground(conductor: Conductor): string {
  const { base, stripe } = CONDUCTOR_PAINT[conductor];

  return stripe ? `repeating-linear-gradient(135deg, ${base} 0 5px, ${stripe} 5px 9px)` : base;
}
