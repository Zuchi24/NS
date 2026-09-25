// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, matchRoutes } from "react-router";

import contractText from "@/features/simulations/cableWiring/contract/cable-contract.v1.json?raw";
import { warmLazyRoutes } from "@/test/lazyRoutes";
import type { Challenge } from "@/features/content/types";
import type { User } from "@/features/auth/types";

/**
 * Which bench /challenge/cable-wiring actually opens.
 *
 * The physical bench and the legacy page are both complete, both addressed the
 * same way, and told apart only by the rule the challenge is graded on — so the
 * one thing that decides which a student reaches is the route. That decision is
 * not something a type checks: both components take what they are given and
 * draw a cable bench, and a route pointed at the wrong one is a working page
 * showing the wrong simulator.
 *
 * So these go through the real thing: the real route table, the real
 * CableWiringRoute, the real config discriminator and the real parse. The only
 * thing standing in for the server is the attempt it would have answered with,
 * and the config on that attempt is the frozen contract's own S1 public config
 * (cable-contract.v1.json §8) rather than a shape written for this test — a
 * config the parser would refuse proves nothing about the route.
 */

const admin: User = {
  id: 1,
  name: "Bea Cruz",
  firstName: "Bea",
  lastName: "Cruz",
  studentId: "2021-00042",
  email: "bea@netsim.edu",
  role: "student",
  joinedAt: "2025-01-06T00:00:00Z",
  section: { id: 3, name: "BSIT 3-A", yearLevel: "3rd Year" },
};

const session = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: session.user,
    isAuthenticated: session.user !== null,
    isAdmin: session.user?.role === "admin",
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/features/content/contentService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/content/contentService")>();

  return { ...actual, fetchAttempt: vi.fn() };
});

const { routes } = await import("./AppRoutes");
const content = await import("@/features/content/contentService");

/** S1's public config, exactly as the frozen contract carries it. */
const PHYSICAL_CONFIG = (
  JSON.parse(contractText) as { scenarios: Record<string, { public_config: unknown }> }
).scenarios.S1.public_config;

/** What the legacy `rj45_order` rule is given, and has always been given. */
const LEGACY_CONFIG = { standard: "T568B", cable: "straight" };

function challengeWith(config: unknown): Challenge {
  return {
    id: 7,
    title: "Terminate a straight-through cable",
    description: "Make a working cable.",
    kind: "cable_wiring",
    difficulty: "beginner",
    config: config as Challenge["config"],
    requiredFamilies: [],
    order: 0,
  };
}

function answerWith(config: unknown) {
  vi.mocked(content.fetchAttempt).mockResolvedValue({
    attempt: {
      id: 11,
      challengeId: 7,
      challengeTitle: "Terminate a straight-through cable",
      passed: false,
      results: null,
      status: "in_progress",
    },
    challenge: challengeWith(config),
    topology: null,
  } as Awaited<ReturnType<typeof content.fetchAttempt>>);
}

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);

  return router;
}

/** The physical bench's own heading, and nothing else on the page carries it. */
const PHYSICAL = { name: /Terminate a straight-through cable/i, level: 1 } as const;

/** The legacy page's step heading. The physical bench numbers no steps. */
const LEGACY = { name: /Step 1: Cut/i, level: 2 } as const;

beforeAll(async () => {
  expect(await warmLazyRoutes(routes, ["/challenge/cable-wiring"])).toBeGreaterThan(0);
}, 30_000);

beforeEach(() => {
  session.user = admin;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the cable wiring route", () => {
  it("resolves /challenge/cable-wiring to one lazily loaded page", () => {
    const matched = matchRoutes(routes, "/challenge/cable-wiring");

    expect(matched).not.toBeNull();
    expect(matched!.map((match) => match.route.path)).toContain("/challenge/cable-wiring");
    expect(typeof matched![matched!.length - 1].route.lazy).toBe("function");
  });

  it("opens the physical bench for a challenge graded on the physical rule", async () => {
    answerWith(PHYSICAL_CONFIG);

    mountAt("/challenge/cable-wiring?attempt=11");

    // The bench's own furniture: a shelf of tools, the readouts beside it, and
    // the live region every action is announced in. The legacy page has none
    // of these.
    expect(await screen.findByRole("heading", PHYSICAL)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Readouts" })).toBeInTheDocument();
    expect(screen.getByTestId("feedback")).toBeInTheDocument();
  });

  it("gives that bench the challenge's own words and the config's scenario", async () => {
    answerWith(PHYSICAL_CONFIG);

    mountAt("/challenge/cable-wiring?attempt=11");

    await screen.findByRole("heading", PHYSICAL);

    // The title and description come from the challenge; the cable's length is
    // the config's scenario, which is what proves the parse reached the bench
    // rather than a default one being drawn.
    expect(screen.getByText("Make a working cable.")).toBeInTheDocument();
    expect(screen.getByText(/1000 mm/)).toBeInTheDocument();
  });

  it("offers the way back to Challenges from the physical bench, as every simulator page does", async () => {
    answerWith(PHYSICAL_CONFIG);

    const router = mountAt("/challenge/cable-wiring?attempt=11");

    await screen.findByRole("heading", PHYSICAL);
    fireEvent.click(screen.getByRole("button", { name: /Back to Challenges/i }));

    // Challenges is a lazy route, so the move lands once it has loaded.
    await waitFor(() => expect(router.state.location.pathname).toBe("/challenges"));
  });

  it("opens the legacy page for a challenge graded on the legacy order rule", async () => {
    answerWith(LEGACY_CONFIG);

    mountAt("/challenge/cable-wiring?attempt=11");

    // The legacy bench's own numbered step heading, which the physical bench
    // does not have.
    expect(await screen.findByRole("heading", LEGACY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start over/i })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Tools" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback")).not.toBeInTheDocument();
  });

  it("leaves free practice on the legacy page, as it has always been", async () => {
    // No attempt: there is no challenge, so there is no rule to read, and the
    // page is practice on its own defaults.
    mountAt("/challenge/cable-wiring");

    expect(await screen.findByRole("heading", LEGACY)).toBeInTheDocument();
    expect(content.fetchAttempt).not.toHaveBeenCalled();
    expect(screen.queryByRole("toolbar", { name: "Tools" })).not.toBeInTheDocument();
  });

  it("opens neither bench when a physical challenge carries a config the contract refuses", async () => {
    // Says it is physical, and is not. Drawing the legacy page from it would
    // show the wrong bench; drawing the physical one is impossible.
    answerWith({ model: "physical", scenario: { id: "" }, assist: null });

    mountAt("/challenge/cable-wiring?attempt=11");

    expect(await screen.findByText(/cannot be opened/i)).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", LEGACY)).not.toBeInTheDocument();
  });
});
