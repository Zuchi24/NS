import { useEffect, useRef, useState } from "react";

/** How often the visible countdown is brought up to date. */
export const COUNTDOWN_TICK_MS = 250;

/**
 * A timed question's countdown, from the moment the component using it mounts.
 *
 * Deadline-based rather than counted down: the deadline is fixed once, when
 * the question first becomes active, and what is left is always the deadline
 * minus the wall clock. A tick is only a moment to look at the clock again, so
 * a browser that runs intervals late — a background tab, a busy page — shows
 * the right time as soon as it looks, and a tab left for ten seconds comes
 * back ten seconds further on. Nothing pauses it.
 *
 * `onExpire` is called at most once, when the time runs out. Whatever the
 * caller does with it must be safe to call again anyway — see the settle guard
 * in AssessmentPage — because two things can end a question at the same time.
 *
 * Mount one per question (key it by the question), which is what gives each
 * question a fresh deadline: the deadline is kept in a ref, so a re-render
 * never moves it, and React's development double-mount keeps it too rather
 * than starting the clock twice.
 *
 * Returns the milliseconds left, or null for an untimed question.
 *
 * This is an interaction constraint, not a tamper-proof exam clock: the server
 * never learns when a question was shown. Reloading the page starts the
 * assessment again from its start screen.
 */
export function useQuestionCountdown(
  limitSeconds: number | null,
  onExpire: () => void,
): number | null {
  const limitMs = limitSeconds === null ? null : limitSeconds * 1000;
  const [remainingMs, setRemainingMs] = useState<number | null>(limitMs);

  const deadline = useRef<number | null>(null);
  const expired = useRef(false);

  // Read at the moment the time runs out, so a caller passing a new function
  // every render neither restarts the clock nor calls an old one.
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (limitMs === null) return;

    // Once per question: the first time this runs is when it became active.
    if (deadline.current === null) deadline.current = Date.now() + limitMs;

    const look = () => {
      const left = Math.max(0, deadline.current! - Date.now());
      setRemainingMs(left);

      if (left === 0 && !expired.current) {
        expired.current = true;
        window.clearInterval(interval);
        expire.current();
      }
    };

    const interval = window.setInterval(look, COUNTDOWN_TICK_MS);
    look();

    return () => window.clearInterval(interval);
  }, [limitMs]);

  return limitMs === null ? null : remainingMs;
}

/** What is left, as the countdown shows it: whole seconds, rounded up, as m:ss. */
export function formatCountdown(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
