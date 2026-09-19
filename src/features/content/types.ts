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

/**
 * One part of a roadmap: reading, watching, and the material attached to it.
 *
 * A topic holds no challenges and paces nothing. Every topic of a published
 * roadmap is open to any signed-in student, so there is no standing to report
 * and no lock to show — what gates a topic is whether its roadmap has been
 * published, which the server answers by refusing the request.
 */
export interface Topic {
  id: number;
  roadmapId: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  order: number;
  /**
   * The topic this one is a section of, or null if it is a topic of the
   * roadmap in its own right.
   *
   * Sent on every topic, so a row can be told apart from where it was found.
   * A response written before subtopics existed says nothing here, which reads
   * as a root topic — which is what every topic was.
   */
  parentId: number | null;
  /**
   * The sections inside this topic.
   *
   * Absent unless the caller asked for them: the topic page and the authoring
   * tree do, the roadmap's table of contents does not. Empty means a topic
   * with no sections, which is not the same as not having asked.
   */
  subtopics?: Subtopic[];
}

/**
 * Where a student stands on one section: finished it, may open it now, or has
 * not reached it yet.
 *
 * The server's judgement, never the client's. It is read from whatever the
 * response said and carried about unchanged — working it out here, from a
 * section's place in the list or from what came back with it, would be a second
 * opinion on a question the server has already answered and the one the policy
 * will actually enforce.
 */
export type SubtopicStatus = "completed" | "available" | "locked";

/**
 * A section inside a topic, and what it holds.
 *
 * The same row as a topic, seen in its other role — which is why it carries no
 * `subtopics` of its own. The hierarchy is one level deep and the server keeps
 * it that way, so there is nowhere further down for this type to describe.
 *
 * A section is paced, but it does not pace itself: where the student stands on
 * it arrives already decided, and the challenges stay with the topic holding
 * it.
 */
export interface Subtopic {
  id: number;
  roadmapId: number;
  parentId: number;
  title: string;
  description: string | null;
  order: number;

  /**
   * Where the student reading it stands on this section, when the response
   * said.
   *
   * Optional because the server sends it only where it has a judgement to
   * report: a student's nested sections carry one, staff — who read everything
   * — are sent none, and a response from before the field existed says nothing
   * either. Undefined therefore means "not said", which is not "locked": the
   * absence must never be drawn as a lock, and nothing here fills it in.
   */
  status?: SubtopicStatus;

  /** Its own materials, as its author ordered them. */
  materials: LearningMaterial[];
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
 * What a guided simulator is given: the assembly's build order, or the legacy
 * cable's standard and type. Told apart from the physical bench's config by
 * having no `model`.
 */
export interface GuidedSimulationConfig {
  /** Assembly: the parts in play, in build order. */
  components?: string[];
  /** Legacy cable wiring: the standard to wire to, and the cable it makes. */
  standard?: "T568A" | "T568B";
  cable?: string;
  /** Never set. The physical bench's config is the one that carries this. */
  model?: undefined;
  scenario?: undefined;
  assist?: undefined;
}

/**
 * What the physical cable bench is given: the cable contract's §8 public
 * config, as the server projects it from an `rj45_cable` rule.
 *
 * Its body is deliberately left opaque. This is wire data, and the one thing
 * entitled to call it well formed is parsePhysicalChallengeConfig(), which
 * takes `unknown` and reads it field by field precisely so that a config the
 * contract would refuse cannot reach the bench on a type's say-so. Restating
 * the scenario's shape here would be a second description of it, free to drift
 * from the parser that actually enforces it.
 */
export interface PhysicalSimulationConfig {
  /** The contract's discriminator (§8), and the only field read outside the parser. */
  model: "physical";
  scenario: unknown;
  assist: unknown;
  /** Never set; declared so the two shapes stay one union to read a field off. */
  components?: never;
  standard?: never;
  cable?: never;
}

/**
 * What a bespoke simulator needs to draw itself, as the server derives it from
 * the challenge's own rules. Null for a topology challenge.
 *
 * Two shapes share the field, and `model` is what tells them apart — the same
 * discriminator the contract defines and isPhysicalConfig() reads. A challenge
 * graded on `rj45_cable` gets the physical config; everything else, including
 * the legacy `rj45_order` wiring, gets the guided one.
 */
export type SimulationConfig = GuidedSimulationConfig | PhysicalSimulationConfig;

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
