import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { fetchAttempt, startAttempt, submitSimulation } from "./contentService";
import type { Challenge, RequirementResult } from "./types";

/**
 * Runs a bespoke simulator as graded work.
 *
 * The PC build and the cable terminator are standalone pages: reachable on
 * their own for practice, and opened with `?attempt=<id>` when a student starts
 * them from the catalogue. This hook is the difference between the two — with
 * an attempt it loads the challenge, submits the finished work and reports
 * back; without one the page is free practice on its own defaults.
 *
 * The challenge is the source of truth for what the page shows: its title, its
 * instructions, and the setup its simulator needs.
 */
export function useChallengeAttempt() {
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptId = Number(searchParams.get("attempt")) || null;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(attemptId !== null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [results, setResults] = useState<RequirementResult[] | null>(null);
  const [passed, setPassed] = useState(false);

  // Read the challenge behind the attempt, so the page can describe itself.
  useEffect(() => {
    if (attemptId === null) {
      setChallenge(null);
      setLoading(false);

      return;
    }

    let live = true;
    setLoading(true);
    setResults(null);

    fetchAttempt(attemptId)
      .then((loaded) => {
        if (live) setChallenge(loaded.challenge);
      })
      .catch((error: unknown) => {
        if (!live) return;
        toast.error(
          error instanceof Error ? error.message : "Could not open this attempt",
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [attemptId]);

  /** Send the finished work for grading. A no-op in practice mode. */
  const submit = useCallback(
    async (submission: unknown) => {
      if (attemptId === null) return;

      setSubmitting(true);

      try {
        const marked = await submitSimulation(attemptId, submission);

        setPassed(marked.passed);
        setResults(marked.results ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not submit your work",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId],
  );

  /**
   * A submitted attempt cannot be submitted again, so a retry opens a fresh
   * one and swaps it into the URL — the page resets around it.
   */
  const tryAgain = useCallback(async () => {
    if (!challenge) return;

    setRetrying(true);

    try {
      const next = await startAttempt(challenge.id);

      setResults(null);
      setSearchParams({ attempt: String(next.id) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start a new attempt",
      );
    } finally {
      setRetrying(false);
    }
  }, [challenge, setSearchParams]);

  return {
    attemptId,
    /** The challenge being attempted, once loaded. Null in practice mode. */
    challenge,
    loading,
    /** True when this run counts: opened from the catalogue with an attempt. */
    isGraded: attemptId !== null,
    submit,
    submitting,
    tryAgain,
    retrying,
    results,
    passed,
    dismissResults: useCallback(() => setResults(null), []),
  };
}
