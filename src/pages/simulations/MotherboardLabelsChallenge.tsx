import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ArrowLeft, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
import { useChallengeAttempt } from "@/features/content/useChallengeAttempt";
import { LabelingBoard, TypedField } from "@/features/simulations/motherboardLabels/LabelingBoard";
import { ChipBank, DropSlot } from "@/features/simulations/motherboardLabels/dragLabels";
import {
  parseMotherboardLabelsConfig,
  practiceSetup,
} from "@/features/simulations/motherboardLabels/config";
import {
  clearSlot,
  placeChip,
  slotOf,
  unplaced,
  type Placement,
} from "@/features/simulations/motherboardLabels/placement";
import { useWideLayout } from "@/features/simulations/motherboardLabels/useWideLayout";

/**
 * Label the Motherboard: name each numbered part of a drawn board, by typing
 * the name or by dropping a name chip on it, as the challenge says.
 *
 * Opened from the catalogue with `?attempt=`, the challenge decides which parts
 * are marked, how they are named, and the server grades the names — the page
 * never knows which name belongs where, so it never judges them. On its own it
 * is free practice on the board, typed on, with nothing to submit.
 *
 * Both modes keep the same record of mark → name and submit it the same way,
 * so a drag board is graded exactly as a typed one.
 */
export function MotherboardLabelsChallenge() {
  const navigate = useNavigate();
  const attempt = useChallengeAttempt();
  const wide = useWideLayout();

  const setup = useMemo(
    () => (attempt.isGraded ? parseMotherboardLabelsConfig(attempt.challenge?.config) : practiceSetup()),
    [attempt.isGraded, attempt.challenge],
  );

  const [answers, setAnswers] = useState<Placement>({});
  // The chip picked up to be put down with a click or tap; null when none is.
  const [held, setHeld] = useState<string | null>(null);
  // What the last move did, for a screen reader.
  const [announcement, setAnnouncement] = useState("");

  // A retry is a fresh attempt, and starts from an empty board.
  useEffect(() => {
    setAnswers({});
    setHeld(null);
    setAnnouncement("");
  }, [attempt.attemptId]);

  const number = useCallback(
    (id: string) => (setup ? setup.regions.findIndex((region) => region.id === id) + 1 : 0),
    [setup],
  );

  const type = useCallback((id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  }, []);

  const place = useCallback(
    (chip: string, id: string) => {
      setAnswers((current) => placeChip(current, chip, id));
      setHeld(null);
      setAnnouncement(`${chip} placed on Component ${number(id)}.`);
    },
    [number],
  );

  const clear = useCallback(
    (id: string) => {
      const chip = answers[id];

      setAnswers((current) => clearSlot(current, id));
      setHeld(null);
      if (chip !== undefined) setAnnouncement(`${chip} taken off Component ${number(id)}.`);
    },
    [answers, number],
  );

  // A chip dropped back among the names. One that never left them is left alone.
  const returnChip = useCallback(
    (chip: string) => {
      const id = slotOf(answers, chip);

      setHeld(null);
      if (id === null) return;

      setAnswers((current) => clearSlot(current, id));
      setAnnouncement(`${chip} is back with the names.`);
    },
    [answers],
  );

  // Picking up the chip already held puts it down again.
  const pick = useCallback(
    (chip: string) => {
      const next = held === chip ? null : chip;

      setHeld(next);
      setAnnouncement(next === null ? "" : `Picked up ${chip}. Choose a component to put it on.`);
    },
    [held],
  );

  // Escape puts a picked-up chip back down where it was.
  useEffect(() => {
    if (held === null) return;

    const release = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHeld(null);
    };

    window.addEventListener("keydown", release);

    return () => window.removeEventListener("keydown", release);
  }, [held]);

  const submit = () => {
    if (!setup) return;

    // Every marked part is sent, an empty one as blank: it is graded as unanswered.
    const labels = Object.fromEntries(setup.regions.map((region) => [region.id, answers[region.id] ?? ""]));

    void attempt.submit({ labels });
  };

  const unavailable = attempt.isGraded && !attempt.loading && attempt.challenge !== null && setup === null;
  const dragging = setup?.mode === "drag";
  const layout = wide ? "wide" : "narrow";

  const board = setup && (
    <>
      {dragging && (
        <div className="mb-4">
          <ChipBank
            chips={unplaced(setup.choices, answers)}
            held={held}
            onPick={pick}
            onReturn={returnChip}
            disabled={attempt.submitting}
          />
        </div>
      )}

      <LabelingBoard
        key={attempt.attemptId ?? "practice"}
        setup={setup}
        layout={layout}
        field={(region, n, where) =>
          dragging ? (
            <DropSlot
              id={region.id}
              number={n}
              chip={answers[region.id]}
              held={held}
              onPlace={place}
              onPick={pick}
              onClear={clear}
              disabled={attempt.submitting}
              compact={where === "wide"}
            />
          ) : (
            <TypedField
              id={region.id}
              number={n}
              value={answers[region.id] ?? ""}
              onChange={type}
              disabled={attempt.submitting}
              place={where}
            />
          )
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );

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
                  {dragging
                    ? "Drag each name onto the numbered part it belongs to, or select a name and then a part. Not every name is used."
                    : "Type the name of each numbered part in its box."}
                  {!attempt.isGraded &&
                    " This is practice: open the challenge from the catalogue to have your labels checked."}
                </p>

                {dragging ? <DndProvider backend={HTML5Backend}>{board}</DndProvider> : board}

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
