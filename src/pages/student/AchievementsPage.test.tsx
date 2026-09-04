// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { AchievementsPage } from "./AchievementsPage";
import { ApiError } from "@/services/api";
import type { Achievement } from "@/features/achievements/types";

/**
 * What a student is shown of their achievements.
 *
 * The page reads one endpoint and splits it by a single fact: whether this
 * student has earned each row. That is the whole of its logic, and it is why
 * the lifecycle behind the catalogue is invisible here — a student is never
 * told an achievement's status, and does not need to be.
 *
 * Which puts the weight on what the endpoint sends. It sends everything still
 * winnable plus everything this student has already won, so a retired
 * achievement they earned arrives looking like any other unlocked one — and
 * has to keep counting as one. Getting that wrong takes a badge off their page
 * on a day they did nothing.
 */

vi.mock("@/features/achievements/achievementService", () => ({
  fetchAchievements: vi.fn(),
  fetchEarnedAchievements: vi.fn(),
}));

const service = await import("@/features/achievements/achievementService");

function achievement(over: Partial<Achievement> = {}): Achievement {
  return {
    id: 1,
    key: "first-steps",
    title: "First Steps",
    description: "Pass your first challenge.",
    icon: "flag",
    type: "challenge_count",
    requirement: "Pass your first challenge.",
    progress: { current: 1, target: 1 },
    earnedAt: "2026-09-01T10:00:00.000000Z",
    ...over,
  };
}

const locked = achievement({
  id: 2,
  key: "getting-wired",
  title: "Getting Wired",
  requirement: "Pass 10 challenges.",
  progress: { current: 3, target: 10 },
  earnedAt: null,
});

/** Renders the page and waits for its load to land. */
async function show(achievements: Achievement[]) {
  vi.mocked(service.fetchAchievements).mockResolvedValue(achievements);

  render(<AchievementsPage />);

  await screen.findByRole("heading", { name: "Achievements", level: 1 });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("showing what a student has and has not", () => {
  it("splits the catalogue into unlocked and still locked", async () => {
    await show([achievement(), locked]);

    expect(screen.getByRole("heading", { name: "Unlocked (1)" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How to unlock the rest (1)" }),
    ).toBeInTheDocument();
  });

  it("counts the unlocked against the whole catalogue", async () => {
    await show([achievement(), locked]);

    expect(screen.getByText("1 of 2 unlocked")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("says what a locked one still asks for, and how far along they are", async () => {
    await show([locked]);

    expect(screen.getByText("Pass 10 challenges.")).toBeInTheDocument();
    expect(screen.getByText("Nothing unlocked yet")).toBeInTheDocument();
  });

  it("shows an empty catalogue as nothing published rather than an error", async () => {
    await show([]);

    expect(screen.getByText("No achievements yet")).toBeInTheDocument();
  });

  it("shows the server's message when the catalogue will not load", async () => {
    vi.mocked(service.fetchAchievements).mockRejectedValue(
      new ApiError("Your session has expired. Sign in again.", 401),
    );

    render(<AchievementsPage />);

    expect(
      await screen.findByText("Your session has expired. Sign in again."),
    ).toBeInTheDocument();
  });
});

describe("an achievement that is no longer being awarded", () => {
  /*
   * A retired achievement the student earned arrives indistinguishable from any
   * other unlocked one — no status is sent, because a student has no use for
   * one. These say the page treats it as what it is: earned.
   */
  const retiredButHeld = achievement({
    id: 3,
    key: "earned-before",
    title: "Earned Before",
    requirement: "Pass five challenges.",
    progress: { current: 5, target: 5 },
    earnedAt: "2026-08-01T09:00:00.000000Z",
  });

  it("shows one the student earned as unlocked", async () => {
    await show([retiredButHeld, locked]);

    expect(screen.getByText("Earned Before")).toBeInTheDocument();

    const unlocked = screen
      .getByRole("heading", { name: "Unlocked (1)" })
      .closest("section");

    expect(within(unlocked as HTMLElement).getByText("Earned Before")).toBeInTheDocument();
    expect(within(unlocked as HTMLElement).getByText("Unlocked")).toBeInTheDocument();
  });

  it("counts it towards the total rather than quietly dropping it", async () => {
    // The reading a student would notice going wrong: two of three yesterday,
    // one of two today, having done nothing in between.
    await show([achievement(), retiredButHeld, locked]);

    expect(screen.getByText("2 of 3 unlocked")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("still says what it was awarded for, and when", async () => {
    await show([
      retiredButHeld,
      achievement({
        id: 5,
        key: "no-description",
        title: "No Description",
        description: null,
        requirement: "Pass ten challenges.",
      }),
    ]);

    // An earned card keeps saying what it was for — its description, or the
    // requirement when it has none — so a student can still see what they did
    // for it long after it stopped being awarded.
    expect(screen.getByText("Pass your first challenge.")).toBeInTheDocument();
    expect(screen.getByText("Pass ten challenges.")).toBeInTheDocument();

    // And when they earned it, which retiring does not change.
    expect(screen.getByText(/Unlocked 1 Aug 2026|Unlocked Aug 1, 2026/)).toBeInTheDocument();
  });

  it("renders one stored under a rule that is no longer offered", async () => {
    // roadmap_complete is history. The server scores it zero of zero, so the
    // card has to survive a target of zero without dividing by it.
    await show([
      achievement({
        id: 4,
        key: "roadmap-done",
        title: "Roadmap Complete",
        icon: "map",
        type: "roadmap_complete",
        requirement: "Passed every challenge in the Networking roadmap.",
        progress: { current: 0, target: 0 },
        earnedAt: "2026-07-01T09:00:00.000000Z",
      }),
    ]);

    expect(screen.getByText("Roadmap Complete")).toBeInTheDocument();
    expect(screen.getByText("1 of 1 unlocked")).toBeInTheDocument();
  });
});
