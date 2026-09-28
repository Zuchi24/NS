import { BOARDS, type BoardDefinition, type BoardRegion } from "./board";

/** How a student names the marked parts: typing each name, or dragging name chips onto them. */
export type LabelingMode = "type" | "drag";

/**
 * A labeling challenge ready to draw: its board, the marked regions in the
 * order they are numbered — marker 1 is the first, whatever its mark — and how
 * they are named. A drag board also carries its chips: every name on offer,
 * right and wrong, in the order the server sent them.
 */
export interface LabelingSetup {
  board: BoardDefinition;
  regions: BoardRegion[];
  mode: LabelingMode;
  choices: string[];
}

/** The longest name the server takes, typed or on a chip. */
export const MAX_LABEL_LENGTH = 64;

/**
 * Reads the config a `motherboard_labels` challenge is sent, field by field.
 *
 * Wire data is not trusted on a type's say-so: a board this page does not
 * have, a mark that board does not have, the same mark twice, a mode it does
 * not know, or a drag board without a chip for every mark is a challenge the
 * page cannot honestly draw, and comes back null rather than half-drawn.
 */
export function parseMotherboardLabelsConfig(config: unknown): LabelingSetup | null {
  if (typeof config !== "object" || config === null) return null;

  const { board: boardId, labels, mode = "type", choices } = config as {
    board?: unknown;
    labels?: unknown;
    mode?: unknown;
    choices?: unknown;
  };

  if (typeof boardId !== "string" || !Array.isArray(labels) || labels.length === 0) return null;
  if (mode !== "type" && mode !== "drag") return null;

  const board = BOARDS[boardId];

  if (!board) return null;

  const regions: BoardRegion[] = [];

  for (const label of labels) {
    const id = typeof label === "object" && label !== null ? (label as { id?: unknown }).id : undefined;
    const region = typeof id === "string" ? board.regions[id] : undefined;

    if (!region || regions.includes(region)) return null;

    regions.push(region);
  }

  if (mode === "type") return { board, regions, mode, choices: [] };

  const chips = parseChoices(choices);

  if (!chips || chips.length < regions.length) return null;

  return { board, regions, mode, choices: chips };
}

/** A drag board's chips: distinct, non-blank names the server would take. */
function parseChoices(choices: unknown): string[] | null {
  if (!Array.isArray(choices)) return null;

  const chips: string[] = [];

  for (const choice of choices) {
    if (typeof choice !== "string" || choice.trim() === "" || choice.length > MAX_LABEL_LENGTH) return null;
    if (chips.includes(choice)) return null;

    chips.push(choice);
  }

  return chips;
}

/** The parts free practice shows: the first board's ten larger parts. */
const PRACTICE_MARKS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"];

/**
 * What free practice shows, with no challenge behind it: the first board's
 * ten larger parts, typed on. Nothing is graded without a challenge, and with
 * no challenge there are no chips to hand out — the names are the server's.
 */
export function practiceSetup(): LabelingSetup {
  const board = BOARDS["atx-basic-v1"];

  return { board, regions: PRACTICE_MARKS.map((id) => board.regions[id]), mode: "type", choices: [] };
}
