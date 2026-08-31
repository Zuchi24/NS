import { describe, expect, it } from "vitest";

import { deriveStudentProgress, percentOf } from "./studentProgress";
import type {
  Attempt,
  Challenge,
  ChallengeActivity,
  Roadmap,
  Topic,
} from "./types";

/**
 * The dashboard's arithmetic, which is the one place the student side counts
 * anything for itself.
 *
 * The fixtures below are the shapes `contentService` hands back after mapping a
 * real response: the catalogue's own challenge titles, Laravel's ISO timestamps,
 * and topic progress exactly as the server attaches it.
 */

/** Laravel's serialised timestamps, in the format the API actually emits. */
const T = {
  threeDaysAgo: "2026-08-25T09:15:00.000000Z",
  twoDaysAgo: "2026-08-26T14:02:00.000000Z",
  yesterday: "2026-08-27T08:40:00.000000Z",
  today: "2026-08-28T11:20:00.000000Z",
} as const;

let nextAttemptId = 1;

function attempt(overrides: Partial<Attempt> & { challengeId: number }): Attempt {
  return {
    id: nextAttemptId++,
    challengeTitle: null,
    passed: false,
    results: null,
    status: "completed",
    startedAt: T.twoDaysAgo,
    completedAt: T.twoDaysAgo,
    ...overrides,
  };
}

/** A submitted attempt that satisfied every rule. */
function passed(challengeId: number, over: Partial<Attempt> = {}): Attempt {
  return attempt({ challengeId, passed: true, status: "completed", ...over });
}

/** A submitted attempt that missed at least one rule. */
function notPassed(challengeId: number, over: Partial<Attempt> = {}): Attempt {
  return attempt({
    challengeId,
    passed: false,
    status: "completed",
    results: [{ requirement: "Place a router", passed: false }],
    ...over,
  });
}

/** Opened and still being worked on, so never submitted. */
function open(challengeId: number, over: Partial<Attempt> = {}): Attempt {
  return attempt({
    challengeId,
    status: "in_progress",
    completedAt: null,
    ...over,
  });
}

function abandoned(challengeId: number, over: Partial<Attempt> = {}): Attempt {
  return attempt({ challengeId, status: "abandoned", ...over });
}

function challenge(id: number, title: string): Challenge {
  return {
    id,
    title,
    description: null,
    kind: "topology",
    difficulty: "beginner",
    config: null,
    requiredFamilies: [],
    order: id,
    locked: false,
    topicIds: [],
  };
}

/** The four challenges the seeded catalogue opens with. */
const CATALOGUE: Challenge[] = [
  challenge(1, "Assemble a working PC"),
  challenge(2, "Terminate a straight-through cable"),
  challenge(3, "Connect a PC to a switch"),
  challenge(4, "Share a printer on the LAN"),
];

/**
 * A challenge that has been retired.
 *
 * Retirement soft-deletes the challenge on the server, so it is absent from
 * /challenges — but attempts made on it are kept and still come back from
 * /attempts. That mismatch is the only way these counts can disagree, so the
 * id below deliberately appears in attempts and never in CATALOGUE.
 */
const RETIRED_ID = 99;

function topic(
  id: number,
  title: string,
  progress: Topic["progress"] = null,
): Topic {
  return {
    id,
    roadmapId: 1,
    title,
    description: null,
    videoUrl: null,
    order: id,
    challengesCount: 2,
    progress,
  };
}

/** The server's own verdict on a topic, as TopicResource sends it. */
function standing(
  status: NonNullable<Topic["progress"]>["status"],
  percent: number,
): Topic["progress"] {
  return {
    status,
    percent,
    isUnlocked: status !== "locked",
    completedAt: status === "completed" ? T.twoDaysAgo : null,
  };
}

let nextActivityId = 1;

/**
 * One line of "Recent Activities", as `/activities` sends it: the server keeps
 * a single row per student and challenge, so a fixture never holds two rows for
 * one challenge.
 */
function activity(
  challengeId: number,
  over: Partial<ChallengeActivity> = {},
): ChallengeActivity {
  const status = over.status ?? "in_progress";

  return {
    id: nextActivityId++,
    challengeId,
    title: null,
    status,
    statusLabel: status === "complete" ? "Complete" : "In Progress",
    at: T.twoDaysAgo,
    completedAt: status === "complete" ? T.twoDaysAgo : null,
    ...over,
  };
}

function roadmap(topics: Topic[], id = 1): Roadmap {
  return {
    id,
    title: "Networking Essentials",
    description: "From the parts in your hand to a working network.",
    order: 0,
    // Published, because this summary is a student's: the API only ever sends
    // a student roadmaps that are out.
    isPublished: true,
    topics,
  };
}

describe("deriveStudentProgress", () => {
  describe("the distinct-challenge rule", () => {
    it("counts a challenge once however many times it was passed", () => {
      // Re-running a challenge you already passed must not move the number.
      const result = deriveStudentProgress(
        [
          passed(1, { completedAt: T.twoDaysAgo }),
          passed(1, { completedAt: T.yesterday }),
          passed(1, { completedAt: T.today }),
        ],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(1);
    });

    it("counts a challenge once when it was failed before it was passed", () => {
      // The commonest real shape: a miss, then a pass, on one challenge.
      const result = deriveStudentProgress(
        [
          notPassed(3, { completedAt: T.threeDaysAgo }),
          passed(3, { completedAt: T.twoDaysAgo }),
        ],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(1);
    });

    it("never reports more passes than the catalogue holds", () => {
      // Four challenges, ten attempts spread over them.
      const result = deriveStudentProgress(
        [
          passed(1),
          passed(1),
          passed(2),
          notPassed(2),
          passed(2),
          passed(3),
          passed(3),
          notPassed(4),
          passed(4),
          passed(4),
        ],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(4);
      expect(result.challengesPassed).toBeLessThanOrEqual(
        result.challengesTotal,
      );
    });

    it("does not count a pass on a challenge that has been retired", () => {
      // The only way the count can outrun the catalogue. A retired challenge
      // is soft-deleted server-side: it leaves /challenges, but the attempt
      // made on it stays in /attempts as the student's history. Counting it
      // would read as five passes out of a catalogue of four.
      const result = deriveStudentProgress(
        [passed(1), passed(2), passed(3), passed(4), passed(RETIRED_ID)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(4);
      expect(result.challengesPassed).toBeLessThanOrEqual(
        result.challengesTotal,
      );
    });

    it("keeps completion at 100% rather than over it when a pass is retired", () => {
      // What the instructor-side bug looked like from the student's chair:
      // every live challenge passed, plus one since withdrawn.
      const result = deriveStudentProgress(
        [passed(1), passed(2), passed(3), passed(4), passed(RETIRED_ID)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(percentOf(result.challengesPassed, result.challengesTotal)).toBe(
        100,
      );
    });

    it("still counts a pass on a challenge that is in no topic", () => {
      // Guards the fix from overreaching. An unplaced challenge is in the
      // catalogue and attemptable; only retirement takes a challenge out.
      const unplaced = challenge(9, "Standalone catalogue exercise");

      const result = deriveStudentProgress(
        [passed(9)],
        [...CATALOGUE, unplaced],
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(1);
    });

    it("drops an open attempt whose challenge was retired under it", () => {
      // A challenge can be withdrawn while someone still has it open. The
      // attempt survives as history, but there is nothing left to work on, so
      // it must not be offered back as work in progress.
      const result = deriveStudentProgress(
        [open(2), open(RETIRED_ID)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesInProgress).toBe(1);
    });

    it("counts an open challenge once however many times it was opened", () => {
      const result = deriveStudentProgress(
        [open(2), open(2)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesInProgress).toBe(1);
    });
  });

  describe("outcomes", () => {
    it("counts only a passing submission toward challenges passed", () => {
      const result = deriveStudentProgress(
        [notPassed(1), open(2), abandoned(3)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(0);
    });

    it("treats an abandoned attempt as neither passed nor in progress", () => {
      // Abandoning is how a student walks away, so it must not leave the
      // challenge looking like live work on the dashboard.
      const result = deriveStudentProgress(
        [abandoned(1)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesPassed).toBe(0);
      expect(result.challengesInProgress).toBe(0);
    });

    it("counts only an unsubmitted attempt as in progress", () => {
      const result = deriveStudentProgress(
        [passed(1), notPassed(2), open(3), abandoned(4)],
        CATALOGUE,
        [roadmap([])],
      );

      expect(result.challengesInProgress).toBe(1);
    });
  });

  describe("a student who has done nothing", () => {
    it("reports zeroes and no activity rather than anything invented", () => {
      const result = deriveStudentProgress(
        [],
        CATALOGUE,
        [
          roadmap([
            topic(1, "Hardware and Cabling", standing("unlocked", 0)),
            topic(2, "Your First LAN", standing("locked", 0)),
          ]),
        ],
      );

      expect(result).toMatchObject({
        challengesPassed: 0,
        challengesInProgress: 0,
        topicsCompleted: 0,
        // The catalogue is still there to be measured against.
        challengesTotal: 4,
        topicsTotal: 2,
      });
      expect(result.activity).toEqual([]);
    });

    it("does not divide by an empty catalogue", () => {
      const result = deriveStudentProgress([], [], [roadmap([])]);

      expect(result.challengesTotal).toBe(0);
      expect(result.topicsTotal).toBe(0);
      expect(percentOf(result.challengesPassed, result.challengesTotal)).toBe(0);
      expect(percentOf(result.topicsCompleted, result.topicsTotal)).toBe(0);
    });
  });

  describe("a mixed record", () => {
    it("splits one student's attempts across the right totals", () => {
      // Two challenges passed (one of them on a retry), one still open, one
      // submitted and missed — nine attempts over four challenges.
      const result = deriveStudentProgress(
        [
          passed(1, { completedAt: T.threeDaysAgo }),
          notPassed(2, { completedAt: T.threeDaysAgo }),
          passed(2, { completedAt: T.twoDaysAgo }),
          passed(2, { completedAt: T.yesterday }),
          notPassed(3, { completedAt: T.yesterday }),
          open(4, { startedAt: T.today }),
        ],
        CATALOGUE,
        [
          roadmap([
            topic(1, "Hardware and Cabling", standing("completed", 100)),
            topic(2, "Your First LAN", standing("in_progress", 33)),
          ]),
        ],
      );

      expect(result).toMatchObject({
        challengesPassed: 2,
        challengesTotal: 4,
        challengesInProgress: 1,
        topicsCompleted: 1,
        topicsTotal: 2,
      });

    });
  });

  describe("progress against the whole catalogue", () => {
    it("measures against every challenge, not only the ones attempted", () => {
      const result = deriveStudentProgress([passed(1)], CATALOGUE, [
        roadmap([]),
      ]);

      expect(result.challengesTotal).toBe(4);
      expect(percentOf(result.challengesPassed, result.challengesTotal)).toBe(
        25,
      );
    });

    it("grows the denominator when the catalogue does", () => {
      const bigger = [...CATALOGUE, challenge(5, "Wire the computer lab")];

      expect(
        deriveStudentProgress([passed(1)], bigger, [roadmap([])])
          .challengesTotal,
      ).toBe(5);
    });

    it("counts the topics of every roadmap", () => {
      const result = deriveStudentProgress(
        [],
        CATALOGUE,
        [
          roadmap([topic(1, "Hardware and Cabling", standing("completed", 100))]),
          roadmap(
            [
              topic(2, "Addressing the Network", standing("completed", 100)),
              topic(3, "Growing the Network", standing("locked", 0)),
            ],
            2,
          ),
        ],
      );

      expect(result.topicsTotal).toBe(3);
      expect(result.topicsCompleted).toBe(2);
    });
  });

  describe("topic completion comes from the server", () => {
    it("counts the topics the server marked completed, and no others", () => {
      const result = deriveStudentProgress(
        [],
        CATALOGUE,
        [
          roadmap([
            topic(1, "Hardware and Cabling", standing("completed", 100)),
            topic(2, "Your First LAN", standing("in_progress", 50)),
            topic(3, "Addressing the Network", standing("unlocked", 0)),
            topic(4, "Growing the Network", standing("locked", 0)),
          ]),
        ],
      );

      // No attempts at all, yet a topic still reads completed: the verdict is
      // the server's, and this must report it rather than second-guess it.
      expect(result.topicsCompleted).toBe(1);
    });

    it("does not infer completion from passing every challenge", () => {
      // Every challenge in the catalogue passed, but the server has not marked
      // the topic completed. The unlock and completion rules live on the
      // server, so the dashboard follows it rather than working it out again.
      const result = deriveStudentProgress(
        CATALOGUE.map((entry) => passed(entry.id)),
        CATALOGUE,
        [roadmap([topic(1, "Hardware and Cabling", standing("in_progress", 90))])],
      );

      expect(result.challengesPassed).toBe(4);
      expect(result.topicsCompleted).toBe(0);
    });

    it("treats a topic with no progress row as not completed", () => {
      const result = deriveStudentProgress(
        [],
        CATALOGUE,
        [roadmap([topic(1, "Hardware and Cabling")])],
      );

      expect(result.topicsCompleted).toBe(0);
      expect(result.topicsTotal).toBe(1);
    });
  });

  describe("the activity feed", () => {
    it("passes the server's rows through in the order they arrived", () => {
      // The server sorts, and it sorts by when the student last touched the
      // challenge. Re-sorting here would be a second opinion on a decision
      // already made.
      const rows = [
        activity(2, { at: T.today }),
        activity(3, { at: T.yesterday }),
        activity(1, { at: T.threeDaysAgo, status: "complete" }),
      ];

      const result = deriveStudentProgress(
        [passed(1), open(2)],
        CATALOGUE,
        [roadmap([])],
        rows,
      );

      expect(result.activity.map((entry) => entry.at)).toEqual([
        T.today,
        T.yesterday,
        T.threeDaysAgo,
      ]);
    });

    it("lists a challenge once however many attempts stand behind it", () => {
      // Five attempts on one challenge, one line about it. The attempts are
      // still all there to be counted; they are simply not the feed.
      const attempts = [
        notPassed(3, { completedAt: T.threeDaysAgo }),
        notPassed(3, { completedAt: T.twoDaysAgo }),
        passed(3, { completedAt: T.yesterday }),
        open(3, { startedAt: T.today }),
      ];

      const result = deriveStudentProgress(attempts, CATALOGUE, [roadmap([])], [
        activity(3, { status: "complete", at: T.today }),
      ]);

      expect(result.activity).toHaveLength(1);
      expect(result.activity[0]).toMatchObject({
        challengeId: 3,
        status: "complete",
      });
    });

    it("says Complete, never Passed", () => {
      const result = deriveStudentProgress([], CATALOGUE, [roadmap([])], [
        activity(1, { status: "complete" }),
        activity(2, { status: "in_progress" }),
      ]);

      expect(result.activity.map((entry) => entry.statusLabel)).toEqual([
        "Complete",
        "In Progress",
      ]);
    });

    it("carries the challenge name the API sent, and null when it sent none", () => {
      const result = deriveStudentProgress([], CATALOGUE, [roadmap([])], [
        activity(1, { title: "Assemble a working PC" }),
        activity(2, { title: null }),
      ]);

      expect(result.activity.map((entry) => entry.title)).toEqual([
        "Assemble a working PC",
        null,
      ]);
    });

    it("is empty for a student who has opened nothing", () => {
      const result = deriveStudentProgress([], CATALOGUE, [roadmap([])], []);

      expect(result.activity).toEqual([]);
    });

    it("leaves the rows it was given untouched", () => {
      const rows = [activity(1, { at: T.threeDaysAgo }), activity(2, { at: T.today })];
      const order = rows.map((entry) => entry.id);

      deriveStudentProgress([], CATALOGUE, [roadmap([])], rows).activity.sort(
        (a, b) => a.id - b.id,
      );

      expect(rows.map((entry) => entry.id)).toEqual(order);
    });
  });
});

describe("percentOf", () => {
  it("rounds to whole percentage points", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
  });

  it("returns zero rather than NaN when there is nothing to measure", () => {
    expect(percentOf(0, 0)).toBe(0);
  });

  it("reports a finished catalogue as one hundred", () => {
    expect(percentOf(4, 4)).toBe(100);
  });
});
