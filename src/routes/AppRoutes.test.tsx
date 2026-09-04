// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router";

import { routes } from "./AppRoutes";

/**
 * The route table, and every lazy import in it.
 *
 * Splitting the app by route turned twenty static imports into twenty dynamic
 * ones, and a dynamic import fails differently: a mistyped path or a renamed
 * export is no longer a build error, it is a blank page the first time somebody
 * navigates there. So these resolve every `lazy` in the table and insist a
 * component comes back — which is the one thing the compiler stopped checking.
 *
 * They also pin what must NOT be lazy. A guard that resolves a moment after the
 * thing it guards is not a guard, so ProtectedRoute and RoleRoute stay eager.
 */

/** Every route in the tree, flattened, carrying the path it is reached by. */
function flatten(routes: RouteObject[], prefix = ""): { path: string; route: RouteObject }[] {
  return routes.flatMap((route) => {
    const path = route.path
      ? `${prefix}${route.path.startsWith("/") ? "" : "/"}${route.path}`
      : prefix;

    return [
      { path, route },
      ...flatten((route.children ?? []) as RouteObject[], path),
    ];
  });
}

const all = flatten(routes);

/** The routes a person can actually navigate to, rather than the layouts. */
const addressable = all.filter((entry) => entry.route.path !== undefined);

const EXPECTED_PATHS = [
  // Public
  "/",
  "/login",
  "/signup",
  // Student
  "/dashboard",
  "/progress",
  "/challenges",
  "/roadmap",
  "/achievements",
  "/profile",
  "/topic/:topicId",
  // Simulations
  "/simulations",
  "/activities",
  "/workspace",
  "/challenge/cable-wiring",
  "/challenge/computer-assembly",
  // Admin. "/admin" is the layout's own mount point rather than a page — it
  // has no index route, so it is listed for completeness, not as a destination.
  "/instructor-review",
  "/admin",
  "/admin/dashboard",
  "/admin/students",
  "/admin/students/:year",
  "/admin/students/:year/:sectionId",
  "/admin/students/:year/:sectionId/:studentId",
  "/admin/analytics",
  "/admin/roadmap",
  "/admin/achievements",
  "/admin/profile",
];

describe("the route table", () => {
  it("still addresses every page the app had before it was split", () => {
    // Splitting must not quietly drop or rename a route. This is the list of
    // what students, staff and visitors can reach.
    expect(addressable.map((entry) => entry.path).sort()).toEqual(
      [...EXPECTED_PATHS].sort(),
    );
  });

  it("loads every page lazily rather than in the first bundle", () => {
    const eager = addressable.filter(
      (entry) => entry.route.lazy === undefined && entry.route.Component !== undefined,
    );

    // Every addressable page is behind a dynamic import. This is what keeps
    // recharts, react-dnd and the admin screens out of a student's first load;
    // a page added later with a static Component would silently undo it.
    expect(eager.map((entry) => entry.path)).toEqual([]);
  });

  it("resolves each lazy route to a real component", async () => {
    const lazyRoutes = all.filter((entry) => typeof entry.route.lazy === "function");

    // Every dynamic import in the app, actually executed. A wrong path or a
    // renamed export fails here rather than in front of a user.
    const resolved = await Promise.all(
      lazyRoutes.map(async (entry) => {
        const module = await (entry.route.lazy as () => Promise<{ Component?: unknown }>)();

        return { path: entry.path, Component: module.Component };
      }),
    );

    const broken = resolved.filter((entry) => typeof entry.Component !== "function");

    expect(broken.map((entry) => entry.path)).toEqual([]);
    // Guards against the assertion above passing on an empty list.
    expect(resolved.length).toBeGreaterThanOrEqual(EXPECTED_PATHS.length);
    // Loads and transforms every page in the app — the whole module graph, in
    // one test. That is the point of it, and it is why this one needs longer
    // than the default five seconds when the suite runs files in parallel.
  }, 30_000);

  it("keeps the route guards eager", () => {
    // The two gates and the student chrome are deliberately not split: a gate
    // that arrives after the page it is gating is not a gate, and neither is
    // large enough for splitting to save anyone a byte.
    const guards = all.filter(
      (entry) => entry.route.Component !== undefined && entry.route.lazy === undefined,
    );

    expect(guards.length).toBeGreaterThan(0);

    for (const guard of guards) {
      expect(typeof guard.route.Component).toBe("function");
    }
  });

  it("shows something while the first route's chunk is still arriving", () => {
    // Only ever seen on a cold load straight into a page: React Router resolves
    // a lazy route before committing a navigation, so moving between pages
    // never blanks the screen. Without this, a deep link renders nothing at all
    // until its chunk lands.
    const tops = routes;

    for (const route of tops) {
      expect(route.HydrateFallback).toBeDefined();
    }
  });
});

describe("the split boundaries", () => {
  it("puts the three simulation routes behind their own imports", async () => {
    const sims = addressable.filter((entry) =>
      ["/workspace", "/challenge/cable-wiring", "/challenge/computer-assembly"].includes(
        entry.path,
      ),
    );

    expect(sims).toHaveLength(3);
    // react-dnd travels with these, so each one has to be its own dynamic
    // import rather than a static reference from the router.
    expect(sims.every((entry) => typeof entry.route.lazy === "function")).toBe(true);
  });

  it("puts every admin page behind its own import", async () => {
    const admin = addressable.filter((entry) => entry.path.startsWith("/admin"));

    expect(admin.length).toBeGreaterThanOrEqual(8);
    expect(admin.every((entry) => typeof entry.route.lazy === "function")).toBe(true);
  });

  it("opens the one workspace from all three of its addresses", async () => {
    // /simulations and /activities are older names for the canvas. They must
    // resolve to the same component, so splitting gives them one shared chunk
    // rather than three copies of the workspace.
    const paths = ["/simulations", "/activities", "/workspace"];

    const components = await Promise.all(
      paths.map(async (path) => {
        const entry = addressable.find((candidate) => candidate.path === path)!;
        const module = await (entry.route.lazy as () => Promise<{ Component?: unknown }>)();

        return module.Component;
      }),
    );

    expect(new Set(components).size).toBe(1);
  });
});
