// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";

import { AdminLayout } from "./AdminLayout";

/**
 * The admin shell on a narrow screen: the sidebar used to sit at a fixed
 * 256px at every width, so below `md` it is a drawer opened from the header.
 * jsdom applies no media queries, so what is pinned here is the state and the
 * classes that put it behind the breakpoint.
 */

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Maria Santos", email: "m@example.test", role: "admin" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/features/admin/adminService", () => ({
  fetchCohorts: vi.fn().mockResolvedValue([]),
}));

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [{ path: "*", element: <p>page</p> }],
      },
    ],
    { initialEntries: [path] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

const sidebar = () =>
  screen.getByRole("button", { name: "Dashboard" }).closest("nav")!.parentElement!
    .parentElement!;

describe("the admin shell on a narrow screen", () => {
  it("keeps the sidebar behind the breakpoint until it is opened", () => {
    renderAt("/admin/dashboard");

    expect(sidebar()).toHaveClass("max-md:-translate-x-full", "max-md:invisible", "md:translate-x-0");

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    expect(toggle).toHaveClass("md:hidden");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens, and closes from its own button", async () => {
    const user = userEvent.setup();
    renderAt("/admin/dashboard");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "true");
    expect(sidebar()).not.toHaveClass("max-md:invisible");

    await user.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(sidebar()).toHaveClass("max-md:invisible");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderAt("/admin/dashboard");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes once the admin has gone somewhere", async () => {
    const user = userEvent.setup();
    renderAt("/admin/dashboard");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(screen.getByRole("button", { name: "Analytics" }));

    expect(screen.getByRole("heading", { level: 2, name: "Analytics & Insights" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("dims the page above anything a page pins, with the drawer above that", async () => {
    const user = userEvent.setup();
    renderAt("/admin/dashboard");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const zOf = (el: Element) => Number(/z-\[?(\d+)\]?/.exec(el.className.toString())?.[1] ?? 0);
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0')!;

    expect(zOf(backdrop)).toBeGreaterThan(40);
    expect(zOf(sidebar())).toBeGreaterThan(zOf(backdrop));
  });
});
