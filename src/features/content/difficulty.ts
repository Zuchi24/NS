import type { Difficulty } from "./types";

/**
 * How a difficulty band is drawn.
 *
 * The band itself is authored on the challenge and comes from the API — see
 * `Challenge.difficulty`. This file holds only the presentation: the wording,
 * the colours and the number of bars. Nothing here decides how hard anything
 * is, and nothing is inferred from a challenge's title or its position in the
 * running order, which is how a newly added challenge used to end up billed as
 * Advanced whatever it actually asked for.
 */

export type { Difficulty };

export const DIFFICULTY_ORDER: Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const DIFFICULTY_META: Record<
  Difficulty,
  {
    label: string;
    blurb: string;
    /** Filled bars out of three, drawn like a signal meter. */
    bars: number;
    text: string;
    fill: string;
    active: string;
  }
> = {
  beginner: {
    label: "Beginner",
    blurb: "Build the machine, make the cable, light up your first link.",
    bars: 1,
    text: "text-emerald-700",
    fill: "bg-emerald-500",
    active: "bg-emerald-600 text-white border-emerald-600",
  },
  intermediate: {
    label: "Intermediate",
    blurb: "Grow one switch into a working LAN, then give it an address.",
    bars: 2,
    text: "text-amber-700",
    fill: "bg-amber-500",
    active: "bg-amber-600 text-white border-amber-600",
  },
  advanced: {
    label: "Advanced",
    blurb: "Link switches, span buildings, and put services on the network.",
    bars: 3,
    text: "text-rose-700",
    fill: "bg-rose-500",
    active: "bg-rose-600 text-white border-rose-600",
  },
};
