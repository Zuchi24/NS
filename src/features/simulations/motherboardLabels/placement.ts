/**
 * Where the name chips of a drag board are: a record of mark id → chip, the
 * same shape a typed board keeps and submits. A chip is in at most one slot;
 * one that is in none is back among the names.
 */
export type Placement = Record<string, string>;

/** Which mark a chip sits on, if any. */
export function slotOf(placement: Placement, chip: string): string | null {
  return Object.keys(placement).find((id) => placement[id] === chip) ?? null;
}

/**
 * Puts a chip on a mark. Moved from another mark, it swaps with whatever was
 * there, so a student can trade two chips over in one move; taken from the
 * names, it sends the chip it displaces back to them.
 */
export function placeChip(placement: Placement, chip: string, to: string): Placement {
  const from = slotOf(placement, chip);

  if (from === to) return placement;

  const next = { ...placement };
  const displaced = next[to];

  if (from !== null) delete next[from];

  next[to] = chip;

  if (displaced !== undefined && from !== null) next[from] = displaced;

  return next;
}

/** Takes the chip off a mark, back to the names. */
export function clearSlot(placement: Placement, id: string): Placement {
  if (!(id in placement)) return placement;

  const next = { ...placement };
  delete next[id];

  return next;
}

/** The chips on no mark, in the order they were offered. */
export function unplaced(choices: string[], placement: Placement): string[] {
  const placed = new Set(Object.values(placement));

  return choices.filter((chip) => !placed.has(chip));
}
