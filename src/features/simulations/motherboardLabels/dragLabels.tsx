import { useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { X } from "lucide-react";

/**
 * The pieces of a drag board: name chips, the bank they start in, and the
 * slot beside each marked part they are dropped on.
 *
 * Dragging is one way to place a chip, not the only one. Every chip and slot
 * is a button: pick a chip up with a click, tap or Enter, then put it down on
 * a slot the same way. That is what a keyboard, a screen reader and a phone —
 * where the HTML5 drag backend does nothing — all use, and it is the same
 * move the drag makes.
 */

const CHIP = "motherboard-label-chip";

interface ChipItem {
  chip: string;
}

const chipClass =
  "rounded-md border px-2.5 py-1.5 text-left text-sm font-medium leading-tight shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60";

/** A name on offer. Dragged, or picked up with a click and put down on a slot. */
function NameChip({
  name,
  held,
  onPick,
  disabled,
}: {
  name: string;
  held: boolean;
  onPick: (chip: string) => void;
  disabled: boolean;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CHIP,
      item: { chip: name } satisfies ChipItem,
      canDrag: !disabled,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [name, disabled],
  );

  // Handed the node itself, in the commit phase — see DraggableDevice.
  const attach = useCallback(
    (node: HTMLButtonElement | null) => {
      drag(node);
    },
    [drag],
  );

  return (
    <button
      ref={attach}
      type="button"
      data-chip={name}
      aria-pressed={held}
      onClick={() => onPick(name)}
      disabled={disabled}
      className={`${chipClass} cursor-grab ${
        held
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 bg-white text-gray-900 hover:border-blue-400 hover:bg-blue-50"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {name}
    </button>
  );
}

/**
 * The names not yet on the board. Also where a chip goes back to: drop one
 * here, or take it off its slot with the slot's clear button.
 */
export function ChipBank({
  chips,
  held,
  onPick,
  onReturn,
  disabled,
}: {
  chips: string[];
  held: string | null;
  onPick: (chip: string) => void;
  onReturn: (chip: string) => void;
  disabled: boolean;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: CHIP,
      drop: (item: ChipItem) => onReturn(item.chip),
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [onReturn],
  );

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      drop(node);
    },
    [drop],
  );

  return (
    <div
      ref={attach}
      role="group"
      aria-label="Names to place"
      data-chip-bank=""
      className={`flex min-h-[3.25rem] flex-wrap gap-2 rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
      }`}
    >
      {chips.length === 0 ? (
        <p className="self-center text-sm text-gray-500">Every name is on the board.</p>
      ) : (
        chips.map((chip) => (
          <NameChip key={chip} name={chip} held={held === chip} onPick={onPick} disabled={disabled} />
        ))
      )}
    </div>
  );
}

/**
 * The slot beside a marked part: empty, or holding the chip put on it. A held
 * chip is put down on it with a click; a chip already on it can be picked up
 * again the same way, dragged to another slot, or cleared back to the names.
 */
export function DropSlot({
  id,
  number,
  chip,
  held,
  onPlace,
  onPick,
  onClear,
  disabled,
  compact = false,
}: {
  id: string;
  number: number;
  chip: string | undefined;
  held: string | null;
  onPlace: (chip: string, id: string) => void;
  onPick: (chip: string) => void;
  onClear: (id: string) => void;
  disabled: boolean;
  /** Squeezed into a box beside the board rather than a row of a list. */
  compact?: boolean;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: CHIP,
      canDrop: () => !disabled,
      drop: (item: ChipItem) => onPlace(item.chip, id),
      collect: (monitor) => ({ isOver: monitor.isOver() && monitor.canDrop() }),
    }),
    [onPlace, id, disabled],
  );

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CHIP,
      item: { chip: chip ?? "" } satisfies ChipItem,
      canDrag: chip !== undefined && !disabled,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [chip, disabled],
  );

  const attach = useCallback(
    (node: HTMLButtonElement | null) => {
      drop(node);
      drag(node);
    },
    [drop, drag],
  );

  const activate = () => {
    if (held !== null) onPlace(held, id);
    else if (chip !== undefined) onPick(chip);
  };

  const size = compact ? "min-h-0 px-1.5 py-1 text-xs" : "min-h-[2.5rem] px-3 py-2 text-sm";

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-1">
      <button
        ref={attach}
        type="button"
        data-mark={id}
        data-drop-slot={id}
        aria-label={chip === undefined ? `Component ${number}, empty` : `Component ${number}: ${chip}`}
        aria-describedby={`label-${id}-where`}
        onClick={activate}
        disabled={disabled}
        className={`${size} min-w-0 flex-1 rounded-md border text-left font-medium leading-tight shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed ${
          isOver
            ? "border-blue-500 bg-blue-50"
            : chip !== undefined
              ? `border-blue-300 bg-blue-50 text-blue-900 ${held === chip ? "ring-2 ring-blue-500" : ""}`
              : held !== null
                ? "border-dashed border-blue-400 bg-white text-gray-400"
                : "border-dashed border-gray-300 bg-white text-gray-400"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <span className="line-clamp-2 break-words">{chip ?? "Drop a name here"}</span>
      </button>

      {chip !== undefined && (
        <button
          type="button"
          aria-label={`Take ${chip} off Component ${number}`}
          onClick={() => onClear(id)}
          disabled={disabled}
          className="flex flex-shrink-0 items-center rounded-md px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
