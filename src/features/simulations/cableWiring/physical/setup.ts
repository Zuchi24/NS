import type { Difficulty } from "@/features/content/types";

import { S1_PRACTICE } from "../model";
import type { PhysicalChallengeConfig } from "../integration/publicConfig";

/**
 * Everything the bench is given: a physical challenge's public config, as
 * parsePhysicalChallengeConfig() reads it — the scenario, the objectives the
 * student is told, and any beginner help — plus the challenge's own title,
 * difficulty and description.
 *
 * None of it is grading configuration. The bench never learns which standards
 * or cable a challenge is marked on; the server keeps those, and marks the
 * cable/1 record the bench hands in.
 */
export interface BenchSetup extends PhysicalChallengeConfig {
  title: string;
  difficulty: Difficulty;
  /** The challenge's description, shown as its objective. Authored text, not derived from a rule. */
  description: string | null;
}

/**
 * The practice bench: S1 as a student opens it with no attempt. Its physical
 * facts are the model's S1; the rest is S1's public side, exactly as the
 * contract's S1 public config gives it — no length target, no inspection, no
 * link, and the T568B reference card. The description names the standard, as
 * S1's objective does (contract §9).
 */
export const PRACTICE_BENCH: BenchSetup = {
  scenario: {
    id: S1_PRACTICE.id,
    startLengthMm: S1_PRACTICE.startLengthMm,
    plugs: S1_PRACTICE.plugs,
    initialEnds: S1_PRACTICE.initialEnds,
    endpoints: S1_PRACTICE.endpoints,
  },
  title: S1_PRACTICE.title,
  difficulty: S1_PRACTICE.difficulty,
  description: "Make a working cable: end A wired to T568B, end B wired to T568B.",
  objectives: { minLengthMm: null, inspection: [], link: null },
  assist: { reference: { A: "T568B", B: "T568B" } },
};
