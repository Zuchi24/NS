/** Laravel's paginated envelope. */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type TopicStatus = "locked" | "unlocked" | "in_progress" | "completed";

/** Where one student stands on one topic, as the server works it out. */
export interface TopicProgress {
  status: TopicStatus;
  /** Share of the topic's required challenges passed, 0-100. */
  percent: number;
  isUnlocked: boolean;
  completedAt: string | null;
}

export interface Topic {
  id: number;
  roadmapId: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  order: number;
  /** Present when the topic was loaded with its counts. */
  challengesCount: number | null;
  /**
   * The student's own standing. Null when the topic was loaded without it —
   * never derive it on the client, the server owns the unlock rules.
   */
  progress: TopicProgress | null;
}

export interface Roadmap {
  id: number;
  title: string;
  description: string;
  order: number;
  /**
   * Whether students can see it yet.
   *
   * Only ever false in a staff response: the API gives students published
   * roadmaps and nothing else, so a client never has to filter on this. It is
   * here so the authoring screens can say which roadmap is still a draft.
   */
  isPublished: boolean;
  topics: Topic[];
}

/** Which simulator a challenge runs in, and therefore how it is graded. */
export type ChallengeKind = "topology" | "assembly" | "cable_wiring";

/**
 * What a bespoke simulator needs to draw itself, as the server derives it from
 * the challenge's own rules. Null for a topology challenge.
 */
export interface SimulationConfig {
  /** Assembly: the parts in play, in build order. */
  components?: string[];
  /** Cable wiring: the standard to wire to, and the cable it makes. */
  standard?: "T568A" | "T568B";
  cable?: string;
}

/** How hard a challenge is, as its author judged it. */
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Challenge {
  id: number;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  /**
   * Authored on the challenge and sent by the API. Never inferred here — the
   * only honest measure is the validation rules, and students never see those.
   */
  difficulty: Difficulty;
  config: SimulationConfig | null;
  /**
   * The device families this challenge's rules involve. The workspace offers a
   * short palette by default and puts back only what an exercise needs, so a
   * printer challenge can still be solved.
   */
  requiredFamilies: string[];
  order: number;
  /**
   * True when every topic holding this challenge is still locked. A challenge
   * placed in no topic is never locked — it stands on its own.
   */
  locked: boolean;
  /** The topics this challenge is placed in. Empty for a catalogue-only one. */
  topicIds: number[];
}

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

/** One of the challenge's requirements, and whether the submission met it. */
export interface RequirementResult {
  requirement: string;
  passed: boolean;
}

export interface Attempt {
  id: number;
  challengeId: number;
  /**
   * The challenge's title, when the endpoint sent it along. Null where it did
   * not — listing an attempt by name is then the caller's problem to solve, and
   * a made-up name would be worse than none.
   */
  challengeTitle: string | null;
  /** Whether the submission satisfied every one of the challenge's rules. */
  passed: boolean;
  /** Per-requirement breakdown. Null until the attempt has been submitted. */
  results: RequirementResult[] | null;
  status: AttemptStatus;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * How the dashboard talks about a challenge. Deliberately coarser than an
 * attempt's status: a student is either still working on a challenge or has
 * finished it. Whether a particular submission "passed" belongs to the attempt
 * that earned it, not to this.
 */
export type ActivityStatus = "in_progress" | "complete";

/**
 * Where the student stands on one challenge — one per challenge, however many
 * times they have opened or submitted it. What "Recent Activities" lists.
 */
export interface ChallengeActivity {
  id: number;
  challengeId: number;
  /** Null when the server did not name the challenge. */
  title: string | null;
  status: ActivityStatus;
  /** The server's own wording for the status. */
  statusLabel: string;
  /** When the student last did anything with this challenge. */
  at: string | null;
  completedAt: string | null;
}

/**
 * What a piece of learning material is. Mirrors App\Enums\MaterialKind — the
 * server refuses anything outside this set, so the client must not invent one.
 */
export type MaterialKind = "video" | "link" | "file";

export const MATERIAL_KINDS: MaterialKind[] = ["video", "link", "file"];

/**
 * Something to read, watch or download alongside a topic.
 *
 * A material carries either a `url` or a `downloadUrl`, never both: an
 * external one points somewhere else, an uploaded one is held by the platform
 * on a private disk and reached through an authenticated route. The raw
 * storage path is never sent, so there is nothing here to leak.
 */
export interface LearningMaterial {
  id: number;
  topicId: number;
  title: string;
  description: string | null;
  kind: MaterialKind;
  kindLabel: string;
  /** Set for video and link. */
  url: string | null;
  /** Set for file. An API route, never a storage URL. */
  downloadUrl: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  order: number;
  isPublished: boolean;
}
