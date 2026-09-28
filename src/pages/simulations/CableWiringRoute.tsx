import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/common/AsyncStates";
import { SubmissionResultsDialog } from "@/components/common/SubmissionResultsDialog";
import { Button } from "@/components/ui/button";
import { useChallengeAttempt } from "@/features/content/useChallengeAttempt";
import {
  isPhysicalConfig,
  parsePhysicalChallengeConfig,
} from "@/features/simulations/cableWiring/integration/publicConfig";
import type { CableRecord } from "@/features/simulations/cableWiring/model";

/**
 * Which cable bench /challenge/cable-wiring opens.
 *
 * There are two, and the challenge decides between them. A challenge graded on
 * the physical `rj45_cable` rule is handed the public configuration of the
 * cable contract's §8 — the scenario, the objectives and any beginner help —
 * and is worked at the physical bench. Everything else is the legacy
 * `rj45_order` page, which is given the standard and cable type it has always
 * had and is unchanged by any of this.
 *
 * The choice is the contract's own discriminator, asked of the config the
 * server sent: `isPhysicalConfig`. Nothing is decided here by title, by id or
 * by guesswork, and no second copy of the rule is written down — the parse that
 * follows is the same one the integration layer already owns.
 *
 * Practice — the page opened with no `?attempt=` — has no challenge and so no
 * rule, and stays where it has always been: the legacy bench on its own
 * defaults. Nothing about free practice changes here.
 *
 * Both benches are loaded on demand, so a physical challenge no longer fetches
 * react-dnd to draw a page that does not use it.
 *
 * Handing in is wired here too, and only here. The physical bench makes the
 * cable/1 record and hands it over; this page is what knows there is an attempt
 * behind it, and puts the record through the same useChallengeAttempt().submit
 * every other bespoke simulator uses — the cable contract's §2 envelope is that
 * function's envelope already, so nothing new is sent and nothing new is read
 * back. The legacy bench keeps submitting for itself, exactly as before.
 */

const PhysicalBench = lazy(async () => ({
  default: (await import("@/features/simulations/cableWiring/physical/PhysicalCableChallenge"))
    .PhysicalCableChallenge,
}));

const LegacyBench = lazy(async () => ({
  default: (await import("./CableWiringChallenge")).CableWiringChallenge,
}));

export function CableWiringRoute() {
  const navigate = useNavigate();
  const attempt = useChallengeAttempt();
  const { challenge, loading } = attempt;

  /*
   * Which attempt has already been handed in.
   *
   * The attempt id rather than a flag, so that a retry — which swaps a fresh
   * attempt into the URL — opens the bench again without anything to reset.
   * It is latched off the marked results, which useChallengeAttempt sets only
   * when the server has actually taken the work: a submission that failed
   * leaves it alone, and the student can hand in again.
   */
  const [handedIn, setHandedIn] = useState<number | null>(null);
  const { attemptId, results, submit: submitAttempt } = attempt;

  useEffect(() => {
    if (results !== null && attemptId !== null) setHandedIn(attemptId);
  }, [results, attemptId]);

  const submitted = handedIn !== null && handedIn === attemptId;

  const submit = useCallback(
    (record: CableRecord) => {
      // The record is the submission — cable contract §2 is this function's
      // own envelope — so it goes through untouched and unread.
      void submitAttempt(record);
    },
    [submitAttempt],
  );

  if (loading) return <LoadingState label="Opening the cable bench…" />;

  const physical = challenge !== null && isPhysicalConfig(challenge.config);
  const parsed = physical ? parsePhysicalChallengeConfig(challenge.config) : null;

  return (
    <Suspense fallback={<LoadingState label="Opening the cable bench…" />}>
      {parsed === null ? (
        <LegacyBench />
      ) : parsed.ok ? (
        /*
         * The bench is given the challenge's public side and the challenge's
         * own words, and nothing else. It is never told what the cable is
         * marked on: the server keeps the private half of the rule and marks
         * the cable/1 record, which is why nothing about grading passes here.
         */
        <>
          {/*
            * The way back out, as every other simulator page has it. Here and
            * not in the bench: the bench knows nothing of the app's routes.
            */}
          <div className="bg-slate-100">
            <div className="mx-auto max-w-[1500px] px-4 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/challenges")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Challenges
              </Button>
            </div>
          </div>

          {/*
            * Keyed by the attempt, so a retry opens a new attempt on a new
            * cable rather than on the one that was just marked — the same
            * reset the legacy bench does when the attempt id changes.
            */}
          <PhysicalBench
            key={attemptId ?? "practice"}
            {...parsed.value}
            title={challenge!.title}
            difficulty={challenge!.difficulty}
            description={challenge!.description}
            handIn={{ submit, submitting: attempt.submitting, submitted }}
          />

          {/* The same marked-results dialog every other simulator shows. */}
          <SubmissionResultsDialog
            results={attempt.results}
            passed={attempt.passed}
            onClose={attempt.dismissResults}
            onTryAgain={attempt.tryAgain}
            retrying={attempt.retrying}
            onBack={() => navigate("/challenges")}
          />
        </>
      ) : (
        /*
         * The challenge says it is physical and its configuration is not. The
         * legacy page would draw the wrong bench from a config it cannot read,
         * so neither is opened: this is an authoring fault, and it is said
         * plainly rather than worked around.
         */
        <EmptyState
          title="This cable challenge cannot be opened"
          description="Its bench configuration is not the shape the simulator expects. Ask your instructor to check it."
        />
      )}
    </Suspense>
  );
}
