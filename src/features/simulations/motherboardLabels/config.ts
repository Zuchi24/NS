import { BOARDS, type BoardDefinition, type BoardRegion } from "./board";

/**
 * A labeling challenge ready to draw: its board, and the marked regions in the
 * order they are numbered — marker 1 is the first, whatever its mark.
 */
export interface LabelingSetup {
  board: BoardDefinition;
  regions: BoardRegion[];
}

/**
 * Reads the config a `motherboard_labels` challenge is sent, field by field.
 *
 * Wire data is not trusted on a type's say-so: a board this page does not
 * have, a mark that board does not have, or the same mark twice is a challenge
 * the page cannot honestly draw, and comes back null rather than half-drawn.
 */
export function parseMotherboardLabelsConfig(config: unknown): LabelingSetup | null {
  if (typeof config !== "object" || config === null) return null;

  const { board: boardId, labels } = config as { board?: unknown; labels?: unknown };

  if (typeof boardId !== "string" || !Array.isArray(labels) || labels.length === 0) return null;

  const board = BOARDS[boardId];

  if (!board) return null;

  const regions: BoardRegion[] = [];

  for (const label of labels) {
    const id = typeof label === "object" && label !== null ? (label as { id?: unknown }).id : undefined;
    const region = typeof id === "string" ? board.regions[id] : undefined;

    if (!region || regions.includes(region)) return null;

    regions.push(region);
  }

  return { board, regions };
}

/**
 * What free practice shows, with no challenge behind it: every marked part of
 * the first board. Nothing is graded without a challenge.
 */
export function practiceSetup(): LabelingSetup {
  const board = BOARDS["atx-basic-v1"];

  return { board, regions: Object.values(board.regions) };
}
