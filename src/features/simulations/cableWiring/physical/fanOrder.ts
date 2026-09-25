import { NATURAL_ORDER, PAIR_IDS, PAIRS } from "../model";
import type { Conductor, PairId } from "../model";

/**
 * The attempt's starting arrangement: which pair lies in which row as the
 * cable leaves the jacket, top to bottom.
 *
 * The four pairs are shuffled, never the eight conductors: a pair's two wires
 * stay twisted together until the student untwists them. Only where the pairs
 * lie is drawn at random — which wires make up each pair, and the standard the
 * student wires to, are the same as ever.
 *
 * `random` is Math.random in the app; tests pass their own.
 */
export function startingPairOrder(random: () => number = Math.random): PairId[] {
  const order: PairId[] = [...PAIR_IDS];

  // Fisher–Yates.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
}

/**
 * The row the conductors fall into when this attempt's last pair is untwisted:
 * each pair's two wires side by side, the pairs in the order they left the
 * jacket (see pairOrderOf, which reads the pair order back out of it).
 *
 * Drawn once per attempt, when the bench mounts, and handed to the model as
 * the scenario's `fanOrder`, so every apply() and dry run for the attempt
 * agrees on it. No such row is ever a wiring standard: both standards split a
 * pair across pins 3 and 6.
 */
export function startingFanOrder(random: () => number = Math.random): Conductor[] {
  return startingPairOrder(random).flatMap((pair) =>
    NATURAL_ORDER.filter((conductor) => (PAIRS[pair] as readonly Conductor[]).includes(conductor)),
  );
}
