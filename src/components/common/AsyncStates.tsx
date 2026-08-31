import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown while a page's first request is in flight. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/**
 * Shown when a request fails. Says what went wrong and offers the one action
 * that can help, rather than a bare "error".
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry: () => void;
  /** Override when the recovery is going somewhere else, not retrying. */
  retryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm text-gray-700 max-w-md">{message}</p>
      <Button variant="outline" onClick={onRetry} className="mt-1">
        {retryLabel}
      </Button>
    </div>
  );
}

/** Shown when a request succeeds but there is nothing to show yet. */
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 max-w-md">{description}</p>
    </div>
  );
}
