// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import { PAGE_GUTTER, STUDENT_NAV_ITEMS, StudentLayout } from "./StudentLayout";

/**
 * The student chrome: where it can send you, and where it says you are.
 *
 * Two things here are not obvious from looking at the sidebar on a laptop.
 *
 * The first is that the highlight has to answer for more addresses than it has
 * entries. /progress and /dashboard are the same page under two names, and the
 * sidebar used to highlight nothing at all on one of them — the one screen
 * where a student could not tell from the chrome where they were.
 *
 * The second is that below the medium breakpoint the rail is not on screen at
 * all, so every destination it holds has to be reachable some other way. That
 * is what the drawer is for, and it is why these tests open it and look for the
 * same list rather than trusting that it was built from the same array.
 */

const logout = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: "Bea Cruz",
      firstName: "Bea",
      lastName: "Cruz",
      studentId: "2021-00042",
      email: "bea@netsim.edu",
      role: "student",
      joinedAt: null,
      section: null,
    },
    isAuthenticated: true,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout,
    refreshUser: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/**
 * The layout at one address, with a stand-in for whatever page it wraps.
 *
 * A splat route rather than the real table: these are about the chrome, and
 * pinning them to the pages underneath would make every one of them fail the
 * next time one of those pages changed what it fetches.
 */
function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<StudentLayout />}>
          <Route path="*" element={<div>page body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** The rail is the first Main nav; the drawer's is the second when it is open. */
function rail() {
  return screen.getAllByRole("navigation", { name: "Main" })[0];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("where the student navigation can send you", () => {
  it("offers every destination, unchanged", () => {
    renderAt("/dashboard");

    const links = within(rail()).getAllByRole("link");

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Dashboard",
      "Challenges",
      "Workspace",
      "Roadmap",
      "Achievements",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/challenges",
      "/workspace",
      "/roadmap",
      "/achievements",
    ]);
  });

  it("keeps profile and logout where they were", () => {
    renderAt("/dashboard");

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("logs out through the auth context rather than by navigating", async () => {
    renderAt("/dashboard");

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });
});

describe("saying which page you are on", () => {
  it.each([
    ["/dashboard", "Dashboard"],
    ["/challenges", "Challenges"],
    ["/roadmap", "Roadmap"],
    ["/achievements", "Achievements"],
  ])("marks %s as the current page", (pathname, name) => {
    renderAt(pathname);

    expect(within(rail()).getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks exactly one entry at a time", () => {
    renderAt("/roadmap");

    const current = within(rail())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(current).toHaveLength(1);
  });

  it("still points at Dashboard on /progress, which is the same page renamed", () => {
    // The gap this closes: /progress rendered the dashboard with nothing in the
    // sidebar highlighted.
    renderAt("/progress");

    expect(within(rail()).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Profile when the profile page is open", () => {
    renderAt("/profile");

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not light up an entry for an address that merely starts the same way", () => {
    // Segment-aware rather than a plain prefix: "/roadmap-archive" is not the
    // roadmap, and startsWith said it was.
    renderAt("/roadmap-archive");

    const current = within(rail())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(current).toEqual([]);
  });
});

describe("the shell a page renders into", () => {
  it("leaves the scroller unpadded and puts the gutter inside it", () => {
    // Not a tidying-up. `position: sticky` measures `top` from the scrolling
    // element's padding box, so with the gutter on <main> every sticky page
    // header pinned itself a gutter's width below the app header, with a strip
    // of page background showing between the two. A white bar with a shadow,
    // hanging under the header instead of against it, is what "floating" meant.
    const { container } = render(
      <MemoryRouter initialEntries={["/roadmap"]}>
        <Routes>
          <Route element={<StudentLayout />}>
            <Route path="*" element={<div>page body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const main = container.querySelector("main")!;

    expect(main.className).toContain("overflow-auto");
    expect(main.className).not.toMatch(/(^|\s)p-\d/);
    expect(main.firstElementChild).toHaveClass(PAGE_GUTTER);
  });

  it("names a gutter a page can cancel exactly", () => {
    // RoadmapPage bleeds back out of this with a matching negative margin, and
    // its own test holds the pair together. This only insists the token stays
    // the shape that arithmetic works on.
    expect(PAGE_GUTTER).toMatch(/^p-\d+$/);
  });
});

describe("on a screen too narrow for the rail", () => {
  it("keeps the rail out of the way and offers a way to open the menu", () => {
    renderAt("/roadmap");

    // jsdom applies no media queries, so what is pinned here is that the rail
    // is behind the breakpoint at all — it had no breakpoint on it before, and
    // sat at a fixed 256px on a 390px phone.
    expect(rail().closest("aside")).toHaveClass("hidden", "md:flex");
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveClass(
      "md:hidden",
    );
  });

  it("opens a drawer holding the same destinations", async () => {
    renderAt("/roadmap");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const links = within(drawer).getAllByRole("link");

    // Every rail destination, reachable with the rail off screen.
    for (const item of STUDENT_NAV_ITEMS) {
      expect(within(drawer).getByRole("link", { name: item.name })).toHaveAttribute(
        "href",
        item.path,
      );
    }

    expect(within(drawer).getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(links.length).toBeGreaterThanOrEqual(STUDENT_NAV_ITEMS.length);
  });

  it("carries the same current-page mark into the drawer", async () => {
    renderAt("/progress");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation" });

    expect(within(drawer).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes on its own button, on Escape, and on choosing a destination", async () => {
    renderAt("/roadmap");

    const open = () =>
      userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    await open();
    await userEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await open();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await open();
    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    await userEvent.click(within(drawer).getByRole("link", { name: "Challenges" }));

    // A drawer left open over the page it just opened is the classic version of
    // this bug.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("covers page content that pins itself, rather than leaving it lit", async () => {
    // The roadmap's sticky title bar sits at z-40. While the backdrop sat at
    // the same level the bar stayed bright with the whole page dimmed around
    // it — the drawer is app chrome and has to out-rank anything a page stacks.
    renderAt("/roadmap");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const backdrop = drawer.previousElementSibling!;

    const zOf = (el: Element) =>
      Number(/z-\[?(\d+)\]?/.exec(el.className.toString())?.[1] ?? 0);

    expect(zOf(backdrop)).toBeGreaterThan(40);
    expect(zOf(drawer)).toBeGreaterThan(zOf(backdrop));
  });

  it("says whether the menu is open", async () => {
    renderAt("/roadmap");

    const toggle = screen.getByRole("button", { name: "Open navigation" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
