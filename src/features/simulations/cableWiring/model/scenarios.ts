import { T568B } from "./constants";
import { makeEnd, rawEnd } from "./geometry";
import type { PracticeScenario } from "./types";

/**
 * S1 — the practice bench, and the one scenario the frontend holds itself.
 *
 * A student who opens the bench without an attempt gets this. Its answer is
 * no secret — the objective names the standard — so holding the whole of it
 * here, requirements included, gives nothing away.
 *
 * End B arrives already terminated to T568B, as a factory patch end would:
 * jacket edge 12 mm in, tips at the original face (12 mm exposed), seated 9 mm
 * and fully crimped. End A is raw, and is the student's to make.
 *
 * `require` implies the requirement list TERM, CONT, PAIRS, END_A, END_B —
 * TERM, CONT and PAIRS every rule carries, END_A/END_B from `ends`.
 */
export const S1_PRACTICE: PracticeScenario = {
  id: "s1-straight-through",
  title: "Terminate a straight-through cable",
  difficulty: "beginner",
  startLengthMm: 1000,
  plugs: 4,
  initialEnds: {
    A: rawEnd(0),
    B: makeEnd({
      jacketEdgeMm: 12,
      tipMm: 0,
      fan: T568B,
      plug: { orientation: "contacts-up", jacketInMm: 9, crimp: "full" },
    }),
  },
  endpoints: [
    { id: "tester-main", kind: "tester-main" },
    { id: "tester-remote", kind: "tester-remote" },
  ],
  require: {
    ends: { A: "T568B", B: "T568B" },
    cable: null,
    minLengthMm: null,
    inspection: [],
    link: null,
  },
};
