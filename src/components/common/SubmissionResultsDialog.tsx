import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RequirementResult } from "@/features/content/types";

/**
 * What the server made of a submission, requirement by requirement.
 *
 * Shared by every simulator — the canvas, the PC build, the cable terminator —
 * because they all grade to the same shape and a student should not have to
 * learn three ways of being told the same thing.
 */
export function SubmissionResultsDialog({
  results,
  passed,
  onClose,
  onTryAgain,
  retrying = false,
  onBack,
  backLabel = "Back to Challenges",
}: {
  /** Null while there is nothing to show; the dialog is closed. */
  results: RequirementResult[] | null;
  passed: boolean;
  onClose: () => void;
  /** Offered only on a failed attempt, and only where a retry makes sense. */
  onTryAgain?: () => void;
  retrying?: boolean;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <Dialog
      open={results !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {passed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Challenge passed
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-orange-500" />
                Not quite yet
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          {passed
            ? "Every requirement is met. Nice work."
            : "Your work is saved. Here is what the challenge asked for:"}
        </p>

        {/* Every requirement, met or not — a student should see the whole
            list, not only their mistakes. */}
        <ul className="space-y-2 mt-2 max-h-64 overflow-y-auto">
          {results?.map((result, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                result.passed
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-orange-200 bg-orange-50 text-orange-900"
              }`}
            >
              {result.passed ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
              )}
              <span>{result.requirement}</span>
            </li>
          ))}

          {results?.length === 0 && (
            <li className="text-sm text-gray-500">
              This challenge has no set requirements.
            </li>
          )}
        </ul>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onBack}>
            {backLabel}
          </Button>

          {!passed && onTryAgain && (
            <Button onClick={onTryAgain} disabled={retrying}>
              {retrying ? "Starting…" : "Try Again"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
