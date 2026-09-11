import type { PhysicalObjectives, PhysicalScenario } from "../integration/publicConfig";
import { MAX_STRIP_PASS, MAX_UNTWIST, MIN_BODY, MIN_WORK } from "../model";
import type {
  Action,
  CableState,
  Conductor,
  EndId,
  EndpointId,
  InspectionCheck,
  PairId,
  Pattern,
  RejectReason,
  Scenario,
  SimEvent,
  Verdict,
} from "../model";

/**
 * Words for what the model says.
 *
 * The model decides; this file only puts its decisions into sentences. Nothing
 * here checks whether an action is allowed or works out a result — a refusal
 * arrives as a reason code from apply(), a success as its events, a test
 * result as the model's verdict — and each is looked up, never recomputed.
 */

export const CONDUCTOR_LABEL: Record<Conductor, string> = {
  "white-orange": "White/orange",
  orange: "Orange",
  "white-green": "White/green",
  green: "Green",
  "white-blue": "White/blue",
  blue: "Blue",
  "white-brown": "White/brown",
  brown: "Brown",
};

export const PAIR_LABEL: Record<PairId, string> = {
  orange: "orange",
  green: "green",
  blue: "blue",
  brown: "brown",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  incomplete: "Incomplete termination",
  short: "Short circuit",
  open: "Open circuit",
  miswired: "Miswired",
  "split-pair": "Split pair",
  straight: "Straight-through",
  crossover: "Crossover (T568A ↔ T568B)",
  "gigabit-crossover": "Gigabit crossover",
  rollover: "Rollover (reversed)",
};

/** What each verdict means, for a student reading the tester. Explains the model's verdict; never decides one. */
export const VERDICT_HELP: Record<Verdict, string> = {
  incomplete: "An end has no plug, or its plug isn't crimped, so nothing can be measured yet.",
  short: "Two conductors are touching each other.",
  open: "At least one conductor has no connection from end to end.",
  miswired: "Every pin connects, but some reach a different pin at the far end.",
  "split-pair": "Every pin reaches the same pin, but a signal pair is spread across two twisted pairs.",
  straight: "Every pin reaches the same pin at the far end.",
  crossover: "Pins 1 and 2 swap with pins 3 and 6 — the T568A-to-T568B pattern.",
  "gigabit-crossover": "All four pairs are swapped end to end.",
  rollover: "The order is reversed: pin 1 reaches pin 8, pin 2 reaches pin 7, and so on.",
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  straight: "straight-through",
  crossover: "crossover",
  "gigabit-crossover": "gigabit crossover",
  rollover: "rollover",
  miswired: "no recognised pattern",
};

/** An end named mid-sentence: "end A". */
export function endPhrase(end: EndId): string {
  return `end ${end}`;
}

export function endLabel(end: EndId): string {
  return `End ${end}`;
}

/**
 * How a port on this bench is named to the student: its label when the config
 * gives one ("PC-1"), the tester's own names otherwise. Display text only — the
 * endpoint's id stays what every connection is made and recorded by.
 */
export function endpointLabel(scenario: Pick<PhysicalScenario, "endpoints">, id: EndpointId): string {
  const endpoint = scenario.endpoints.find((candidate) => candidate.id === id);

  if (endpoint?.label) return endpoint.label;

  switch (endpoint?.kind) {
    case "tester-main":
      return "Tester MAIN";
    case "tester-remote":
      return "Tester REMOTE";
    default:
      return id;
  }
}

const INSPECTION_OBJECTIVE: Record<InspectionCheck, string> = {
  strain_relief: "the jacket gripped by the strain relief",
  untwist: `no more than ${MAX_UNTWIST} mm untwisted`,
  front: "every conductor reaching the front of the plug",
  insulation: "no damaged insulation",
};

/**
 * The public objectives, one sentence each: the length budget, what will be
 * inspected, and which devices must link. Words for data the student is meant
 * to see — none of it is a check.
 */
export function objectiveLines(objectives: PhysicalObjectives, scenario: Pick<PhysicalScenario, "endpoints">): string[] {
  const lines: string[] = [];

  if (objectives.minLengthMm !== null) lines.push(`Keep at least ${objectives.minLengthMm} mm of cable, jacket to jacket.`);
  if (objectives.inspection.length > 0) {
    lines.push(`Both ends are inspected for ${objectives.inspection.map((check) => INSPECTION_OBJECTIVE[check]).join("; ")}.`);
  }
  if (objectives.link !== null) {
    lines.push(`${endpointLabel(scenario, objectives.link[0])} and ${endpointLabel(scenario, objectives.link[1])} must show a link.`);
  }

  return lines;
}

/** What doing this action is called, for "you can't … under a plug". */
const DOING: Record<Action["type"], string> = {
  cut: "cut",
  strip: "strip the jacket",
  untwist: "untwist the pairs",
  moveConductor: "rearrange the conductors",
  trim: "trim the conductors",
  insert: "fit another plug",
  push: "push the plug",
  withdraw: "pull the plug off",
  crimp: "crimp",
  connect: "plug in",
  disconnect: "unplug",
};

/**
 * Why the model refused, in the student's terms. Every reason has a sentence.
 *
 * The cable, when given, only adds the model's own numbers to the sentence —
 * how far the plug reaches — so a student knows what to change. It does not
 * decide anything; the refusal already happened.
 */
export function rejectionMessage(action: Action, reason: RejectReason, cable?: CableState): string {
  const end = endLabel(action.end);
  const phrase = endPhrase(action.end);

  switch (reason) {
    case "invalid-input":
      if (action.type === "strip") return `The stripper removes between 1 and ${MAX_STRIP_PASS} mm of jacket per pass.`;
      if (action.type === "moveConductor") return "There is no position there — the row has positions 1 to 8.";
      return "That isn't a setting this action accepts.";
    case "plug-present":
      return `${end} has a plug on it — you can't ${DOING[action.type]} under a plug.`;
    case "no-plug":
      return `${end} has no plug on it.`;
    case "plug-locked":
      return `The plug on ${phrase} is crimped and can't move. To redo this end, cut the plug off.`;
    case "plug-connected":
      return `${end} is plugged into a port — unplug it before you ${DOING[action.type]}.`;
    case "no-fan":
      return `Untwist all four pairs on ${phrase} so the conductors lie flat first.`;
    case "tray-empty":
      return "There are no plugs left in the tray.";
    case "too-short-to-grip":
      return `There isn't enough conductor to grip — a pair needs at least ${MIN_WORK} mm exposed before it can be untwisted.`;
    case "already-untwisted":
      return "That pair is already untwisted.";
    case "position-not-on-jacket":
      return "That position is on bare conductor, not jacket. To shorten the conductors, use Trim.";
    case "cut-through-plug": {
      const plug = cable?.ends[action.end].plug;

      return plug && plug.jacketInMm > 0
        ? `The cutters can't go through the plug — it covers the first ${plug.jacketInMm} mm behind the jacket edge. Cut at least ${plug.jacketInMm} mm back.`
        : "The cutters can't go through the plug — cut further behind it.";
    }
    case "nothing-to-cut":
      return `There's nothing to cut there — ${phrase} is already a clean cut end.`;
    case "insufficient-cable":
      return `That would leave less than ${MIN_BODY} mm of jacketed cable between the ends.`;
    case "no-change":
      return noChange(action);
    case "already-crimped":
      return `The plug on ${phrase} is already fully crimped.`;
    case "already-connected":
      return `${end} is already plugged in — unplug it first.`;
    case "not-connected":
      return `${end} isn't plugged into anything.`;
    case "unknown-endpoint":
      return "That port isn't on this bench.";
    case "endpoint-busy":
      return "The other end is already in that port.";
  }
}

function noChange(action: Action): string {
  switch (action.type) {
    case "moveConductor":
      return "That conductor is already in that position.";
    case "trim":
      return "The conductors are already no longer than that — nothing to trim.";
    case "push":
      return "The plug is already at least that far on.";
    case "crimp":
      return "It is already half-crimped. Squeeze fully to finish the crimp.";
    default:
      return "Nothing would change.";
  }
}

/** What happened, one sentence per event, in the order the model reported them. */
export function eventsMessage(events: SimEvent[], scenario: Scenario): string {
  return events.map((event) => eventSentence(event, scenario)).join(" ");
}

function eventSentence(event: SimEvent, scenario: Scenario): string {
  const phrase = endPhrase(event.end);

  switch (event.type) {
    case "cut":
      return `Cut ${phrase} ${event.toJ - event.fromJ} mm behind its jacket edge — it is now a clean cut end.`;
    case "plugReleased":
      return "The uncrimped plug slid off and went back in the tray.";
    case "plugDestroyed":
      return "The crimped plug went with the offcut.";
    case "stripped":
      return event.nicked
        ? `Stripped ${event.amountMm} mm of jacket from ${phrase}. The blade scored the insulation underneath.`
        : `Stripped ${event.amountMm} mm of jacket from ${phrase}.`;
    case "untwisted":
      return `Untwisted the ${PAIR_LABEL[event.pair]} pair.`;
    case "fanned":
      return "All four pairs are untwisted — the conductors lie flat in the order they left the jacket.";
    case "conductorMoved":
      return `Moved ${CONDUCTOR_LABEL[event.conductor]} from position ${event.fromIndex + 1} to position ${event.toIndex + 1}.`;
    case "trimmed":
      return event.uneven
        ? `Trimmed ${phrase} to ${event.leaveMm} mm — the pairs were still bunched, so the cut came out uneven.`
        : `Trimmed ${phrase} flush at ${event.leaveMm} mm.`;
    case "inserted":
      return `Fitted a plug to ${phrase}, ${orientationWords(event.orientation)}; ${jacketWords(event.jacketInMm)}.`;
    case "pushed":
      return `Pushed the plug further on — ${jacketWords(event.jacketInMm)}.`;
    case "withdrawn":
      return `Pulled the plug off ${phrase} and put it back in the tray.`;
    case "crimped":
      return event.squeeze === "full"
        ? `Crimped ${phrase} fully.`
        : `Half-squeezed the crimper on ${phrase} — the crimp is only partial.`;
    case "connected":
      return `Plugged ${phrase} into ${endpointLabel(scenario, event.endpoint)}.`;
    case "disconnected":
      return `Unplugged ${phrase}.`;
  }
}

export function orientationWords(orientation: "contacts-up" | "contacts-down"): string {
  return orientation === "contacts-up" ? "contacts facing up" : "contacts facing down (clip up)";
}

/** The model's jacket-in value, said the way it looks. */
export function jacketWords(jacketInMm: number): string {
  if (jacketInMm > 0) return `jacket ${jacketInMm} mm inside the plug`;
  if (jacketInMm === 0) return "jacket level with the back of the plug";

  return `jacket ${-jacketInMm} mm short of the plug`;
}
