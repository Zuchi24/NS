export type AchievementType =
  | "challenge_count"
  | "roadmap_complete"
  | "first_try";

export interface Achievement {
  id: number;
  /** Stable slug the seeder keys on — safe to branch on for artwork. */
  key: string;
  title: string;
  description: string | null;
  /** Icon name the server suggests, e.g. "flag" or "star". */
  icon: string | null;
  type: AchievementType;
  /** What the student has to do to unlock it, in a sentence. */
  requirement: string;
  /** How far along they are, in the units the achievement counts in. */
  progress: { current: number; target: number };
  /** Null while it is still locked. */
  earnedAt: string | null;
}
