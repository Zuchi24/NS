import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
import { useChallengeAttempt } from "@/features/content/useChallengeAttempt";
import { LabelingBoard } from "@/features/simulations/motherboardLabels/LabelingBoard";
import {
  parseMotherboardLabelsConfig,
  practiceSetup,
} from "@/features/simulations/motherboardLabels/config";
import { useWideLayout } from "@/features/simulations/motherboardLabels/useWideLayout";

/**
 * Label the Motherboard: type the name of each numbered part of a drawn board.
 *
 * Opened from the catalogue with `?attempt=`, the challenge decides which parts
 * are marked and the server grades what was typed — the page never knows the
 * answers, so it never judges them. On its own it is free practice on the
 * whole board, with nothing to submit.
 */
export function MotherboardLabelsChallenge() {
  const navigate = useNavigate();
  const attempt = useChallengeAttempt();
  const wide = useWideLayout();

  const setup = useMemo(
    () => (attempt.isGraded ? parseMotherboardLabelsConfig(attempt.challenge?.config) : practiceSetup()),
    [attempt.isGraded, attempt.challenge],
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});

  // A retry is a fresh attempt, and starts from empty boxes.
  useEffect(() => {
    setAnswers({});
  }, [attempt.attemptId]);

  const submit = () => {
    if (!setup) return;

    // Every marked part is sent, a blank box as blank: it is graded as unanswered.
    const labels = Object.fromEntries(setup.regions.map((region) => [region.id, answers[region.id] ?? ""]));

    void attempt.submit({ labels });
  };

  const unavailable = attempt.isGraded && !attempt.loading && attempt.challenge !== null && setup === null;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Roboto, sans-serif" }}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/challenges")}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Challenges
          </Button>

          <h1 className="mb-1 text-2xl font-bold text-gray-900">
            {attempt.challenge?.title ?? "Label the Motherboard"}
          </h1>
          <p className="text-sm text-gray-600">
            {attempt.challenge?.description ??
              "Identify the marked parts of a motherboard by typing the name of each one."}
          </p>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {attempt.loading && <p className="text-sm text-gray-500">Loading the challenge…</p>}

            {unavailable && (
              <p role="alert" className="text-sm text-orange-700">
                This challenge could not be drawn. Go back to the challenges and try again later.
              </p>
            )}

            {!attempt.loading && setup && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <p className="mb-4 text-sm text-gray-600">
                  Type the name of each numbered part in its box.
                  {!attempt.isGraded &&
                    " This is practice: open the challenge from the catalogue to have your labels checked."}
                </p>

                <LabelingBoard
                  key={attempt.attemptId ?? "practice"}
                  setup={setup}
                  answers={answers}
                  onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                  layout={wide ? "wide" : "narrow"}
                  disabled={attempt.submitting}
                />

                <div className="mt-6 flex justify-end">
                  <Button type="submit" disabled={!attempt.isGraded || attempt.submitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {attempt.submitting ? "Checking…" : "Check Labels"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <SubmissionResultsDialog
        results={attempt.results}
        passed={attempt.passed}
        onClose={attempt.dismissResults}
        onTryAgain={attempt.tryAgain}
        retrying={attempt.retrying}
        onBack={() => navigate("/challenges")}
      />
    </div>
  );
}
