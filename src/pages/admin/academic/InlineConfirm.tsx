import { Button } from "@/components/ui/button";

/**
 * A move waiting to be confirmed, said in full before it is made.
 *
 * Inline rather than a modal, as the achievement page confirms its moves: the
 * question sits next to the row it is about.
 */
export function InlineConfirm({
  question,
  detail,
  verb,
  destructive = false,
  busy,
  onConfirm,
  onCancel,
}: {
  question: string;
  detail: string;
  verb: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={question}
      className={`rounded-md border p-3 space-y-2 ${
        destructive ? "border-red-200 bg-red-50/60" : "border-brand-teal/30 bg-accent/60"
      }`}
    >
      <p className="text-xs text-gray-700">
        {question} {detail}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={busy}
          onClick={onConfirm}
        >
          {verb}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The server's own words for a refusal, or a fallback. */
export function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
