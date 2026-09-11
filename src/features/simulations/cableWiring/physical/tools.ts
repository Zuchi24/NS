/**
 * The bench's tools. Picking one only changes which controls are showing; the
 * physical work is always an action sent to the model.
 */
export type ToolId =
  | "cut"
  | "strip"
  | "untwist"
  | "arrange"
  | "trim"
  | "insert"
  | "withdraw"
  | "crimp"
  | "connect";

export const TOOLS: { id: ToolId; label: string }[] = [
  { id: "cut", label: "Cut" },
  { id: "strip", label: "Strip" },
  { id: "untwist", label: "Untwist" },
  { id: "arrange", label: "Arrange" },
  { id: "trim", label: "Trim" },
  { id: "insert", label: "Insert" },
  { id: "withdraw", label: "Withdraw" },
  { id: "crimp", label: "Crimp" },
  { id: "connect", label: "Connect" },
];
