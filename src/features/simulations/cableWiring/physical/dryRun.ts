import { apply } from "../model";
import type { Action, CableState, RejectReason, Scenario, SimEvent } from "../model";

/**
 * Asking the model whether an action would work, without doing it.
 *
 * apply() is pure: given a state it returns a new one and never touches the
 * old. So a candidate action can be run through it and the result thrown
 * away, keeping only whether it was refused and why — and, when it was not,
 * what the model says would happen. Those events are the model's own numbers
 * (where a plug would seat, say), so a preview can show them rather than work
 * them out again.
 *
 * This is the only way the bench is allowed to know whether something is
 * legal. No component may carry its own test — not a minimum, not a maximum,
 * not "is there a plug in the way". The rules live in the model, and a gesture
 * that needs one asks here.
 */

export type DryRun = { ok: true; events: SimEvent[] } | { ok: false; reason: RejectReason };

export function dryRun(cable: CableState, action: Action, scenario: Scenario): DryRun {
  const result = apply(cable, action, scenario);

  return "rejected" in result ? { ok: false, reason: result.rejected } : { ok: true, events: result.events };
}
