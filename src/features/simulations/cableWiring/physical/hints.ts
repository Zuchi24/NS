import { END_IDS, MIN_WORK, PAIR_IDS, maxExposed, minExposed } from "../model";
import type { CableState, EndId } from "../model";
import { endPhrase } from "./messages";
import type { BenchSetup } from "./setup";
import type { ToolId } from "./tools";

/**
 * Beginner hints: where the work has got to, and what usually comes next.
 *
 * Read-only and deliberately shallow. A hint looks at how far the physical
 * work has progressed — stripped, untwisted, fanned, plugged, crimped — and
 * never at whether it is *right*: it does not check the wire order, the
 * lengths or the test result. That judgment belongs to the tester, the
 * inspection and, in the end, the server.
 *
 * The colour order it names comes from the challenge's beginner help
 * (`assist.reference`), and only from there; without that help it names none.
 */
export interface Hint {
  end: EndId | null;
  text: string;
  tools: ToolId[];
}

export function beginnerHint(state: CableState, setup: Pick<BenchSetup, "difficulty" | "assist">): Hint | null {
  if (setup.difficulty !== "beginner") return null;

  const working = END_IDS.find((id) => state.ends[id].plug?.crimp !== "full");

  if (working === undefined) {
    return {
      end: null,
      text:
        "Both ends are crimped. Plug one end into the tester MAIN and the other into REMOTE, press TEST, and read the wire map before you hand in.",
      tools: ["connect"],
    };
  }

  const end = state.ends[working];
  const name = endPhrase(working);
  const target = setup.assist?.reference[working] ?? "the objective's";

  if (end.plug !== null) {
    return end.plug.crimp === "partial"
      ? { end: working, text: `The crimp on ${name} is only partial. Squeeze the crimper fully.`, tools: ["crimp"] }
      : {
          end: working,
          text: `A plug is on ${name}. Look at the plug diagram and the inspection panel — conductors at the contacts, jacket under the strain relief — then crimp. You can still pull it off if it's wrong.`,
          tools: ["crimp", "withdraw"],
        };
  }

  if (end.fan !== null) {
    return {
      end: working,
      text: `Arrange the conductors on ${name} into ${target} order, trim them short and even, then pick up a plug and insert the cable.`,
      tools: ["arrange", "trim", "insert"],
    };
  }

  const untwisted = PAIR_IDS.filter((pair) => end.untwisted[pair]).length;

  if (minExposed(end) >= MIN_WORK) {
    return {
      end: working,
      text: `Untwist each pair on ${name} (${untwisted} of 4 done).`,
      tools: ["untwist"],
    };
  }

  return maxExposed(end) === 0
    ? {
        end: working,
        text: `Strip the jacket off ${name}. A pair needs at least ${MIN_WORK} mm of exposed conductor before you can untwist it.`,
        tools: ["strip"],
      }
    : {
        end: working,
        text: `There isn't enough conductor on ${name} to untwist. Strip further back, or cut the end off and start it again.`,
        tools: ["strip", "cut"],
      };
}
