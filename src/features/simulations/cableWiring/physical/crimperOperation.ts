import type { ToolId } from "./tools";

/**
 * The bench has one hand tool for preparing the cable: an RJ45 crimping tool,
 * whose one body carries a cutting blade, a stripping blade and the crimp die.
 * Which of those a student is using when they pick it up is the operation they
 * have chosen in the toolbar — and only that: the choice is authoritative, and
 * where the crimper is put down never turns one operation into another.
 *
 * This only says which existing gesture taking the crimper starts. Each
 * gesture — and the action it sends, and the model that decides it — is the
 * same one it always was.
 */
export type CrimperOperation =
  /** Through the whole cable, jacket and all: the `cut` action. */
  | "cut"
  /** Jacket off the end: the `strip` action, through the slot chosen in the strip controls. */
  | "strip"
  /** Square the bare conductors off: the `trim` action. */
  | "trim"
  /** Close the die on a fitted plug: the `crimp` action. */
  | "crimp";

/**
 * The crimper operation a toolbar choice puts in the hand, or null when the
 * choice is not one the crimper does (untwisting, arranging, fitting a plug,
 * connecting): those are done with the hands, the plug and the leads.
 */
export function crimperOperationFor(tool: ToolId): CrimperOperation | null {
  switch (tool) {
    case "cut":
    case "strip":
    case "trim":
    case "crimp":
      return tool;
    default:
      return null;
  }
}

/** The word the shelf shows under the crimper for each operation. */
export const CRIMPER_OPERATION_LABEL: Record<CrimperOperation, string> = {
  cut: "cut cable",
  strip: "strip",
  trim: "trim wires",
  crimp: "crimp",
};
