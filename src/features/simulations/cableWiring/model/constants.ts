/**
 * The fixed physics of the cable bench.
 *
 * These are the same at every difficulty: difficulty changes how much help the
 * student gets and how strictly the work is graded, never how the cable
 * behaves. Every length is in whole millimetres.
 *
 * The plug is modelled along one axis measured from its rear opening, so the
 * plug-frame constants below are depths into the plug. The values are the
 * frozen P0 defaults and still carry an instructor sign-off.
 */

/** Rear opening to the plug's inner front face. */
export const FRONT_STOP = 21;

/** A conductor tip must reach this depth for its blade to pierce it. */
export const CONTACT_LINE = 19;

/** The deepest the jacket can enter the plug. */
export const JACKET_STOP = 10;

/** The jacket must be at least this far in for the strain relief to grip it. */
export const RELIEF_CLAMP = 6;

/** TIA-568 limit on untwisted conductor at a Cat5e/6 termination. */
export const MAX_UNTWIST = 13;

/** The least exposed conductor a pair needs before it can be untwisted. */
export const MIN_WORK = 20;

/** The least jacketed cable that must remain between the two ends. */
export const MIN_BODY = 50;

/** The most jacket one pass of the stripper removes. */
export const MAX_STRIP_PASS = 80;

/** How far short of the front face a tip may stop and still count as "at the front". */
export const AT_FRONT_TOLERANCE = 1;

/** The longest conductor must be at least this far inside for a plug to be on. */
export const MIN_ENGAGE = 1;

/**
 * The eight conductors in the order they lie as they leave the jacket — the
 * order the fan starts in once every pair is untwisted. The same flattening of
 * the pairs the legacy bench uses, and the same strings the backend grades.
 */
export const NATURAL_ORDER = [
  "white-orange",
  "orange",
  "white-green",
  "green",
  "blue",
  "white-blue",
  "white-brown",
  "brown",
] as const;

/**
 * How much shorter each conductor ends up when the bundle is trimmed before
 * its pairs are fanned flat. Indexed by NATURAL_ORDER.
 */
export const UNEVEN_OFFSETS = [0, 1, 3, 2, 0, 1, 3, 2] as const;

export const PAIR_IDS = ["orange", "green", "blue", "brown"] as const;

export const END_IDS = ["A", "B"] as const;

/** Pin order for each wiring standard, pin 1 first. */
export const T568A = [
  "white-green",
  "green",
  "white-orange",
  "blue",
  "white-blue",
  "orange",
  "white-brown",
  "brown",
] as const;

export const T568B = [
  "white-orange",
  "orange",
  "white-green",
  "blue",
  "white-blue",
  "green",
  "white-brown",
  "brown",
] as const;

/** The twisted pairs, as physical partners. */
export const PAIRS = {
  orange: ["white-orange", "orange"],
  green: ["white-green", "green"],
  blue: ["white-blue", "blue"],
  brown: ["white-brown", "brown"],
} as const;

/** Each conductor's twisted partner. */
export const PARTNER = {
  "white-orange": "orange",
  orange: "white-orange",
  "white-green": "green",
  green: "white-green",
  "white-blue": "blue",
  blue: "white-blue",
  "white-brown": "brown",
  brown: "white-brown",
} as const;

/** The pin positions each signal pair must occupy. */
export const PIN_PAIRS = [
  [1, 2],
  [3, 6],
  [4, 5],
  [7, 8],
] as const;

/**
 * The end-to-end pin maps a wiremap recognises. Entry `i` is the far-end pin
 * that near-end pin `i + 1` reaches. Every one of them is its own inverse, so a
 * pattern reads the same from either end.
 */
export const PATTERNS = {
  straight: [1, 2, 3, 4, 5, 6, 7, 8],
  crossover: [3, 6, 1, 4, 5, 2, 7, 8],
  "gigabit-crossover": [3, 6, 1, 7, 8, 2, 4, 5],
  rollover: [8, 7, 6, 5, 4, 3, 2, 1],
} as const;
