// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { ChallengePage } from "./ChallengePage";
import type { Attempt, Challenge } from "@/features/content/types";

/**
 * The challenge catalogue on a phone-width screen.
 *
 * Layout is not measured in jsdom, so these pin the classes that keep a card's
 * heading inside the screen: its difficulty and status pills once sat beside
 * the title on a row that could not wrap, and pushed the page wider than the
 * viewport.
 */

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content/contentService")
  >();

  return {
    ...actual,
    fetchChallenges: vi.fn(),
    fetchMyAttempts: vi.fn(),
    startAttempt: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const content = await import("@/features/content/contentService");

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 1,
    title: "Terminate a straight-through cable",
    description: "Wire both ends to the same standard.",
    kind: "cable_wiring",
    difficulty: "intermediate",
    config: null,
    requiredFamilies: [],
    order: 0,
    ...over,
  };
}

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: 1,
    challengeId: 1,
    challengeTitle: null,
    passed: false,
    results: null,
    status: "in_progress",
    startedAt: "2026-09-20T10:00:00.000000Z",
    completedAt: null,
    ...over,
  };
}

async function show(attempts: Attempt[] = []) {
  vi.mocked(content.fetchChallenges).mockResolvedValue([challenge()]);
  vi.mocked(content.fetchMyAttempts).mockResolvedValue(attempts);

  render(
    <MemoryRouter>
      <ChallengePage />
    </MemoryRouter>,
  );

  return screen.findByRole("heading", {
    name: "Terminate a straight-through cable",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ChallengePage on a narrow screen", () => {
  it("lets a card's pills wrap below its title rather than past the screen", async () => {
    const title = await show([attempt()]);
    const pills = screen.getByText("In Progress", { selector: "span" })
      .parentElement as HTMLElement;

    expect(title.parentElement).toHaveClass("flex-wrap");
    expect(title.parentElement).toContainElement(pills);
    expect(pills).toHaveClass("flex-wrap");
  });
});
