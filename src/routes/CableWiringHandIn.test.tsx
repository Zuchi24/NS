// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";

import contractText from "@/features/simulations/cableWiring/contract/cable-contract.v1.json?raw";
import { warmLazyRoutes } from "@/test/lazyRoutes";
import type { Challenge } from "@/features/content/types";
import type { User } from "@/features/auth/types";

/**
 * Handing a physical cable in, from the route's side.
 *
 * The bench's half — that what it hands over is the model's own toRecord() and
 * nothing rebuilt — is pinned in the physical feature's own tests, which know
 * nothing about attempts. What is checked here is the half only this layer can
 * get wrong: that the record reaches the same submitSimulation() every other
 * bespoke simulator uses, addressed to the attempt in the URL, and that the
 * page behaves around it the way a graded page is supposed to.
 *
 * Only the server is stood in for. The route table, CableWiringRoute, the
 * config discriminator, the parse, the bench and the model are all real, so the
 * body asserted below is a record the bench actually built from the frozen
 * contract's own S1 config — not a shape written for this test.
 *
 * Kept apart from CableWiringRoute.test.tsx, which decides *which* bench opens:
 * these mount the whole bench several times over, and the two files' budgets
 * should not be spent on each other.
 */

const student: User = {
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

  return { ...actual, fetchAttempt: vi.fn(), submitSimulation: vi.fn(), startAttempt: vi.fn() };
});

const { routes } = await import("./AppRoutes");
const content = await import("@/features/content/contentService");

/** S1's public config, exactly as the frozen contract carries it. */
const PHYSICAL_CONFIG = (
  JSON.parse(contractText) as { scenarios: Record<string, { public_config: unknown }> }
).scenarios.S1.public_config;

/** What the legacy `rj45_order` rule is given, and has always been given. */
const LEGACY_CONFIG = { standard: "T568B", cable: "straight" };

function answerWith(config: unknown) {
  vi.mocked(content.fetchAttempt).mockResolvedValue({
    attempt: {
      id: 11,
      challengeId: 7,
      challengeTitle: "Terminate a straight-through cable",
      passed: false,
      results: null,
      status: "in_progress",
      startedAt: null,
      completedAt: null,
    },
    challenge: {
      id: 7,
      title: "Terminate a straight-through cable",
      description: "Make a working cable.",
      kind: "cable_wiring",
      difficulty: "beginner",
      config: config as Challenge["config"],
      requiredFamilies: [],
      order: 0,
    },
    topology: null,
  } as Awaited<ReturnType<typeof content.fetchAttempt>>);
}

/** What the server answers a submission with, once it has marked it. */
function markedWith(results: { requirement: string; passed: boolean }[], passed = false) {
  vi.mocked(content.submitSimulation).mockResolvedValue({
    id: 11,
    challengeId: 7,
    challengeTitle: "Terminate a straight-through cable",
    passed,
    results,
    status: "completed",
    startedAt: null,
    completedAt: null,
  } as Awaited<ReturnType<typeof content.submitSimulation>>);
}

function mountAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

const PHYSICAL = { name: /Terminate a straight-through cable/i, level: 1 } as const;
const LEGACY = { name: /Step 1: Cut/i, level: 2 } as const;

const handIn = () => screen.getByRole("button", { name: /^(HAND IN|SENDING…|HANDED IN)$/, hidden: true });

beforeAll(async () => {
  expect(await warmLazyRoutes(routes, ["/challenge/cable-wiring"])).toBeGreaterThan(0);
}, 30_000);

beforeEach(() => {
  session.user = student;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("handing in a physical cable", () => {
  it("sends the bench's cable/1 record through the shared submission, for this attempt", async () => {
    answerWith(PHYSICAL_CONFIG);
    markedWith([{ requirement: "End A is wired to T568B", passed: true }], true);

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", PHYSICAL);

    fireEvent.click(handIn());

    await waitFor(() => expect(content.submitSimulation).toHaveBeenCalledTimes(1));

    const [attemptId, submission] = vi.mocked(content.submitSimulation).mock.calls[0];

    // Addressed to the attempt in the URL, and carrying the contract's §2 body:
    // the record itself, which submitSimulation wraps and nothing else touches.
    expect(attemptId).toBe(11);
    expect(submission).toMatchObject({ schema: "cable/1" });
    expect(Object.keys(submission as object).sort()).toEqual(["connections", "ends", "schema"]);
    expect(submission).toHaveProperty("ends.A.plug");
    expect(submission).toHaveProperty("ends.B.plug");

    // Nothing the server works out for itself travels with it.
    for (const derived of ["verdict", "pattern", "map", "standard", "passed", "requirements"]) {
      expect(JSON.stringify(submission)).not.toContain(`"${derived}"`);
    }
  });

  it("shows the marked result in the dialog every other simulator uses", async () => {
    answerWith(PHYSICAL_CONFIG);
    markedWith([
      { requirement: "End A is wired to T568B", passed: true },
      { requirement: "The cable is at least 300 mm", passed: false },
    ]);

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", PHYSICAL);

    fireEvent.click(handIn());

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/Not quite yet/)).toBeInTheDocument();
    expect(within(dialog).getByText("End A is wired to T568B")).toBeInTheDocument();
    expect(within(dialog).getByText("The cable is at least 300 mm")).toBeInTheDocument();

    // The mark is the server's. The bench still says nothing about it.
    expect(screen.getByTestId("handin-summary")).not.toHaveTextContent(/pass|fail/i);
  });

  it("cannot be pressed twice while the submission is still in flight", async () => {
    answerWith(PHYSICAL_CONFIG);
    // A submission that never comes back: the page stays mid-flight.
    vi.mocked(content.submitSimulation).mockReturnValue(new Promise(() => {}));

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", PHYSICAL);

    fireEvent.click(handIn());

    await waitFor(() => expect(handIn()).toBeDisabled());
    expect(handIn()).toHaveTextContent("SENDING…");

    fireEvent.click(handIn());
    fireEvent.click(handIn());

    expect(content.submitSimulation).toHaveBeenCalledTimes(1);
  });

  it("will not send the same attempt a second time once it has been marked", async () => {
    answerWith(PHYSICAL_CONFIG);
    markedWith([{ requirement: "End A is wired to T568B", passed: false }]);

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", PHYSICAL);

    fireEvent.click(handIn());
    const dialog = await screen.findByRole("dialog");

    // Dismissing the result must not hand the student a live button back: the
    // attempt is spent, and the server would refuse a second submission.
    fireEvent.click(within(dialog).getByRole("button", { name: /Back to Challenges/i }));

    await waitFor(() => expect(handIn()).toBeDisabled());
    expect(handIn()).toHaveTextContent("HANDED IN");

    fireEvent.click(handIn());

    expect(content.submitSimulation).toHaveBeenCalledTimes(1);
  });

  it("lets the student hand in again when the submission failed, and keeps the cable", async () => {
    answerWith(PHYSICAL_CONFIG);
    vi.mocked(content.submitSimulation).mockRejectedValue(new Error("Network is down"));

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", PHYSICAL);

    const before = screen.getByTestId("end-A").outerHTML;

    fireEvent.click(handIn());
    await waitFor(() => expect(content.submitSimulation).toHaveBeenCalledTimes(1));

    // Nothing was marked, so nothing is spent: the button comes back, no result
    // is shown, and the cable on the bench is untouched by the failure.
    await waitFor(() => expect(handIn()).toBeEnabled());
    expect(handIn()).toHaveTextContent("HAND IN");
    expect(screen.getByTestId("end-A").outerHTML).toBe(before);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    markedWith([{ requirement: "End A is wired to T568B", passed: true }], true);
    fireEvent.click(handIn());

    await waitFor(() => expect(content.submitSimulation).toHaveBeenCalledTimes(2));
  });

  it("leaves the legacy bench submitting for itself, with no hand-in wiring", async () => {
    answerWith(LEGACY_CONFIG);

    mountAt("/challenge/cable-wiring?attempt=11");
    await screen.findByRole("heading", LEGACY);

    // The physical hand-in belongs to the physical bench alone. The legacy page
    // keeps its own tester-driven submission and is untouched by any of this.
    expect(screen.queryByRole("button", { name: /^HAND IN$/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("handin-summary")).not.toBeInTheDocument();
    expect(content.submitSimulation).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Start over/i })).toBeInTheDocument();
  });
});
