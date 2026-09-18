import { matchRoutes } from "react-router";
import type { RouteObject } from "react-router";

/**
 * Loads the chunks behind a set of paths, before anything is timed.
 *
 * Every addressable page in the app is behind a dynamic import, which is what
 * keeps the admin screens and the heavy simulators out of a student's first
 * load. A data router resolves those imports *before* it renders the branch
 * they are in — that is what HydrateFallback is for — so the first mount of a
 * path pays for the module being fetched and transformed, and nothing on that
 * branch appears until it has been. Including the route guards above it: a test
 * asserting that a signed-out visitor is sent to the login page is, without
 * meaning to be, waiting on the page they are not allowed to see.
 *
 * That cost is work rather than waiting, and it does not belong inside an
 * assertion's budget. Called from `beforeAll`, this pays it once where nothing
 * is being measured. The routes still resolve through the real table on every
 * mount afterwards — this changes nothing about how they are reached, only that
 * the import is already in the module registry when they are, so what each
 * assertion waits for is rendering and nothing else.
 *
 * Give the hook that calls this a longer timeout than the default: loading and
 * transforming a page and its dependencies is exactly the work
 * AppRoutes.test.tsx already allows thirty seconds for.
 *
 * @returns How many lazy routes were loaded, so a caller can assert it warmed
 *          something rather than silently warming nothing.
 */
export async function warmLazyRoutes(
  routes: RouteObject[],
  paths: string[],
): Promise<number> {
  const lazy = paths
    .flatMap((path) => matchRoutes(routes, path) ?? [])
    // `lazy` is declared as either a function or an object of them; every route
    // in this app uses the function form, and the rest are eager.
    .filter((match) => typeof match.route.lazy === "function");

  await Promise.all(lazy.map((match) => (match.route.lazy as () => Promise<unknown>)()));

  return lazy.length;
}
